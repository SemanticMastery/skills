#!/usr/bin/env node
/**
 * Fallback when OnPage task_post finishes with 0 pages (bot block / stall):
 * fetch each sitemap URL via on_page/instant_pages and write lean CSV/XLSX.
 *
 * Defaults to a normal browser UA (not Googlebot) — WAF sites that set
 * forbidden_http_header on Googlebot will fail again if fallback uses Googlebot.
 * Full sitemap is always crawled for service/storefront sites (no cap here).
 * A target that returns 50402 is retried once, then skipped. More than
 * three slow skips aborts without writing a partial crawl file.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { normalizeField, normalizeText } from './text-normalize.mjs';
import {
  normalizeHost,
  planCrawlTarget,
  fetchSitemapXml,
  expandSitemapPageLocs,
} from './resolve-site.mjs';
import { assertDeliverableContent } from './content-quality.mjs';
import {
  assertDossierForCrawl,
  readDossierWebsite,
  resolveCrawlOutputDir,
} from '../../../scripts/seo/lib/dossier-firmographics.mjs';
import {
  clearActiveTask,
  hostKey,
  readActiveTask,
} from './active-task.mjs';

const API = 'https://api.dataforseo.com/v3';
const ROW_HEADERS = [
  'url',
  'meta_title',
  'h1_count',
  'h1_headings',
  'h2_h6_count',
  'word_count',
  'is_orphan_page',
];
const GOOGLEBOT_MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.96 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const BROWSER_CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const DEFAULT_DELAY_MS = 1200;
const HEARTBEAT_EVERY = 10;
const SLOW_TARGET_SKIP_MAX = 3;
const INSTANT_CONCURRENCY = 4;

function resolveUserAgent(spec) {
  const raw = (spec ?? 'browser').trim();
  const lower = raw.toLowerCase();
  if (lower === 'googlebot' || lower === 'googlebot-mobile') {
    return { label: 'googlebot', ua: GOOGLEBOT_MOBILE_UA };
  }
  if (lower === 'browser' || lower === 'chrome') {
    return { label: 'browser', ua: BROWSER_CHROME_UA };
  }
  return { label: 'custom', ua: raw };
}

function parseArgs(argv) {
  const out = {
    domain: null,
    projectDir: null,
    outputDir: null,
    domainSlug: null,
    minPages: 8,
    userAgent: 'browser',
    delayMs: DEFAULT_DELAY_MS,
    allowEmptyContent: false,
    stopTaskId: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--domain' && argv[i + 1]) out.domain = argv[++i];
    else if (a === '--project-dir' && argv[i + 1]) out.projectDir = argv[++i];
    else if (a === '--output-dir' && argv[i + 1]) out.outputDir = argv[++i];
    else if (a === '--domain-slug' && argv[i + 1]) out.domainSlug = argv[++i];
    else if (a === '--min-pages' && argv[i + 1]) out.minPages = Number(argv[++i]);
    else if (a === '--user-agent' && argv[i + 1]) out.userAgent = argv[++i];
    else if (a === '--delay-ms' && argv[i + 1]) out.delayMs = Number(argv[++i]);
    else if (a === '--stop-task-id' && argv[i + 1]) out.stopTaskId = argv[++i];
    else if (a === '--allow-empty-content') out.allowEmptyContent = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function authHeader() {
  const u = process.env.DATAFORSEO_USERNAME;
  const p = process.env.DATAFORSEO_PASSWORD;
  if (!u || !p) throw new Error('Missing DATAFORSEO_USERNAME or DATAFORSEO_PASSWORD');
  return 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');
}

async function dfsRequest(apiPath, body) {
  const res = await fetch(`${API}${apiPath}`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json?.status_code !== 20000) {
    throw new Error(`DataForSEO ${apiPath}: ${json?.status_message} (${json?.status_code})`);
  }
  return json;
}

async function forceStopTask(taskId) {
  if (!taskId) return false;
  try {
    await dfsRequest('/on_page/force_stop', [{ id: taskId }]);
    process.stderr.write(`[dataforseo] force_stop ok task_id=${taskId}\n`);
    return true;
  } catch (err) {
    process.stderr.write(`[dataforseo] force_stop warn task_id=${taskId}: ${err.message}\n`);
    return false;
  }
}

/**
 * Clear zombie domain crawls before instant_pages — avoids 40501 duplicate crawl host
 * (Harborview 2026-08-10).
 */
async function clearHostLock({ outputDir, host, stopTaskId }) {
  const ids = new Set();
  if (stopTaskId) ids.add(stopTaskId);
  const active = outputDir ? readActiveTask(outputDir) : null;
  if (active?.task_id && (!host || hostKey(active.host) === hostKey(host))) {
    ids.add(active.task_id);
  }
  for (const id of ids) {
    await forceStopTask(id);
  }
  if (outputDir) clearActiveTask(outputDir);
  return [...ids];
}

function isDuplicateCrawlHostError(err) {
  const msg = String(err?.message ?? err ?? '');
  return /40501/i.test(msg) && /duplicate crawl host/i.test(msg);
}

