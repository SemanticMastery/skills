/**
 * Resolve live hostname + sitemap host alignment before OnPage task_post.
 *
 * Also probes whether the site needs enable_javascript on task_post (SPA / empty
 * plain HTML). See docs/solutions/onpage-js-and-stall-fix.md (Summit 2026-06).
 *
 * CLI (no DataForSEO): node resolve-site.mjs --domain example.com --project-dir "…"
 */

import path from 'node:path';
import { readDossierWebsite } from '../../../scripts/seo/lib/dossier-firmographics.mjs';

const JS_PLAIN_TEXT_WORD_THRESHOLD = 100;
const JS_SHELL_MARKERS =
  /__NEXT_DATA__|id=["'](?:root|app|__next)["']|ng-version|data-reactroot|nuxt|gatsby|webpackJsonp/i;

/** Common sitemap / sitemap-index paths (Yoast, RankMath, WP, generic). */
const SITEMAP_PATHS = [
  '/sitemaps.xml',
  '/sitemap_index.xml',
  '/sitemap-index.xml',
  '/sitemap.xml',
  '/wp-sitemap.xml',
];

export function normalizeHost(raw) {
  if (!raw) return null;
  let d = String(raw).trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  d = d.split('/')[0];
  return d || null;
}

/** Follow redirects (manual) to the hostname users/bots actually land on. */
export async function resolveLiveHostname(host) {
  const variants = [host];
  if (!/^www\./i.test(host)) variants.push(`www.${host}`);
  for (const h of variants) {
    let url = `https://${h}/`;
    for (let hop = 0; hop < 10; hop++) {
      const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) break;
        url = new URL(loc, url).href;
        continue;
      }
      if (res.status >= 200 && res.status < 300) {
        return new URL(url).hostname;
      }
      break;
    }
  }
  return host;
}

function hostVariants(host) {
  const apex = host.replace(/^www\./i, '');
  const www = /^www\./i.test(host) ? host : `www.${host}`;
  return [...new Set([host, apex, www])];
}

/** Parse `Sitemap:` lines from robots.txt. */
export function parseRobotsSitemapUrls(robotsText) {
  if (!robotsText) return [];
  const urls = [];
  for (const line of String(robotsText).split(/\r?\n/)) {
    const m = line.match(/^\s*Sitemap:\s*(\S+)/i);
    if (m?.[1]) urls.push(m[1].trim());
  }
  return [...new Set(urls)];
}

async function fetchRobotsSitemapUrls(host) {
  const urls = [];
  for (const h of hostVariants(host)) {
    try {
      const res = await fetch(`https://${h}/robots.txt`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      urls.push(...parseRobotsSitemapUrls(await res.text()));
    } catch {
      /* try next host */
    }
  }
  return [...new Set(urls)];
}

/**
 * Discover sitemap or sitemap index XML.
 * Tries robots.txt Sitemap: first, then common path slugs on apex/www.
 */
export async function fetchSitemapXml(host) {
  const fromRobots = await fetchRobotsSitemapUrls(host);
  const pathCandidates = [];
  for (const h of hostVariants(host)) {
    for (const p of SITEMAP_PATHS) {
      pathCandidates.push(`https://${h}${p}`);
    }
  }
  const candidates = [...fromRobots, ...pathCandidates];
  const seen = new Set();

  for (const url of candidates) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.includes('<urlset') && !text.includes('<sitemapindex')) continue;
      const finalUrl = res.url || url;
      return { url: finalUrl, requestedUrl: url, text };
    } catch {
      /* try next */
    }
  }
  return null;
}

export function parseSitemapLocs(xml) {
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
  const hosts = {};
  for (const loc of locs) {
    try {
      const h = new URL(loc).hostname.toLowerCase();
      hosts[h] = (hosts[h] || 0) + 1;
    } catch {
      /* skip */
    }
  }
  return { locs, hosts };
}

export function isSitemapIndex(xml) {
  return /<sitemapindex/i.test(xml);
}

export async function fetchSitemapXmlByUrl(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.includes('<urlset') && !text.includes('<sitemapindex')) return null;
  return { url, text };
}

/** Skip Shopify/product child sitemaps by token (products, blogs, agentic, …). */
export function skipSitemapChildByNames(childUrl, names) {
  if (!names?.length) return false;
  const u = String(childUrl).toLowerCase();
  return names.some((raw) => {
    const k = String(raw).toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (!k) return false;
    return (
      u.includes(`sitemap_${k}`) ||
      u.includes(`sitemap-${k}`) ||
      u.includes(`${k}-sitemap`)
    );
  });
}

