#!/usr/bin/env node
/**
 * Resolves Wikipedia, Wikidata, and Grokipedia URLs for entity names with
 * mandatory pacing to avoid 429 rate limits. Used by knowsabout-entity-research.
 *
 * Usage:
 *   node resolve-entity-urls.mjs --names "Pruning,Arboriculture,Arborist"
 *   node resolve-entity-urls.mjs --file entities.txt
 *   echo '["Pruning","Grant County, West Virginia"]' | node resolve-entity-urls.mjs --stdin
 *   node resolve-entity-urls.mjs --stdin --overrides path/to/entity-url-overrides.json
 *   node resolve-entity-urls.mjs --stdin --max-attempts 5 --max-grok-probes 3
 *
 * Prefer --stdin JSON or --file (one name per line) when names contain commas.
 * Per-client title overrides: {project}/resources/schema/entity-url-overrides.json
 *
 * Attempt limits (per entity): hard-to-resolve names stop after a small budget so
 * batch runs do not spend dozens of calls on low-value mismatches (e.g. no Wikipedia article).
 * Grokipedia is skipped entirely when Wikipedia does not resolve.
 *
 * Env:
 *   WIKI_DELAY_MS=500           delay after each Wikipedia/Wikidata API call (default 500)
 *   GROK_DELAY_MS=350           delay after each Grokipedia probe (default 350)
 *   MAX_RESOLUTION_ATTEMPTS=5   max HTTP resolution steps per entity (wiki + grok shared)
 *   MAX_GROK_PROBES=3           max Grokipedia HEAD probes when Wikipedia succeeded (default 3)
 *   MAX_SEARCH_HITS=2           max search-result titles to verify after search API (default 2)
 */

import https from 'https';
import { readFileSync, existsSync } from 'fs';

const UA = 'SemanticLinks-KnowsAboutResearch/1.0 (entity-url-resolver; +https://semanticlinks.com)';
const WIKI_DELAY_MS = Number(process.env.WIKI_DELAY_MS || 500);
const GROK_DELAY_MS = Number(process.env.GROK_DELAY_MS || 350);
const MAX_RESOLUTION_ATTEMPTS = Number(process.env.MAX_RESOLUTION_ATTEMPTS || 5);
const MAX_GROK_PROBES = Number(process.env.MAX_GROK_PROBES || 3);
const MAX_SEARCH_HITS = Number(process.env.MAX_SEARCH_HITS || 2);

/**
 * Global overrides — arboriculture / tree-care terms only (all clients in this vertical).
 * Client-specific geography: {project}/resources/schema/entity-url-overrides.json via --overrides.
 */
const GLOBAL_WIKI_TITLE_OVERRIDES = {
  'stump grinder': 'Stump_grinder',
  'block and tackle': 'Block_and_tackle',
  'wood chipper': 'Wood_chipper',
  'tree preservation': 'Tree_preservation_order',
  'compartmentalization of decay in trees': 'Compartmentalization_of_decay_in_trees',
  'integrated pest management': 'Integrated_pest_management',
  'plant pathology': 'Plant_pathology',
  'emerald ash borer': 'Emerald_ash_borer',
  'international society of arboriculture': 'International_Society_of_Arboriculture',
};

const GLOBAL_WIKI_SEARCH_QUERY = {
  'hazard tree': 'hazardous tree arboriculture',
  'crown thinning': 'crown thinning trees pruning',
  'visual tree assessment': 'visual tree assessment arboriculture',
};

function normalizeOverrideMap(obj = {}) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && v.trim()) out[k.trim().toLowerCase()] = v.trim();
  }
  return out;
}

function loadProjectOverrides(filePath) {
  if (!filePath || !existsSync(filePath)) return { wikiTitleOverrides: {}, wikiSearchQuery: {}, opensearchReject: [] };
  const raw = JSON.parse(readFileSync(filePath, 'utf8'));
  return {
    wikiTitleOverrides: normalizeOverrideMap(raw.wikiTitleOverrides),
    wikiSearchQuery: normalizeOverrideMap(raw.wikiSearchQuery),
    opensearchReject: Array.isArray(raw.opensearchReject) ? raw.opensearchReject : [],
    client: raw.client || null,
  };
}

function mergeConfig(project) {
  return {
    wikiTitleOverrides: { ...GLOBAL_WIKI_TITLE_OVERRIDES, ...project.wikiTitleOverrides },
    wikiSearchQuery: { ...GLOBAL_WIKI_SEARCH_QUERY, ...project.wikiSearchQuery },
    opensearchReject: project.opensearchReject || [],
    client: project.client,
  };
}