function isSlowTargetError(err) {
  const msg = String(err?.message ?? err ?? '');
  return /50402/.test(msg) || /took too long to respond/i.test(msg);
}

async function instantPageResilient(url, userAgentString) {
  try {
    return await instantPage(url, userAgentString);
  } catch (err) {
    if (!isSlowTargetError(err)) throw err;
    process.stderr.write(
      `[dataforseo] instant slow-target retry once ${url}: ${err.message}\n`
    );
    await new Promise((r) => setTimeout(r, 2000));
    return await instantPage(url, userAgentString);
  }
}

function leanRow(item) {
  const meta = item?.meta ?? {};
  const htags = meta.htags ?? {};
  const h1 = Array.isArray(htags.h1) ? htags.h1 : [];
  const h2h6 = ['h2', 'h3', 'h4', 'h5', 'h6'].reduce(
    (sum, key) => sum + (Array.isArray(htags[key]) ? htags[key].length : 0),
    0
  );
  let h1Headings = null;
  if (h1.length === 1) h1Headings = h1[0];
  else if (h1.length > 1) h1Headings = h1;

  return {
    url: normalizeField(item?.url ?? null),
    meta_title: normalizeField(meta.meta_title ?? meta.title ?? null),
    h1_count: h1.length,
    h1_headings: normalizeField(h1Headings),
    h2_h6_count: h2h6,
    word_count: meta.content?.plain_text_word_count ?? null,
    is_orphan_page: null,
  };
}

function cellValue(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return normalizeText(v.join(' | '));
  return normalizeText(String(v));
}

function toCsv(rows) {
  const q = (v) => {
    if (v == null || v === '') return '';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    const s = Array.isArray(v)
      ? v.map((x) => normalizeText(String(x))).join(' | ')
      : normalizeText(String(v));
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [ROW_HEADERS.join(','), ...rows.map((r) => ROW_HEADERS.map((h) => q(r[h])).join(','))].join(
    '\n'
  );
}

function writeDeliverables(outputDir, slug, rows) {
  const date = new Date().toISOString().slice(0, 10);
  const base = `onpage-crawl-${slug}-${date}`;
  fs.mkdirSync(outputDir, { recursive: true });
  const csvPath = path.join(outputDir, `${base}.csv`);
  const xlsxPath = path.join(outputDir, `${base}.xlsx`);
  const csvTmp = `${csvPath}.tmp`;
  const xlsxTmp = path.join(outputDir, `${base}.tmp.xlsx`);
  fs.writeFileSync(csvTmp, '\uFEFF' + toCsv(rows), 'utf8');
  const sheetRows = [ROW_HEADERS, ...rows.map((r) => ROW_HEADERS.map((h) => cellValue(r[h])))];
  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pages');
  XLSX.writeFile(wb, xlsxTmp);
  fs.renameSync(csvTmp, csvPath);
  fs.renameSync(xlsxTmp, xlsxPath);
  return { base, csvPath, xlsxPath };
}

function domainSlugFromHost(host) {
  return host.replace(/^www\./i, '').replace(/[^a-z0-9]+/gi, '');
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '?';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m <= 0) return `${s}s`;
  return `${m}m ${s}s`;
}

async function instantPage(url, userAgentString) {
  const data = await dfsRequest('/on_page/instant_pages', [
    { url, custom_user_agent: userAgentString, enable_javascript: false },
  ]);
  const task = data.tasks?.[0];
  if (task?.status_code && task.status_code !== 20000 && task.status_code !== 20100) {
    throw new Error(
      `instant_pages failed for ${url}: ${task.status_message} (${task.status_code})`
    );
  }
  const item = task?.result?.[0]?.items?.[0];
  if (!item) throw new Error(`No instant_pages result for ${url}`);
  if (item.status_code && item.status_code >= 40000) {
    throw new Error(`instant_pages failed for ${url}: ${item.status_code}`);
  }
  return item;
}

