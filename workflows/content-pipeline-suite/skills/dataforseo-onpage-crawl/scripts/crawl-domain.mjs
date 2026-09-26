#!/usr/bin/env node
/**
 * DataForSEO OnPage full-domain crawl → lean 7-field rows.
 * Reads DATAFORSEO_USERNAME / DATAFORSEO_PASSWORD from env.
 *
 * Pre-flight (resolve-site.mjs): canonical host, sitemap, JS probe, orphan/sitemap rules.
 * Polling exits immediately when crawl_progress=finished.
 * See docs/solutions/onpage-js-and-stall-fix.md for incident learnings
 * (DeForest 2026-06 JS/stall; Greater Life 2026-07 Googlebot WAF).
 */

import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { normalizeField, normalizeText } from './text-normalize.mjs';
import { normalizeHost, planCrawlTarget } from './resolve-site.mjs';
import { assertDeliverableContent } from './content-quality.mjs';
import {
  assertDossierForCrawl,
  findFieldLearningsFile,
  readDossierWebsite,
  resolveCrawlOutputDir,
} from '../lib/project-paths.mjs';

const API = 'https://api.dataforseo.com/v3';
const SITEMAP_ONLY_MAX_URLS = 30;
const IDLE_POLLS_BEFORE_FORCE_STOP = 3;
const ZERO_PROGRESS_FORCE_STOP_AFTER_MS = 90 * 1000;
const ZERO_PROGRESS_GIVE_UP_AFTER_MS = 120 * 1000;
/** Short post-only window: bot blocks often finish in <10s (Greater Life ~6s). */
const BOT_BLOCK_PROBE_MAX_MS = 90 * 1000;
const BOT_BLOCK_PROBE_POLL_MS = 5 * 1000;

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

/** Non-bot UA for WAF sites that reset/drop Googlebot (forbidden_http_header). */
const BROWSER_CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const BOT_BLOCK_STATUS_RE =
  /forbidden_http_header|forbidden_user_agent|access.?denied|bot.?block|blocked_by_robots|http_header|site_unreachable/i;

function resolveUserAgent(spec) {
  const raw = (spec ?? 'googlebot').trim();
  const lower = raw.toLowerCase();
  if (lower === 'googlebot' || lower === 'googlebot-mobile') {
    return { label: 'googlebot', ua: GOOGLEBOT_MOBILE_UA };
  }
  if (lower === 'browser' || lower === 'chrome') {
    return { label: 'browser', ua: BROWSER_CHROME_UA };
  }
  return { label: 'custom', ua: raw };
}

function pagesCrawledOf(result) {
  const crawled = result?.crawl_status?.pages_crawled ?? result?.crawl_status?.pages_count ?? 0;
  return typeof crawled === 'number' ? crawled : 0;
}

/**
 * Finished crawl that should trigger browser-UA retry (WAF / unreachable / tiny vs sitemap).
 * Greater Life: forbidden_http_header (0 pages) OR site_unreachable (1 page) vs ~390 sitemap.
 */
function isBotBlockResult(result, expectedPages = 0) {
  if (!result || result.crawl_progress !== 'finished') return false;
  const crawled = pagesCrawledOf(result);
  const extended = String(result?.domain_info?.extended_crawl_status ?? '');
  const stop = String(result?.crawl_stop_reason ?? '');

  if (BOT_BLOCK_STATUS_RE.test(extended)) {
    // site_unreachable / forbidden* — even if 1 page slipped through
    if (crawled === 0) return true;
    if (/site_unreachable|forbidden/i.test(extended) && crawled < 10) return true;
  }

  if (crawled === 0 && /forbidden|blocked|unreachable/i.test(extended + ' ' + stop)) {
    return true;
  }

  // Tiny finished vs known sitemap budget (probe / wait)
  if (expectedPages >= 20) {
    const floor = Math.max(10, Math.floor(expectedPages * 0.05));
    if (crawled < floor) return true;
  }

  return false;
}