function createAttemptBudget(maxAttempts) {
  return { max: maxAttempts, used: 0, phases: [] };
}

function budgetTry(budget, phase) {
  if (budget.used >= budget.max) return false;
  budget.used += 1;
  budget.phases.push(phase);
  return true;
}

function budgetExhausted(budget) {
  return budget.used >= budget.max;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function get(url, retries = 3) {
  return new Promise((resolve, reject) => {
    const attempt = (n, backoff) => {
      https
        .get(url, { headers: { 'User-Agent': UA } }, (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', async () => {
            if (res.statusCode === 429 && n < retries) {
              const ra = Number(res.headers['retry-after'] || 0) * 1000;
              await sleep(ra || backoff);
              attempt(n + 1, backoff * 2);
              return;
            }
            resolve({ status: res.statusCode, body, headers: res.headers });
          });
        })
        .on('error', reject);
    };
    attempt(0, 2000);
  });
}

function headStatus(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD', headers: { 'User-Agent': UA } }, (res) => {
      res.resume();
      resolve(res.statusCode || 0);
    });
    req.on('error', () => resolve(0));
    req.end();
  });
}

function wikiSlug(title) {
  return encodeURIComponent(title.replace(/ /g, '_'));
}

function grokPageUrl(slug) {
  const path = slug.replace(/ /g, '_').replace(/,/g, '%2C');
  return `https://grokipedia.com/page/${path}`;
}

function toUnderscoreTitle(name) {
  return name.trim().replace(/ /g, '_');
}

function exactTitleCandidates(name, wikiTitleOverrides) {
  const n = name.trim();
  const set = new Set();
  const key = n.toLowerCase();
  if (wikiTitleOverrides[key]) set.add(wikiTitleOverrides[key]);
  set.add(n);
  set.add(toUnderscoreTitle(n));
  return [...set];
}

function matchesRejectRule(query, title, rule) {
  const q = query.toLowerCase();
  const t = title.toLowerCase();
  const includes = (list) => list.every((s) => q.includes(String(s).toLowerCase()));
  const excludes = (list) => list.some((s) => q.includes(String(s).toLowerCase()));
  const titleHas = (list) => list.every((s) => t.includes(String(s).toLowerCase()));
  const titleHasAny = (list) => list.some((s) => t.includes(String(s).toLowerCase()));
  const titleLacks = (list) => list.some((s) => t.includes(String(s).toLowerCase()));

  if (rule.queryIncludes && !includes(rule.queryIncludes)) return false;
  if (rule.queryExcludes && excludes(rule.queryExcludes)) return false;
  if (rule.titleIncludes && !titleHas(rule.titleIncludes)) return false;
  if (rule.titleIncludesAny && !titleHasAny(rule.titleIncludesAny)) return false;
  if (rule.titleExcludes && titleLacks(rule.titleExcludes)) return false;
  return true;
}

/** Reject opensearch hits (global heuristics + optional project rules from --overrides). */
function opensearchLooksWrong(query, title, projectRejectRules = []) {
  const q = query.toLowerCase();
  const t = title.toLowerCase();
  const qTokens = q.split(/\s+/).filter((w) => w.length > 3);
  if (qTokens.length > 0) {
    const matched = qTokens.filter((w) => t.includes(w));
    if (q.includes('tree') && !t.includes('tree') && !t.includes('arbor')) return true;
    if (q.includes('thinning') && !t.includes('thin') && !t.includes('prun') && !t.includes('crown'))
      return true;
    if (q.includes('assessment') && !t.includes('assess') && !t.includes('tree')) return true;
    if (matched.length === 0) return true;
  }

  for (const rule of projectRejectRules) {
    if (matchesRejectRule(query, title, rule)) return true;
  }
  // Place/structure query vs person article (e.g. Fort Mulligan → James A. Mulligan)
  if (/\bfort\b/.test(q) && !/\bfort\b/.test(t)) return true;
  return false;
}

/** Reject resolved Wikipedia titles that fail the same sanity checks as opensearch. */
function resolvedTitleRejected(entityName, wikiTitle) {
  if (!wikiTitle) return true;
  return opensearchLooksWrong(entityName, wikiTitle, []);
}

function acceptWikiHit(entityName, hit, via) {
  if (!hit || resolvedTitleRejected(entityName, hit.wikiTitle)) return null;
  return { ...hit, wikiResolvedVia: via };
}