export async function runSitemapInstantFallback(args) {
  if (!args.domain) throw new Error('--domain is required');
  if (args.delayMs == null) args.delayMs = DEFAULT_DELAY_MS;
  if (args.minPages == null) args.minPages = 8;
  if (!args.userAgent) args.userAgent = 'browser';

  if (args.projectDir && !args.outputDir) {
    args.outputDir = resolveCrawlOutputDir(args.projectDir);
  }

  if (!args.outputDir) {
    throw new Error('--output-dir is required unless --project-dir is set');
  }

  if (args.projectDir) {
    assertDossierForCrawl(args.projectDir);
  }

  const uaInfo = resolveUserAgent(args.userAgent);
  const inputHost = normalizeHost(args.domain);
  const dossierWebsite = args.projectDir ? readDossierWebsite(args.projectDir) : null;
  const plan = await planCrawlTarget(inputHost, { dossierWebsite });

  const stopped = await clearHostLock({
    outputDir: args.outputDir,
    host: plan.crawlTarget,
    stopTaskId: args.stopTaskId,
  });
  if (stopped.length) {
    process.stderr.write(
      `[dataforseo] cleared host lock before instant_pages (force_stop ${stopped.join(', ')})\n`
    );
  }

  const sm = await fetchSitemapXml(plan.crawlTarget);
  const locs = sm ? (await expandSitemapPageLocs(sm)).locs : [];
  if (locs.length === 0) throw new Error('No sitemap URLs found for fallback crawl');

  const perUrlSec = 2;
  const etaTotalSec = Math.round((locs.length * perUrlSec) / INSTANT_CONCURRENCY);
  process.stderr.write(
    `[dataforseo] fallback=instant_pages urls=${locs.length} target=${plan.crawlTarget} ua=${uaInfo.label} concurrency=${INSTANT_CONCURRENCY} eta~${formatEta(etaTotalSec)} (full sitemap, no cap)\n`
  );

  const skipped = [];
  const results = new Array(locs.length);
  const started = Date.now();
  let cursor = 0;
  let done = 0;
  let fatal = null;
  let hostClear = null;

  async function clearHostOnce() {
    if (!hostClear) {
      hostClear = (async () => {
        process.stderr.write(
          `[dataforseo] 40501 duplicate crawl host on instant_pages — force_stop active task and retry once\n`
        );
        await clearHostLock({
          outputDir: args.outputDir,
          host: plan.crawlTarget,
          stopTaskId: args.stopTaskId,
        });
        await new Promise((r) => setTimeout(r, 2000));
      })();
    }
    await hostClear;
  }

  async function fetchOne(url) {
    try {
      return await instantPageResilient(url, uaInfo.ua);
    } catch (err) {
      if (!isDuplicateCrawlHostError(err)) throw err;
      await clearHostOnce();
      return await instantPageResilient(url, uaInfo.ua);
    }
  }

  async function worker() {
    while (!fatal && skipped.length <= SLOW_TARGET_SKIP_MAX) {
      const i = cursor++;
      if (i >= locs.length) return;
      const url = locs[i];
      try {
        results[i] = leanRow(await fetchOne(url));
      } catch (err) {
        if (!isSlowTargetError(err)) {
          fatal = err;
          return;
        }
        skipped.push(url);
        process.stderr.write(
          `[dataforseo] instant skip slow-target ${skipped.length}/${SLOW_TARGET_SKIP_MAX} ${url}: ${err.message}\n`
        );
        if (skipped.length > SLOW_TARGET_SKIP_MAX) {
          fatal = new Error(
            `instant_pages slow-target abort after ${skipped.length} timeouts (last ${url}). ` +
              `${results.filter(Boolean).length} page(s) fetched were not written.`
          );
          return;
        }
      } finally {
        done += 1;
        if (done === 1 || done % HEARTBEAT_EVERY === 0 || done === locs.length) {
          const elapsedSec = (Date.now() - started) / 1000;
          const ok = results.filter(Boolean).length;
          const remainSec = done > 0 ? ((locs.length - done) * elapsedSec) / done : etaTotalSec;
          process.stderr.write(
            `[dataforseo] heartbeat done=${done}/${locs.length} ok=${ok} elapsed=${formatEta(elapsedSec)} eta~${formatEta(remainSec)}\n`
          );
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(INSTANT_CONCURRENCY, locs.length) }, () => worker())
  );
  if (fatal) throw fatal;
  const rows = results.filter(Boolean);

  const minRequired = Math.max(args.minPages, locs.length - skipped.length);
  if (rows.length < minRequired) {
    throw new Error(
      `SITEMAP_INCOMPLETE: fallback returned ${rows.length} pages (min=${minRequired}, sitemap=${locs.length}, slow_skips=${skipped.length})`
    );
  }

  const contentStats = assertDeliverableContent(rows, {
    allowEmptyContent: args.allowEmptyContent,
    context: `mode=sitemap_instant_fallback target=${plan.crawlTarget}`,
  });
  process.stderr.write(
    `[dataforseo] content_quality n=${contentStats.n} with_title=${contentStats.with_title} with_words=${contentStats.with_words} content_ratio=${contentStats.content_ratio.toFixed(3)}\n`
  );

  const slug = args.domainSlug ?? domainSlugFromHost(plan.crawlTarget);
  const written = writeDeliverables(args.outputDir, slug, rows);
  const elapsedSec = Math.round((Date.now() - started) / 1000);
  console.log(
    JSON.stringify(
      {
        mode: 'sitemap_instant_fallback',
        crawl_target: plan.crawlTarget,
        sitemap_url: plan.sitemapUrl,
        user_agent: uaInfo.label,
        pages_returned: rows.length,
        slow_skips: skipped,
        content_quality: contentStats,
        elapsed_seconds: elapsedSec,
        written: [written.csvPath, written.xlsxPath],
        deliverable_base: written.base,
      },
      null,
      2
    )
  );
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.domain) {
    console.log(
      'Usage: node sitemap-instant-fallback.mjs --domain example.com --project-dir DIR [--output-dir DIR] [--user-agent browser|googlebot] [--stop-task-id UUID]'
    );
    process.exit(args.help ? 0 : 1);
  }
  await runSitemapInstantFallback(args);
}

if (isDirectRun()) {
  main().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