/**
 * Keep homepage and/or URL path substrings; drop product (and similar) paths.
 * `/collections/foo/products/bar` is denied when deny includes `/products/`.
 */
export function locAllowedByPath(
  url,
  { allowPathSubstrings = [], denyPathSubstrings = [], includeHome = false } = {},
) {
  let pathname;
  try {
    pathname = new URL(url).pathname || '/';
  } catch {
    return false;
  }
  const path = pathname.toLowerCase();
  if (includeHome && (path === '/' || path === '')) return true;
  for (const d of denyPathSubstrings) {
    const needle = String(d || '').toLowerCase();
    if (needle && path.includes(needle)) return false;
  }
  if (!allowPathSubstrings.length) return true;
  return allowPathSubstrings.some((a) => {
    const needle = String(a || '').toLowerCase();
    return needle && path.includes(needle);
  });
}

/** Expand sitemap indexes into page URLs (e.g. sitemaps.xml → post-sitemap1.xml → N URLs). */
export async function expandSitemapPageLocs(rootSm, opts = {}) {
  const skipChild = opts.skipChildUrl || (() => false);
  const top = parseSitemapLocs(rootSm.text);
  if (!isSitemapIndex(rootSm.text)) {
    return {
      locs: top.locs.filter((loc) => !/\.xml(\?|$)/i.test(loc)),
      hosts: top.hosts,
      indexChildCount: 0,
      childSitemapUrls: [],
    };
  }

  const pageLocs = [];
  const hosts = {};
  const childSitemapUrls = [];
  for (const childUrl of top.locs) {
    if (skipChild(childUrl)) continue;
    childSitemapUrls.push(childUrl);
    try {
      const child = await fetchSitemapXmlByUrl(childUrl);
      if (!child) continue;
      if (isSitemapIndex(child.text)) {
        const nested = await expandSitemapPageLocs(child, opts);
        pageLocs.push(...nested.locs);
        childSitemapUrls.push(...(nested.childSitemapUrls || []));
        for (const [h, count] of Object.entries(nested.hosts)) {
          hosts[h] = (hosts[h] || 0) + count;
        }
        continue;
      }
      const parsed = parseSitemapLocs(child.text);
      for (const loc of parsed.locs) {
        if (!/\.xml(\?|$)/i.test(loc)) pageLocs.push(loc);
      }
      for (const [h, count] of Object.entries(parsed.hosts)) {
        hosts[h] = (hosts[h] || 0) + count;
      }
    } catch {
      /* skip child sitemap */
    }
  }

  return {
    locs: [...new Set(pageLocs)],
    hosts,
    indexChildCount: top.locs.length,
    childSitemapUrls: [...new Set(childSitemapUrls)],
  };
}

function predominantHost(hostCounts) {
  const entries = Object.entries(hostCounts);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

export function plainTextWordCount(html) {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped ? stripped.split(' ').filter(Boolean).length : 0;
}

/** Fetch without JS; low visible text ⇒ task_post needs enable_javascript. */
export async function probeJavascriptRequired(pageUrl) {
  const res = await fetch(pageUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    },
  });
  const html = await res.text();
  const plainTextWords = plainTextWordCount(html);
  const shellMarkers = JS_SHELL_MARKERS.test(html);
  const jsRequired =
    plainTextWords < JS_PLAIN_TEXT_WORD_THRESHOLD ||
    (shellMarkers && plainTextWords < 250);
  return { jsRequired, plainTextWords, probeUrl: pageUrl, shellMarkers };
}

function apexHost(host) {
  return host.replace(/^www\./i, '');
}

/**
 * @param {string} inputDomain bare host from user/cli
 * @param {{ dossierWebsite?: string|null, allowPathSubstrings?: string[], denyPathSubstrings?: string[], includeHome?: boolean, excludeSitemapChildren?: string[] }} opts
 */