/** One budget unit: verify a single Wikipedia title (internal underscore variants only). */
async function pagePropsForTitle(title, budget) {
  if (!budgetTry(budget, `wiki_title:${title}`)) return null;

  const variants = [...new Set([title, title.replace(/_/g, ' '), title.replace(/ /g, '_')])];
  for (const apiTitle of variants) {
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&redirects&titles=${encodeURIComponent(apiTitle)}&format=json`;
    const { status, body } = await get(url);
    await sleep(WIKI_DELAY_MS);
    if (status !== 200) continue;
    try {
      const pages = JSON.parse(body).query?.pages || {};
      const page = Object.values(pages)[0];
      if (!page || 'missing' in page) continue;
      const resolvedTitle = page.title;
      const wikiUrl = `https://en.wikipedia.org/wiki/${wikiSlug(resolvedTitle)}`;
      let wikidata = '-';
      const item = page.pageprops?.wikibase_item;
      if (item) wikidata = `https://www.wikidata.org/wiki/${item}`;
      return { wikipedia: wikiUrl, wikidata, wikiTitle: resolvedTitle, wikiError: null };
    } catch {
      continue;
    }
  }
  return null;
}

async function searchWikipedia(searchQuery, originalName, config, budget) {
  if (!budgetTry(budget, 'wiki_search_api')) return null;

  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&srlimit=5&format=json`;
  const { status, body } = await get(url);
  await sleep(WIKI_DELAY_MS);
  if (status !== 200) return null;
  try {
    const hits = JSON.parse(body).query?.search || [];
    for (const hit of hits.slice(0, MAX_SEARCH_HITS)) {
      if (budgetExhausted(budget)) break;
      if (opensearchLooksWrong(originalName, hit.title, config.opensearchReject)) continue;
      const page = await pagePropsForTitle(hit.title, budget);
      const accepted = acceptWikiHit(originalName, page, 'search');
      if (accepted) return accepted;
    }
  } catch {
    return null;
  }
  return null;
}

function wikiFailed(wiki) {
  return !wiki.wikipedia || wiki.wikipedia === '-';
}

async function resolveWikipedia(name, config, budget) {
  const overrideKey = name.trim().toLowerCase();
  if (config.wikiTitleOverrides[overrideKey]) {
    const hit = acceptWikiHit(name, await pagePropsForTitle(config.wikiTitleOverrides[overrideKey], budget), 'override');
    if (hit) return hit;
    if (budgetExhausted(budget)) return wikiAttemptLimitResult(name, 'override_exhausted');
  }

  if (!budgetTry(budget, 'wiki_opensearch_api')) {
    return wikiAttemptLimitResult(name, 'attempt_limit');
  }

  const q = encodeURIComponent(name);
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${q}&limit=3&namespace=0&format=json`;
  const { status, body } = await get(url);
  await sleep(WIKI_DELAY_MS);
  let opensearchTitle = null;
  if (status === 200) {
    try {
      const data = JSON.parse(body);
      const titles = data[1] || [];
      opensearchTitle =
        titles.find((t) => !opensearchLooksWrong(name, t, config.opensearchReject)) || null;
    } catch {
      /* fall through */
    }
  }

  if (opensearchTitle && !budgetExhausted(budget)) {
    const hit = acceptWikiHit(name, await pagePropsForTitle(opensearchTitle, budget), 'opensearch');
    if (hit) return hit;
  }

  for (const candidate of exactTitleCandidates(name, config.wikiTitleOverrides)) {
    if (budgetExhausted(budget)) break;
    const hit = acceptWikiHit(name, await pagePropsForTitle(candidate, budget), 'exact_title');
    if (hit) return hit;
  }

  if (!budgetExhausted(budget)) {
    const searchQ = config.wikiSearchQuery[name.trim().toLowerCase()] || name;
    const searchHit = await searchWikipedia(searchQ, name, config, budget);
    if (searchHit) return searchHit;
  }

  const err = budgetExhausted(budget) ? 'attempt_limit' : 'no_result';
  return {
    wikipedia: '-',
    wikidata: '-',
    wikiTitle: null,
    wikiError: err,
    wikiResolvedVia: null,
  };
}

function wikiAttemptLimitResult(name, reason) {
  return {
    wikipedia: '-',
    wikidata: '-',
    wikiTitle: null,
    wikiError: reason,
    wikiResolvedVia: null,
  };
}