function parseArgs(argv) {
  const out = {
    domain: null,
    maxCrawlPages: 500,
    format: 'json',
    pollSeconds: 15,
    maxWaitMinutes: 10,
    maxQueueMinutes: 5,
    maxZeroProgressMinutes: 3,
    taskId: null,
    outputDir: null,
    domainSlug: null,
    minPages: null,
    resolveCanonical: true,
    projectDir: null,
    postOnly: false,
    forceSitemapOnly: null,
    enableJavascript: false,
    noAutoJavascript: false,
    userAgent: 'googlebot',
    probeBotBlock: true,
    noUaRetry: false,
    allowEmptyContent: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--domain' && argv[i + 1]) out.domain = argv[++i];
    else if (a === '--task-id' && argv[i + 1]) out.taskId = argv[++i];
    else if (a === '--max-crawl-pages' && argv[i + 1]) out.maxCrawlPages = Number(argv[++i]);
    else if (a === '--format' && argv[i + 1]) out.format = argv[++i];
    else if (a === '--poll-seconds' && argv[i + 1]) out.pollSeconds = Number(argv[++i]);
    else if (a === '--max-wait-minutes' && argv[i + 1]) out.maxWaitMinutes = Number(argv[++i]);
    else if (a === '--max-queue-minutes' && argv[i + 1]) out.maxQueueMinutes = Number(argv[++i]);
    else if (a === '--max-zero-progress-minutes' && argv[i + 1])
      out.maxZeroProgressMinutes = Number(argv[++i]);
    else if (a === '--min-pages' && argv[i + 1]) out.minPages = Number(argv[++i]);
    else if (a === '--project-dir' && argv[i + 1]) out.projectDir = argv[++i];
    else if (a === '--post-only') out.postOnly = true;
    else if (a === '--sitemap-only') out.forceSitemapOnly = true;
    else if (a === '--no-sitemap-only') out.forceSitemapOnly = false;
    else if (a === '--no-resolve-canonical') out.resolveCanonical = false;
    else if (a === '--enable-javascript') out.enableJavascript = true;
    else if (a === '--no-auto-javascript') out.noAutoJavascript = true;
    else if (a === '--user-agent' && argv[i + 1]) out.userAgent = argv[++i];
    else if (a === '--no-probe-bot-block') out.probeBotBlock = false;
    else if (a === '--no-ua-retry') out.noUaRetry = true;
    else if (a === '--allow-empty-content') out.allowEmptyContent = true;
    else if (a === '--output-dir' && argv[i + 1]) out.outputDir = argv[++i];
    else if (a === '--domain-slug' && argv[i + 1]) out.domainSlug = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function domainSlugFromHost(host) {
  if (!host || host === 'unknown') return 'unknown';
  return host.replace(/^www\./i, '').replace(/[^a-z0-9]+/gi, '');
}

/**
 * Per-client overrides from field-learnings.md (Golden Image `1.2-audit/` first, legacy fallback).
 */
function readProjectCrawlOverrides(projectDir, outputDir = null) {
  if (!projectDir) return {};
  const learningsPath = findFieldLearningsFile(projectDir, { outputDir });
  if (!learningsPath) return {};
  const text = fs.readFileSync(learningsPath, 'utf8');
  const out = {};
  if (/enable_javascript:\s*true/i.test(text)) out.enableJavascript = true;
  if (/no_sitemap_only:\s*true/i.test(text)) out.noSitemapOnly = true;
  const targetMatch = text.match(/crawl_target:\s*([a-z0-9.-]+)/i);
  if (targetMatch) out.crawlTarget = targetMatch[1].trim();
  if (/use_apex_target:\s*true/i.test(text)) out.useApexTarget = true;
  const uaMatch = text.match(/user_agent:\s*(googlebot|browser|chrome|[^\s]+)/i);
  if (uaMatch) out.userAgent = uaMatch[1].trim();
  return out;
}

function authHeader() {
  const u = process.env.DATAFORSEO_USERNAME;
  const p = process.env.DATAFORSEO_PASSWORD;
  if (!u || !p) {
    throw new Error('Missing DATAFORSEO_USERNAME or DATAFORSEO_PASSWORD in environment');
  }
  return 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');
}

async function dfsRequest(apiPath, { method = 'GET', body = null } = {}) {
  const res = await fetch(`${API}${apiPath}`, {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (json?.status_code !== 20000) {
    const msg = json?.status_message || res.statusText || 'Unknown API error';
    throw new Error(`DataForSEO ${apiPath}: ${msg} (${json?.status_code ?? res.status})`);
  }
  return json;
}

function buildTaskBody(crawlTarget, maxCrawlPages, crawlSitemapOnly, enableJavascript, userAgentString) {
  return [
    {
      target: crawlTarget,
      max_crawl_pages: maxCrawlPages,
      custom_user_agent: userAgentString,
      robots_txt_merge_mode: 'merge',
      respect_sitemap: true,
      crawl_sitemap_only: crawlSitemapOnly,
      load_resources: enableJavascript,
      enable_javascript: enableJavascript,
      enable_browser_rendering: false,
      calculate_keyword_density: false,
      check_spell: false,
    },
  ];
}

async function createTask(crawlTarget, maxCrawlPages, crawlSitemapOnly, enableJavascript, userAgentString) {
  const data = await dfsRequest('/on_page/task_post', {
    method: 'POST',
    body: buildTaskBody(
      crawlTarget,
      maxCrawlPages,
      crawlSitemapOnly,
      enableJavascript,
      userAgentString
    ),
  });
  const task = data.tasks?.[0];
  if (!task?.id) throw new Error('task_post did not return a task id');
  if (task.status_code !== 20100 && task.status_code !== 20000) {
    throw new Error(`task_post failed: ${task.status_message} (${task.status_code})`);
  }
  return task.id;
}

class BotBlockError extends Error {
  constructor(taskId, extendedStatus, result) {
    const crawled = pagesCrawledOf(result);
    super(
      `BOT_BLOCK: task ${taskId} finished with pages_crawled=${crawled} ` +
        `(extended_crawl_status=${extendedStatus}). ` +
        `WAF/unreachable likely blocked Googlebot — retry with --user-agent browser before instant_pages.`
    );
    this.name = 'BotBlockError';
    this.taskId = taskId;
    this.extendedStatus = extendedStatus;
    this.result = result;
  }
}

/**
 * After post-only: poll briefly for finished bot-block / tiny crawl; if so, re-post with browser UA once.
 */
async function probeAndMaybeRetryUa({
  taskId,
  crawlTarget,
  maxCrawlPages,
  crawlSitemapOnly,
  enableJavascript,
  uaInfo,
  allowRetry,
  expectedPages = 0,
}) {
  const started = Date.now();
  let currentId = taskId;
  let currentUa = uaInfo;
  let priorTaskId = null;
  let uaRetried = false;
  let lastResult = null;

  while (Date.now() - started < BOT_BLOCK_PROBE_MAX_MS) {
    const { result } = await getSummary(currentId);
    lastResult = result;
    const progress = result?.crawl_progress ?? 'unknown';
    const crawled =
      result?.crawl_status?.pages_crawled ?? result?.crawl_status?.pages_count ?? '?';
    const elapsedSec = Math.round((Date.now() - started) / 1000);
    process.stderr.write(
      `[dataforseo] bot_probe elapsed=${elapsedSec}s progress=${progress} pages=${crawled} ua=${currentUa.label}\n`
    );

    if (progress === 'finished') {
      if (isBotBlockResult(result, expectedPages)) {
        const extended = result?.domain_info?.extended_crawl_status ?? 'unknown';
        process.stderr.write(
          `[dataforseo] BOT_BLOCK detected extended=${extended} pages=${crawled} expected~${expectedPages} ua=${currentUa.label}\n`
        );
        if (allowRetry && currentUa.label === 'googlebot') {
          const nextUa = resolveUserAgent('browser');
          process.stderr.write(
            `[dataforseo] auto-retry task_post with user_agent=browser (was googlebot)\n`
          );
          priorTaskId = currentId;
          currentId = await createTask(
            crawlTarget,
            maxCrawlPages,
            crawlSitemapOnly,
            enableJavascript,
            nextUa.ua
          );
          currentUa = nextUa;
          uaRetried = true;
          process.stderr.write(`[dataforseo] retry_task_id=${currentId}\n`);
          // Continue probe on the new task (may finish fast too)
          continue;
        }
        throw new BotBlockError(currentId, extended, result);
      }
      // Finished with pages or benign status — ready for wait/deliver
      return {
        taskId: currentId,
        uaInfo: currentUa,
        priorTaskId,
        uaRetried,
        probeFinished: true,
        result,
      };
    }

    await new Promise((r) => setTimeout(r, BOT_BLOCK_PROBE_POLL_MS));
  }

  process.stderr.write(
    `[dataforseo] bot_probe timeout=${BOT_BLOCK_PROBE_MAX_MS / 1000}s still_in_progress task_id=${currentId}\n`
  );
  return {
    taskId: currentId,
    uaInfo: currentUa,
    priorTaskId,
    uaRetried,
    probeFinished: false,
    result: lastResult,
  };
}

async function getSummary(taskId) {
  const data = await dfsRequest(`/on_page/summary/${taskId}`);
  const task = data.tasks?.[0];
  const result = task?.result?.[0] ?? null;
  return { task, result };
}

async function forceStopTask(taskId) {
  await dfsRequest('/on_page/force_stop', { method: 'POST', body: [{ id: taskId }] });
}

async function waitForCrawl(
  taskId,
  pollSeconds,
  maxWaitMinutes,
  maxQueueMinutes,
  maxZeroProgressMinutes,
  expectedPages = 0
) {
  const deadline = Date.now() + maxWaitMinutes * 60 * 1000;
  const queueDeadline = Date.now() + maxQueueMinutes * 60 * 1000;
  const zeroProgressDeadline =
    Date.now() + maxZeroProgressMinutes * 60 * 1000;
  let sawInProgress = false;
  let lastCrawled = null;
  let idlePolls = 0;
  let forceStopSent = false;
  let forceStopAt = null;
  let zeroProgressSince = null;
  const waitStarted = Date.now();

  while (Date.now() < deadline) {
    const { task, result } = await getSummary(taskId);
    const progress = result?.crawl_progress;
    const crawled = result?.crawl_status?.pages_crawled ?? result?.crawl_status?.pages_count;
    const inQueue = result?.crawl_status?.pages_in_queue ?? 0;
    const taskStatus = task?.status_code;
    if (progress === 'in_progress' || taskStatus === 40601) sawInProgress = true;

    const elapsedSec = Math.round((Date.now() - waitStarted) / 1000);
    const remainSec = Math.max(0, Math.round((deadline - Date.now()) / 1000));
    process.stderr.write(
      `[dataforseo] status=${taskStatus} crawl_progress=${progress ?? 'unknown'} pages=${crawled ?? '?'} queue=${inQueue} elapsed=${elapsedSec}s remain~${remainSec}s\n`
    );

    if (progress === 'finished') {
      if (isBotBlockResult(result, expectedPages)) {
        const extended = result?.domain_info?.extended_crawl_status ?? 'unknown';
        throw new BotBlockError(taskId, extended, result);
      }
      const extended = result?.domain_info?.extended_crawl_status;
      if (extended && extended !== 'no_errors') {
        throw new Error(`Crawl finished with status: ${extended}`);
      }
      return { task, result };
    }

    if (taskStatus >= 50000) {
      throw new Error(`Crawl task failed: ${task.status_message} (${taskStatus})`);
    }

    if (!sawInProgress && taskStatus === 40602 && Date.now() > queueDeadline) {
      throw new Error(
        `DataForSEO queue stall: task ${taskId} stayed in queue (40602) for ${maxQueueMinutes} minutes. ` +
          `Check: node scripts/check-task.mjs --task-id ${taskId}`
      );
    }

    const crawledNum = typeof crawled === 'number' ? crawled : 0;
    const zeroProgress =
      progress === 'in_progress' && inQueue === 0 && crawledNum === 0;

    if (zeroProgress) {
      if (zeroProgressSince == null) zeroProgressSince = Date.now();
      if (
        !forceStopSent &&
        Date.now() >= zeroProgressDeadline
      ) {
        process.stderr.write(
          `[dataforseo] zero_progress ${maxZeroProgressMinutes}m pages=0 queue=0 → force_stop\n`
        );
        await forceStopTask(taskId);
        forceStopSent = true;
        forceStopAt = Date.now();
        await new Promise((r) => setTimeout(r, pollSeconds * 1000));
        continue;
      }
      if (
        forceStopSent &&
        forceStopAt &&
        Date.now() - forceStopAt >= ZERO_PROGRESS_GIVE_UP_AFTER_MS &&
        progress === 'in_progress'
      ) {
        throw new Error(
          `DataForSEO zero-progress zombie: task ${taskId} still in_progress with 0 pages after force_stop. ` +
            `Try --no-sitemap-only on a new crawl or open a DataForSEO ticket. ` +
            `Check: node scripts/check-task.mjs --task-id ${taskId}`
        );
      }
    } else {
      zeroProgressSince = null;
    }

    if (progress === 'in_progress' && inQueue === 0 && crawledNum > 0) {
      if (lastCrawled === crawledNum) idlePolls += 1;
      else {
        idlePolls = 0;
        lastCrawled = crawledNum;
      }
      if (!forceStopSent && idlePolls >= IDLE_POLLS_BEFORE_FORCE_STOP) {
        process.stderr.write(
          `[dataforseo] queue_empty_idle polls=${idlePolls} crawled=${crawledNum} → force_stop\n`
        );
        await forceStopTask(taskId);
        forceStopSent = true;
        forceStopAt = Date.now();
        idlePolls = 0;
        await new Promise((r) => setTimeout(r, pollSeconds * 1000));
        continue;
      }
    } else if (!zeroProgress) {
      idlePolls = 0;
      if (typeof crawled === 'number') lastCrawled = crawled;
    }

    if (
      forceStopSent &&
      forceStopAt &&
      !zeroProgress &&
      Date.now() - forceStopAt >= ZERO_PROGRESS_FORCE_STOP_AFTER_MS &&
      progress === 'in_progress'
    ) {
      const { result: afterStop } = await getSummary(taskId);
      if (afterStop?.crawl_progress !== 'finished') {
        throw new Error(
          `Crawl stuck after force_stop (task_id=${taskId}, pages=${crawled ?? '?'}). ` +
            `Check: node scripts/check-task.mjs --task-id ${taskId}`
        );
      }
      return { task, result: afterStop };
    }

    await new Promise((r) => setTimeout(r, pollSeconds * 1000));
  }

  throw new Error(
    `Timed out after ${maxWaitMinutes} minutes (task_id=${taskId}). ` +
      `Check: node scripts/check-task.mjs --task-id ${taskId}`
  );
}

async function fetchAllPages(taskId) {
  const limit = 1000;
  const filters = [['resource_type', '=', 'html']];
  const all = [];
  let offset = 0;
  let searchAfterToken = null;

  while (true) {
    const payload = searchAfterToken
      ? [{ id: taskId, limit, search_after_token: searchAfterToken, filters }]
      : [{ id: taskId, limit, offset, filters }];

    const data = await dfsRequest('/on_page/pages', { method: 'POST', body: payload });
    const block = data.tasks?.[0]?.result?.[0];
    const items = block?.items ?? [];
    all.push(...items);

    const nextToken = block?.search_after_token;
    if (nextToken) {
      searchAfterToken = nextToken;
      continue;
    }
    if (items.length < limit) break;
    offset += limit;
  }

  return all;
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
  if (h1.length === 0) h1Headings = null;
  else if (h1.length === 1) h1Headings = h1[0];
  else h1Headings = h1;

  return {
    url: normalizeField(item?.url ?? null),
    meta_title: normalizeField(meta.meta_title ?? meta.title ?? null),
    h1_count: h1.length,
    h1_headings: normalizeField(h1Headings),
    h2_h6_count: h2h6,
    word_count: meta.content?.plain_text_word_count ?? null,
    is_orphan_page: item?.is_orphan_page ?? null,
  };
}

function cellValue(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return normalizeText(v.join(' | '));
  return normalizeText(String(v));
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

function toMarkdownTable(rows) {
  const headers = ROW_HEADERS;
  const esc = (v) => {
    if (v == null || v === '') return '';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    const s = Array.isArray(v)
      ? v.map((x) => normalizeText(String(x))).join(' | ')
      : normalizeText(String(v));
    return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  };
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${headers.map((h) => esc(r[h])).join(' | ')} |`),
  ];
  return lines.join('\n');
}

function toCsv(rows) {
  const headers = ROW_HEADERS;
  const q = (v) => {
    if (v == null || v === '') return '';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    const s = Array.isArray(v) ? v.map((x) => normalizeText(String(x))).join(' | ') : normalizeText(String(v));
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => q(r[h])).join(','))].join('\n');
}

function logPlan(plan) {
  process.stderr.write(`[dataforseo] input_host=${plan.inputHost}\n`);
  if (plan.dossierHost) process.stderr.write(`[dataforseo] dossier_host=${plan.dossierHost}\n`);
  process.stderr.write(`[dataforseo] live_host=${plan.liveHost}\n`);
  process.stderr.write(`[dataforseo] crawl_target=${plan.crawlTarget}\n`);
  process.stderr.write(`[dataforseo] canonical_url=${plan.canonicalUrl}\n`);
  if (plan.sitemapUrl) {
    process.stderr.write(
      `[dataforseo] sitemap=${plan.sitemapUrl} urls=${plan.sitemapUrlCount} sitemap_only=${plan.crawlSitemapOnly}\n`
    );
  }
  if (plan.sitemapChildUrls?.length) {
    process.stderr.write(
      `[dataforseo] sitemap_children=${plan.sitemapChildUrls.length}\n`
    );
  }
  if (plan.jsProbe) {
    process.stderr.write(
      `[dataforseo] js_probe url=${plan.jsProbe.probeUrl} plain_words=${plan.jsProbe.plainTextWords} js_required=${plan.jsRequiredRecommended}\n`
    );
  }
  for (const w of plan.warnings) {
    process.stderr.write(`[dataforseo] warn=${w}\n`);
  }
}

function printHelp() {
  console.log(`Usage: node crawl-domain.mjs --domain example.com [options]

Options:
  --domain               Required unless --task-id (resume/deliverables).
  --project-dir          Campaign folder; reads *Dossier.md from outputs/business-dossier/ (legacy root fallback).
  --task-id              Resume existing task (skip task_post).
  --post-only            Post task + print JSON; do not poll full crawl (fast handoff).
  --user-agent           googlebot (default) | browser | custom UA string.
  --no-probe-bot-block   With --post-only: skip short probe / Googlebot→browser auto-retry.
  --no-ua-retry          Never auto-repost with browser UA on BOT_BLOCK.
  --allow-empty-content  Write CSV even if ~all rows lack title/words (debug only).
  --max-crawl-pages      Page budget (auto-capped from sitemap when small).
  --sitemap-only         Force crawl_sitemap_only=true.
  --no-sitemap-only      Force crawl_sitemap_only=false.
  --output-dir           Write .csv + .xlsx deliverables (default: {project-dir}/outputs/dataforseo-onpage-crawl/).
  --poll-seconds         Default 15.
  --max-wait-minutes     Default 10 (after queue clears, force_stop if idle).
  --max-queue-minutes    Fail if stuck at 40602 (default 5).
  --max-zero-progress-minutes  force_stop then fail if still 0 pages (default 3).
  --min-pages            Refuse deliverables below N (auto from sitemap when omitted).
  --no-resolve-canonical Use --domain as target (not recommended).
  --enable-javascript    Force enable_javascript + load_resources on task_post.
  --no-auto-javascript   Disable auto JS when probe recommends it.

Requires DATAFORSEO_USERNAME and DATAFORSEO_PASSWORD.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  let inputDomain = normalizeHost(args.domain);

  if (args.projectDir && !args.taskId) {
    const { website } = assertDossierForCrawl(args.projectDir);
    if (!inputDomain) {
      try {
        inputDomain = normalizeHost(new URL(website).hostname);
      } catch {
        throw new Error(`Invalid Official Website in dossier: ${website}`);
      }
    }
  }

  if (!args.taskId && !inputDomain) {
    console.error('Error: --domain is required unless --task-id or --project-dir with dossier is provided');
    printHelp();
    process.exit(1);
  }

  if (args.projectDir && !args.outputDir) {
    args.outputDir = resolveCrawlOutputDir(args.projectDir);
  }

  let plan = null;
  let crawlTarget = inputDomain;
  let crawlSitemapOnly = false;
  let maxCrawlPages = args.maxCrawlPages;
  let minPages = args.minPages ?? 2;

  const projectOverrides = args.projectDir
    ? readProjectCrawlOverrides(args.projectDir, args.outputDir)
    : {};

  if (!args.taskId && inputDomain && args.resolveCanonical) {
    const dossierWebsite = args.projectDir ? readDossierWebsite(args.projectDir) : null;
    plan = await planCrawlTarget(inputDomain, { dossierWebsite });
    logPlan(plan);
    crawlTarget = plan.crawlTarget;
    if (args.forceSitemapOnly === true) crawlSitemapOnly = true;
    else if (args.forceSitemapOnly === false) crawlSitemapOnly = false;
    else crawlSitemapOnly = plan.crawlSitemapOnly;

    if (plan.sitemapUrlCount > 0 && maxCrawlPages === 500) {
      maxCrawlPages = plan.maxCrawlPagesSuggested;
    }
    if (args.minPages == null) minPages = plan.minPagesSuggested;
    if (!args.noAutoJavascript && plan.jsRequiredRecommended && !args.enableJavascript) {
      args.enableJavascript = true;
      process.stderr.write('[dataforseo] auto enable_javascript=true (JS probe)\n');
    }
  } else if (!args.taskId) {
    crawlTarget = inputDomain;
    if (args.forceSitemapOnly === true) crawlSitemapOnly = true;
  }

  if (!args.taskId && Object.keys(projectOverrides).length) {
    if (projectOverrides.enableJavascript && !args.noAutoJavascript) {
      args.enableJavascript = true;
      process.stderr.write('[dataforseo] auto enable_javascript=true (field-learnings.md)\n');
    }
    if (projectOverrides.noSitemapOnly) crawlSitemapOnly = false;
    if (projectOverrides.crawlTarget) crawlTarget = projectOverrides.crawlTarget;
    else if (projectOverrides.useApexTarget) {
      crawlTarget = crawlTarget.replace(/^www\./i, '');
    }
    if (projectOverrides.userAgent && args.userAgent === 'googlebot') {
      args.userAgent = projectOverrides.userAgent;
      process.stderr.write(`[dataforseo] user_agent=${args.userAgent} (field-learnings.md)\n`);
    }
  }

  let uaInfo = resolveUserAgent(args.userAgent);
  let priorTaskId = null;
  let uaRetried = false;

  let taskId = args.taskId;
  if (!taskId) {
    taskId = await createTask(
      crawlTarget,
      maxCrawlPages,
      crawlSitemapOnly,
      args.enableJavascript,
      uaInfo.ua
    );
  }
  const targetDomain = crawlTarget ?? inputDomain ?? 'unknown';
  process.stderr.write(
    `[dataforseo] task_id=${taskId} target=${targetDomain} sitemap_only=${crawlSitemapOnly} js=${args.enableJavascript} ua=${uaInfo.label} max_pages=${maxCrawlPages}\n`
  );

  if (args.postOnly) {
    if (args.probeBotBlock && !args.taskId) {
      const probed = await probeAndMaybeRetryUa({
        taskId,
        crawlTarget: targetDomain,
        maxCrawlPages,
        crawlSitemapOnly,
        enableJavascript: args.enableJavascript,
        uaInfo,
        allowRetry: !args.noUaRetry,
        expectedPages: plan?.sitemapUrlCount ?? maxCrawlPages ?? 0,
      });
      taskId = probed.taskId;
      uaInfo = probed.uaInfo;
      priorTaskId = probed.priorTaskId;
      uaRetried = probed.uaRetried;
    }
    console.log(
      JSON.stringify(
        {
          task_id: taskId,
          crawl_target: targetDomain,
          canonical_url: plan?.canonicalUrl ?? `https://${targetDomain}/`,
          sitemap_url: plan?.sitemapUrl ?? null,
          sitemap_url_count: plan?.sitemapUrlCount ?? null,
          crawl_sitemap_only: crawlSitemapOnly,
          enable_javascript: args.enableJavascript,
          js_auto_enabled: Boolean(plan?.jsRequiredRecommended && args.enableJavascript),
          user_agent: uaInfo.label,
          ua_retried: uaRetried,
          prior_task_id: priorTaskId,
          max_crawl_pages: maxCrawlPages,
          min_pages: minPages,
          post_only: true,
        },
        null,
        2
      )
    );
    return;
  }

  let summary;
  try {
    ({ result: summary } = await waitForCrawl(
      taskId,
      args.pollSeconds,
      args.maxWaitMinutes,
      args.maxQueueMinutes,
      args.maxZeroProgressMinutes,
      plan?.sitemapUrlCount ?? minPages ?? 0
    ));
  } catch (err) {
    if (
      err instanceof BotBlockError &&
      !args.noUaRetry &&
      uaInfo.label === 'googlebot' &&
      !args.taskId
    ) {
      process.stderr.write(
        `[dataforseo] BOT_BLOCK on wait → re-post with user_agent=browser (prior=${taskId})\n`
      );
      priorTaskId = taskId;
      uaInfo = resolveUserAgent('browser');
      taskId = await createTask(
        targetDomain,
        maxCrawlPages,
        crawlSitemapOnly,
        args.enableJavascript,
        uaInfo.ua
      );
      uaRetried = true;
      process.stderr.write(`[dataforseo] retry_task_id=${taskId} ua=${uaInfo.label}\n`);
      ({ result: summary } = await waitForCrawl(
        taskId,
        args.pollSeconds,
        args.maxWaitMinutes,
        args.maxQueueMinutes,
        args.maxZeroProgressMinutes,
        plan?.sitemapUrlCount ?? minPages ?? 0
      ));
    } else {
      throw err;
    }
  }
  const items = await fetchAllPages(taskId);
  const rows = items.map(leanRow);
  const pagesCrawled = summary?.crawl_status?.pages_crawled ?? null;

  if (rows.length < minPages) {
    throw new Error(
      `Only ${rows.length} HTML page(s) returned (pages_crawled=${pagesCrawled ?? '?'}, min=${minPages}). ` +
        `Not writing deliverables. task_id=${taskId}`
    );
  }

  const contentStats = assertDeliverableContent(rows, {
    allowEmptyContent: args.allowEmptyContent,
    context: `task_id=${taskId}`,
  });
  process.stderr.write(
    `[dataforseo] content_quality n=${contentStats.n} with_title=${contentStats.with_title} with_words=${contentStats.with_words} content_ratio=${contentStats.content_ratio.toFixed(3)}\n`
  );

  const slug = args.domainSlug ?? domainSlugFromHost(targetDomain);
  const payload = {
    task_id: taskId,
    domain: targetDomain,
    canonical_url: plan?.canonicalUrl ?? `https://${targetDomain}/`,
    domain_slug: slug,
    max_crawl_pages: maxCrawlPages,
    crawl_sitemap_only: crawlSitemapOnly,
    enable_javascript: args.enableJavascript,
    user_agent: uaInfo.label,
    ua_retried: uaRetried,
    prior_task_id: priorTaskId,
    sitemap_url_count: plan?.sitemapUrlCount ?? null,
    pages_returned: rows.length,
    content_quality: contentStats,
    crawl_status: summary?.crawl_status ?? null,
    rows,
  };

  if (args.outputDir) {
    const written = writeDeliverables(args.outputDir, slug, rows);
    console.log(
      JSON.stringify(
        {
          ...payload,
          rows: undefined,
          written: [written.csvPath, written.xlsxPath],
          deliverable_base: written.base,
        },
        null,
        2
      )
    );
    return;
  }

  if (args.format === 'markdown') {
    console.log(`# OnPage crawl: ${targetDomain}\n`);
    console.log(`Task ID: ${taskId}`);
    console.log(`Pages: ${rows.length}\n`);
    console.log(toMarkdownTable(rows));
  } else if (args.format === 'csv') {
    console.log(toCsv(rows));
  } else {
    console.log(JSON.stringify(payload, null, 2));
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