export async function planCrawlTarget(inputDomain, opts = {}) {
  const warnings = [];
  const inputHost = normalizeHost(inputDomain);
  if (!inputHost) throw new Error('Invalid domain');

  let dossierHost = null;
  if (opts.dossierWebsite) {
    dossierHost = normalizeHost(opts.dossierWebsite);
    if (dossierHost && dossierHost !== inputHost) {
      warnings.push(`dossier host ${dossierHost} differs from input ${inputHost}; using live + sitemap resolution`);
    }
  }

  const liveHost = await resolveLiveHostname(dossierHost || inputHost);
  let crawlTarget = liveHost;

  const sm = await fetchSitemapXml(crawlTarget);
  let sitemapUrl = null;
  let sitemapUrlCount = 0;
  let sitemapPredominantHost = null;

  let sitemapLocs = [];
  let sitemapChildUrls = [];
  if (sm) {
    sitemapUrl = sm.url;
    const expanded = await expandSitemapPageLocs(sm, {
      skipChildUrl: (url) => skipSitemapChildByNames(url, opts.excludeSitemapChildren),
    });
    sitemapLocs = expanded.locs;
    sitemapChildUrls = expanded.childSitemapUrls || [];
    const pathFilterOn =
      Boolean(opts.includeHome) ||
      (opts.allowPathSubstrings || []).length > 0 ||
      (opts.denyPathSubstrings || []).length > 0;
    if (pathFilterOn) {
      const before = sitemapLocs.length;
      sitemapLocs = sitemapLocs.filter((loc) => locAllowedByPath(loc, opts));
      if (opts.includeHome) {
        const home = `https://${crawlTarget}/`;
        const hasHome = sitemapLocs.some((loc) => {
          try {
            return new URL(loc).pathname === '/';
          } catch {
            return false;
          }
        });
        if (!hasHome) sitemapLocs.unshift(home);
      }
      warnings.push(
        `url path filter kept ${sitemapLocs.length} of ${before} sitemap loc(s) (home=${Boolean(opts.includeHome)})`
      );
    }
    sitemapUrlCount = sitemapLocs.length;
    sitemapPredominantHost = predominantHost(expanded.hosts);
    if (expanded.indexChildCount > 0) {
      warnings.push(
        `sitemap index ${sitemapUrl} has ${expanded.indexChildCount} child sitemap(s); expanded to ${sitemapUrlCount} page URL(s)`
      );
      for (const child of sitemapChildUrls.slice(0, 12)) {
        warnings.push(`sitemap_child=${child}`);
      }
      if (sitemapChildUrls.length > 12) {
        warnings.push(`sitemap_child=… +${sitemapChildUrls.length - 12} more`);
      }
    }
    if (sitemapPredominantHost && sitemapPredominantHost !== crawlTarget.toLowerCase()) {
      warnings.push(
        `sitemap host ${sitemapPredominantHost} ≠ live host ${crawlTarget}; aligning target to sitemap`
      );
      crawlTarget = sitemapPredominantHost;
    }
  } else {
    warnings.push(
      `no sitemap/index found for ${crawlTarget} (tried robots.txt + /sitemaps.xml, /sitemap_index.xml, /sitemap.xml, …); using live host only`
    );
  }

  let jsProbe = null;
  let jsRequiredRecommended = false;
  const probeUrls =
    sitemapLocs.length > 1
      ? [...new Set([sitemapLocs[1], sitemapLocs[0], sitemapLocs[2]].filter(Boolean))].slice(0, 3)
      : [sitemapLocs[0] ?? `https://${crawlTarget}/`];
  try {
    const probes = [];
    for (const probeUrl of probeUrls) {
      probes.push(await probeJavascriptRequired(probeUrl));
    }
    jsProbe = probes.reduce((min, p) => (p.plainTextWords < min.plainTextWords ? p : min), probes[0]);
    jsRequiredRecommended = probes.some((p) => p.jsRequired);
    if (jsRequiredRecommended) {
      warnings.push(
        `JS-rendered content detected (min plain_text_words=${jsProbe.plainTextWords} across ${probes.length} probe URL(s)); will auto-enable enable_javascript on task_post`
      );
      const apex = apexHost(inputHost);
      if (apex !== crawlTarget) {
        warnings.push(`JS site: task target ${crawlTarget} → apex ${apex} (DataForSEO guidance)`);
        crawlTarget = apex;
      }
    }
  } catch (err) {
    warnings.push(`JS probe skipped: ${err.message}`);
  }

  const canonicalUrl = `https://${crawlTarget}/`;
  const pathFilterOn =
    Boolean(opts.includeHome) ||
    (opts.allowPathSubstrings || []).length > 0 ||
    (opts.denyPathSubstrings || []).length > 0;
  // Prefer sitemap-only whenever a sitemap exists (service/storefront): crawl what
  // sitemaps explicitly list. Avoids unbounded link-queue balloons (Northside Care).
  // JS-required sites still spider with respect_sitemap for orphans.
  // Path-limited ecommerce (skip /products/) must not crawl_sitemap_only on the
  // full Shopify index — product children are listed first and burn the budget.
  const crawlSitemapOnly =
    sitemapUrlCount > 0 && !jsRequiredRecommended && !pathFilterOn;
  // No soft 500 cap for known sitemap budgets — service sites get full sitemap + headroom.
  const maxCrawlPagesSuggested =
    sitemapUrlCount > 0 ? sitemapUrlCount + 10 : 500;
  // Sitemap-only (and any known sitemap) must cover every loc. 60% was a
  // false-success floor (TLC 2026-09-18: 20/21 accepted because min=12).
  const minPagesSuggested = sitemapUrlCount > 0 ? sitemapUrlCount : 2;

  return {
    inputHost,
    dossierHost,
    liveHost,
    crawlTarget,
    canonicalUrl,
    sitemapUrl,
    sitemapUrlCount,
    sitemapLocs,
    sitemapChildUrls,
    sitemapPredominantHost,
    crawlSitemapOnly,
    jsRequiredRecommended,
    jsProbe,
    maxCrawlPagesSuggested,
    minPagesSuggested,
    warnings,
  };
}