function grokCandidates(name, wikiTitle, maxProbes) {
  const ordered = [];
  const add = (s) => {
    if (s && !ordered.includes(s)) ordered.push(s);
  };

  const base = wikiTitle || name;
  const underscored = toUnderscoreTitle(base.replace(/_/g, ' '));
  const nameUnder = toUnderscoreTitle(name);

  add(underscored);
  add(base.replace(/ /g, '_'));
  add(nameUnder);
  if (/international society of arboriculture/i.test(name)) {
    add('international_society_of_arboriculture');
    add('International_Society_of_Arboriculture');
  }
  if (/,\s*[\w\s]+$/i.test(name) || /county/i.test(name)) {
    add(nameUnder);
    const parts = name.split(',').map((s) => s.trim());
    if (parts.length === 2) add(`${parts[0].replace(/ /g, '_')},_${parts[1].replace(/ /g, '_')}`);
  }
  add(
    name
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('_')
  );

  return ordered.slice(0, maxProbes);
}

async function resolveGrokipedia(name, wiki, budget, maxGrokProbes) {
  if (wikiFailed(wiki)) {
    return {
      grokipedia: '-',
      grokTried: [],
      grokError: 'skipped_no_wikipedia',
      grokSkipped: true,
    };
  }

  const tried = [];
  for (const slug of grokCandidates(name, wiki.wikiTitle, maxGrokProbes)) {
    if (!budgetTry(budget, `grok_probe:${slug}`)) break;
    const url = grokPageUrl(slug);
    tried.push(url);
    const status = await headStatus(url);
    await sleep(GROK_DELAY_MS);
    if (status >= 200 && status < 400) {
      return { grokipedia: url, grokTried: tried, grokError: null, grokSkipped: false };
    }
  }

  const err = budgetExhausted(budget) ? 'attempt_limit' : '404_after_probes';
  return { grokipedia: '-', grokTried: tried, grokError: err, grokSkipped: false };
}

async function resolveEntity(name, config, limits) {
  const budget = createAttemptBudget(limits.maxAttempts);
  const wiki = await resolveWikipedia(name, config, budget);
  const grok = await resolveGrokipedia(name, wiki, budget, limits.maxGrokProbes);

  return {
    name,
    ...wiki,
    ...grok,
    resolutionAttempts: {
      used: budget.used,
      max: budget.max,
      phases: budget.phases,
    },
    resolutionSkipped:
      wikiFailed(wiki) ||
      wiki.wikiError === 'attempt_limit' ||
      wiki.wikiError === 'rejected_title' ||
      grok.grokSkipped === true,
  };
}

function parseArgs(argv) {
  const names = [];
  let file = null;
  let stdin = false;
  let overridesPath = null;
  let maxAttempts = MAX_RESOLUTION_ATTEMPTS;
  let maxGrokProbes = MAX_GROK_PROBES;

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--names' && argv[i + 1]) {
      names.push(...argv[++i].split(',').map((s) => s.trim()).filter(Boolean));
    } else if (argv[i] === '--file' && argv[i + 1]) {
      file = argv[++i];
    } else if (argv[i] === '--stdin') {
      stdin = true;
    } else if (argv[i] === '--overrides' && argv[i + 1]) {
      overridesPath = argv[++i];
    } else if (argv[i] === '--max-attempts' && argv[i + 1]) {
      maxAttempts = Number(argv[++i]);
    } else if (argv[i] === '--max-grok-probes' && argv[i + 1]) {
      maxGrokProbes = Number(argv[++i]);
    }
  }
  if (file) {
    const text = readFileSync(file, 'utf8');
    names.push(
      ...text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }
  if (stdin) {
    const text = readFileSync(0, 'utf8');
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) names.push(...parsed.map(String));
  }
  return {
    names: [...new Set(names)],
    overridesPath,
    limits: { maxAttempts, maxGrokProbes },
  };
}

const { names, overridesPath, limits } = parseArgs(process.argv);
if (!names.length) {
  console.error('Provide --names "A,B" or --file entities.txt or --stdin JSON array');
  console.error('Optional: --overrides path/to/entity-url-overrides.json');
  console.error('Optional: --max-attempts 5 --max-grok-probes 3');
  console.error('Use --stdin or --file when entity names contain commas.');
  process.exit(1);
}

const config = mergeConfig(loadProjectOverrides(overridesPath));

const results = [];
for (const name of names) {
  results.push(await resolveEntity(name, config, limits));
}

const payload = {
  delayWikiMs: WIKI_DELAY_MS,
  delayGrokMs: GROK_DELAY_MS,
  maxResolutionAttempts: limits.maxAttempts,
  maxGrokProbes: limits.maxGrokProbes,
  maxSearchHits: MAX_SEARCH_HITS,
  results,
};
if (config.client) payload.overridesClient = config.client;
if (overridesPath) payload.overridesFile = overridesPath;

console.log(JSON.stringify(payload, null, 2));