function parseResolveArgs(argv) {
  const out = { domain: null, projectDir: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--domain' && argv[i + 1]) out.domain = argv[++i];
    else if (a === '--project-dir' && argv[i + 1]) out.projectDir = argv[++i];
    else if (a.startsWith('-')) {
      throw new Error(
        `Unknown flag: ${a}. This script is resolve only. Do not pass --post-only, --task-id, --force-new-task, or --allow-empty-content.`
      );
    }
  }
  return out;
}

function toCliSummary(plan, extra = {}) {
  const js = plan.jsProbe
    ? {
        jsRequired: plan.jsProbe.jsRequired,
        plainTextWords: plan.jsProbe.plainTextWords,
        probeUrl: plan.jsProbe.probeUrl,
        shellMarkers: plan.jsProbe.shellMarkers,
      }
    : null;
  return {
    spend: false,
    source: 'resolve-site',
    ...extra,
    inputHost: plan.inputHost,
    dossierHost: plan.dossierHost,
    liveHost: plan.liveHost,
    crawlTarget: plan.crawlTarget,
    canonicalUrl: plan.canonicalUrl,
    sitemapUrl: plan.sitemapUrl,
    sitemapUrlCount: plan.sitemapUrlCount,
    crawlSitemapOnly: plan.crawlSitemapOnly,
    jsRequiredRecommended: plan.jsRequiredRecommended,
    jsProbe: js,
    maxCrawlPagesSuggested: plan.maxCrawlPagesSuggested,
    minPagesSuggested: plan.minPagesSuggested,
    warnings: plan.warnings,
  };
}

async function main() {
  const args = parseResolveArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: node resolve-site.mjs --domain example.com --project-dir "C:\\\\campaign\\\\folder"

No DataForSEO spend. Local robots/sitemap/JS probe only.`);
    return;
  }

  let domain = args.domain ? normalizeHost(args.domain) : null;
  let dossierWebsite = null;
  if (args.projectDir) {
    try {
      dossierWebsite = readDossierWebsite(args.projectDir);
    } catch (err) {
      console.error(`[resolve-site] dossier read skipped: ${err.message}`);
    }
    if (!domain && dossierWebsite) {
      try {
        domain = normalizeHost(new URL(dossierWebsite).hostname);
      } catch {
        throw new Error(`Invalid Official Website in dossier: ${dossierWebsite}`);
      }
    }
  }

  if (!domain) {
    throw new Error(
      'Error: --domain is required unless --project-dir has a dossier Official Website'
    );
  }

  const plan = await planCrawlTarget(domain, { dossierWebsite });
  console.log(
    JSON.stringify(
      toCliSummary(plan, { domain, projectDir: args.projectDir || null, dossierWebsite }),
      null,
      2
    )
  );
}

const invokedAsCli = Boolean(
  process.argv[1] && path.basename(process.argv[1]).toLowerCase() === 'resolve-site.mjs'
);
if (invokedAsCli) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
