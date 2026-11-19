#!/usr/bin/env node
/**
 * DataForSEO OnPage full-domain crawl → lean 7-field rows.
 * Reads DATAFORSEO_USERNAME / DATAFORSEO_PASSWORD from env.
 *
 * Pre-flight (resolve-site.mjs): canonical host, sitemap, JS probe, orphan/sitemap rules.
 * Polling exits immediately when crawl_progress=finished.
 * in_progress with pages_crawled=0 force_stops after max-zero-progress-minutes
 * even when pages_in_queue is still above 0, then Instant Pages runs in this
 * process. onpage-live is one exec and cannot start the fallback itself.
 * See docs/solutions/onpage-js-and-stall-fix.md for incident learnings
 * (Summit 2026-06 JS/stall; Northside Care 2026-07 Googlebot WAF;
 *  Harborview 2026-08-10 bot_block / stuck-zero / overlapping posts).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { isInProgressZeroCrawl } from './crawl-stall.mjs';
import { runSitemapInstantFallback } from './sitemap-instant-fallback.mjs';
import { normalizeField, normalizeText } from './text-normalize.mjs';
import { normalizeHost, planCrawlTarget } from './resolve-site.mjs';
import { assertDeliverableContent } from './content-quality.mjs';
import {
  assertDossierForCrawl,
  findFieldLearningsFile,
  readDossierWebsite,
  resolveCrawlOutputDir,
} from '../../../scripts/seo/lib/dossier-firmographics.mjs';
import {
  clearActiveTask,
  ensureBrowserUaLearning,
  hostKey,
  readActiveTask,
  writeActiveTask,
} from './active-task.mjs';

const API = 'https://api.dataforseo.com/v3';
const SITEMAP_ONLY_MAX_URLS = 30;
const IDLE_POLLS_BEFORE_FORCE_STOP = 3;
const ZERO_PROGRESS_FORCE_STOP_AFTER_MS = 90 * 1000;
/** Short post-only window: bot blocks often finish in <10s (Northside Care ~6s). */
const BOT_BLOCK_PROBE_MAX_MS = 90 * 1000;
const BOT_BLOCK_PROBE_POLL_MS = 5 * 1000;
/** Minimum wait when sitemap budget is known (forbid fake 1-min failures). */
const MIN_WAIT_MINUTES_WITH_EXPECTED = 12;

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
 * Northside Care: forbidden_http_header (0 pages) OR site_unreachable (1 page) vs ~390 sitemap.
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
    maxWaitMinutes: 15,
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
    forceNewTask: false,
    allowShortWait: false,
    allowPathSubstrings: [],
    denyPathSubstrings: [],
    includeHome: false,
    excludeSitemapChildren: [],
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
    else if (a === '--force-new-task') out.forceNewTask = true;
    else if (a === '--allow-short-wait') out.allowShortWait = true;
    else if (a === '--allow-url-path' && argv[i + 1]) out.allowPathSubstrings.push(argv[++i]);
    else if (a === '--deny-url-path' && argv[i + 1]) out.denyPathSubstrings.push(argv[++i]);
    else if (a === '--include-home') out.includeHome = true;
    else if (a === '--exclude-sitemap-child' && argv[i + 1]) {
      out.excludeSitemapChildren.push(
        ...String(argv[++i])
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
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
 * Per-client overrides from field-learnings.md (campaign layout `1.2-audit/` first, legacy fallback).
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
  const startUrlMatch = text.match(/start_url:\s*(\S+)/i);
  if (startUrlMatch) out.startUrl = startUrlMatch[1].trim();
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

function robotsTxtFromDenyPaths(denyPathSubstrings) {
  const lines = ['User-agent: *'];
  const seen = new Set();
  for (const raw of denyPathSubstrings || []) {
    const p = String(raw || '').trim();
    if (!p) continue;
    const path = p.startsWith('/') ? p : `/${p}`;
    if (seen.has(path)) continue;
    seen.add(path);
    lines.push(`Disallow: ${path}`);
  }
  if (![...seen].some((p) => p.includes('/blogs'))) lines.push('Disallow: /blogs/');
  return lines.join('\n');
}

function buildTaskBody(
  crawlTarget,
  maxCrawlPages,
  crawlSitemapOnly,
  enableJavascript,
  userAgentString,
  extras = {},
) {
  const task = {
    target: crawlTarget,
    max_crawl_pages: maxCrawlPages,
    custom_user_agent: userAgentString,
    robots_txt_merge_mode: extras.robotsTxtMergeMode || 'merge',
    respect_sitemap: true,
    crawl_sitemap_only: crawlSitemapOnly,
    load_resources: enableJavascript,
    enable_javascript: enableJavascript,
    enable_browser_rendering: false,
    calculate_keyword_density: false,
    check_spell: false,
  };
  if (extras.startUrl) task.start_url = extras.startUrl;
  // priority_urls removed — DataForSEO task_post returns 40501 Invalid Field (2026-09).
  if (extras.customRobotsTxt) task.custom_robots_txt = extras.customRobotsTxt;
  return [task];
}

async function createTask(
  crawlTarget,
  maxCrawlPages,
  crawlSitemapOnly,
  enableJavascript,
  userAgentString,
  extras = {},
) {
  const data = await dfsRequest('/on_page/task_post', {
    method: 'POST',
    body: buildTaskBody(
      crawlTarget,
      maxCrawlPages,
      crawlSitemapOnly,
      enableJavascript,
      userAgentString,
      extras,
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
  constructor(taskId, extendedStatus, result, { escalate = false } = {}) {
    const crawled = pagesCrawledOf(result);
    super(
      escalate
        ? `BOT_BLOCK (browser UA already tried): task ${taskId} pages_crawled=${crawled} ` +
            `(extended_crawl_status=${extendedStatus}). Escalate to sitemap-instant-fallback.mjs ` +
            `(force_stop this task first). Do not post a third domain crawl.`
        : `BOT_BLOCK: task ${taskId} finished with pages_crawled=${crawled} ` +
            `(extended_crawl_status=${extendedStatus}). ` +
            `WAF/unreachable likely blocked Googlebot — retry with --user-agent browser before instant_pages.`
    );
    this.name = 'BotBlockError';
    this.taskId = taskId;
    this.extendedStatus = extendedStatus;
    this.result = result;
    this.escalate_to_instant_fallback = escalate;
  }
}

class StuckZeroError extends Error {
  constructor(taskId, detail = '') {
    super(
      `STUCK_ZERO: task ${taskId} stayed pages_crawled=0 after force_stop. ` +
        `Escalate to sitemap-instant-fallback.mjs — do not post another domain crawl. ${detail}`.trim()
    );
    this.name = 'StuckZeroError';
    this.taskId = taskId;
    this.escalate_to_instant_fallback = true;
  }
}

async function forceStopQuiet(taskId) {
  if (!taskId) return false;
  try {
    await forceStopTask(taskId);
    process.stderr.write(`[dataforseo] force_stop ok task_id=${taskId}\n`);
    return true;
  } catch (err) {
    process.stderr.write(
      `[dataforseo] force_stop warn task_id=${taskId}: ${err.message}\n`
    );
    return false;
  }
}

/**
 * Refuse overlapping --post-only while same-host task is in_progress / queued.
 * --force-new-task force_stops the prior task first.
 */
async function gateOverlappingPost({ outputDir, host, forceNewTask }) {
  if (!outputDir) return { priorStopped: null };
  const active = readActiveTask(outputDir);
  if (!active?.task_id) return { priorStopped: null };
  if (hostKey(active.host) !== hostKey(host)) return { priorStopped: null };

  let stillActive = true;
  try {
    const { task, result } = await getSummary(active.task_id);
    const progress = result?.crawl_progress;
    const code = task?.status_code;
    stillActive =
      progress === 'in_progress' ||
      code === 40601 ||
      code === 40602 ||
      (progress == null && code != null && code < 50000 && code !== 20100 && code !== 20000);
    if (progress === 'finished' || (code != null && code >= 50000)) stillActive = false;
  } catch {
    stillActive = true; // fail closed — require force or clear
  }

  if (!stillActive) {
    clearActiveTask(outputDir);
    return { priorStopped: null };
  }

  if (!forceNewTask) {
    throw new Error(
      `ACTIVE_TASK: host ${hostKey(host)} already has task_id=${active.task_id} ` +
        `(status=${active.status ?? 'in_progress'}). ` +
        `Wait with check-task.mjs --wait --expected-pages N --max-wait-minutes 15, ` +
        `or pass --force-new-task (force_stops the old task first). ` +
        `Do not open a second overlapping --post-only.`
    );
  }

  process.stderr.write(
    `[dataforseo] --force-new-task: force_stop prior ${active.task_id} before new post\n`
  );
  await forceStopQuiet(active.task_id);
  clearActiveTask(outputDir);
  return { priorStopped: active.task_id };
}

function persistActive(outputDir, taskId, host, userAgent) {
  if (!outputDir || !taskId) return null;
  return writeActiveTask(outputDir, {
    task_id: taskId,
    host,
    user_agent: userAgent,
    status: 'in_progress',
  });
}

function recordBrowserUaLearning(projectDir, outputDir) {
  const res = ensureBrowserUaLearning(projectDir, outputDir);
  if (res.wrote) {
    process.stderr.write(
      `[dataforseo] wrote field-learnings user_agent: browser → ${res.path}\n`
    );
  }
  return res;
}

/**
 * After post-only: poll briefly for finished bot-block / tiny crawl; if so, re-post with browser UA once.
 * progress=unknown (or null summary / 40602 limbo) for the full probe window soft-fails → browser UA
 * (Harborview 2026-08-10). Always force_stop the prior Googlebot task before the retry post.
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
  projectDir = null,
  outputDir = null,
  taskExtras = {},
}) {
  let started = Date.now();
  let currentId = taskId;
  let currentUa = uaInfo;
  let priorTaskId = null;
  let uaRetried = false;
  let lastResult = null;
  let lastTaskStatus = null;
  let sawKnownProgress = false;

  async function switchToBrowser(reason) {
    process.stderr.write(
      `[dataforseo] BOT_BLOCK soft-fail (${reason}) ua=${currentUa.label} → browser UA\n`
    );
    if (currentUa.label === 'googlebot') {
      recordBrowserUaLearning(projectDir, outputDir);
    }
    await forceStopQuiet(currentId);
    const nextUa = resolveUserAgent('browser');
    priorTaskId = currentId;
    currentId = await createTask(
      crawlTarget,
      maxCrawlPages,
      crawlSitemapOnly,
      enableJavascript,
      nextUa.ua,
      taskExtras,
    );
    currentUa = nextUa;
    uaRetried = true;
    persistActive(outputDir, currentId, crawlTarget, currentUa.label);
    process.stderr.write(`[dataforseo] retry_task_id=${currentId}\n`);
    started = Date.now();
    sawKnownProgress = false;
    lastResult = null;
    lastTaskStatus = null;
  }

  while (Date.now() - started < BOT_BLOCK_PROBE_MAX_MS) {
    const { task, result } = await getSummary(currentId);
    lastResult = result;
    lastTaskStatus = task?.status_code ?? null;
    const progress = result?.crawl_progress ?? 'unknown';
    if (progress === 'finished' || progress === 'in_progress') sawKnownProgress = true;
    const crawled =
      result?.crawl_status?.pages_crawled ?? result?.crawl_status?.pages_count ?? '?';
    const elapsedSec = Math.round((Date.now() - started) / 1000);
    process.stderr.write(
      `[dataforseo] bot_probe elapsed=${elapsedSec}s status=${lastTaskStatus ?? '?'} progress=${progress} pages=${crawled} ua=${currentUa.label}\n`
    );

    if (progress === 'finished') {
      if (isBotBlockResult(result, expectedPages)) {
        const extended = result?.domain_info?.extended_crawl_status ?? 'unknown';
        process.stderr.write(
          `[dataforseo] BOT_BLOCK detected extended=${extended} pages=${crawled} expected~${expectedPages} ua=${currentUa.label}\n`
        );
        if (allowRetry && currentUa.label === 'googlebot' && !uaRetried) {
          await switchToBrowser(`finished:${extended}`);
          continue;
        }
        throw new BotBlockError(currentId, extended, result, {
          escalate: currentUa.label !== 'googlebot' || uaRetried,
        });
      }
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

  const finalProgress = lastResult?.crawl_progress ?? 'unknown';
  const unknownLimbo =
    !sawKnownProgress ||
    finalProgress === 'unknown' ||
    (lastResult == null && (lastTaskStatus === 40602 || lastTaskStatus == null));

  if (allowRetry && currentUa.label === 'googlebot' && !uaRetried && unknownLimbo) {
    await switchToBrowser(
      `progress=${finalProgress} status=${lastTaskStatus ?? 'null'} for full ${BOT_BLOCK_PROBE_MAX_MS / 1000}s`
    );
    // One short confirmation loop on browser task (do not 40602-limbo again)
    const browserProbeStarted = Date.now();
    while (Date.now() - browserProbeStarted < BOT_BLOCK_PROBE_MAX_MS) {
      const { task, result } = await getSummary(currentId);
      lastResult = result;
      lastTaskStatus = task?.status_code ?? null;
      const progress = result?.crawl_progress ?? 'unknown';
      const crawled =
        result?.crawl_status?.pages_crawled ?? result?.crawl_status?.pages_count ?? '?';
      const elapsedSec = Math.round((Date.now() - browserProbeStarted) / 1000);
      process.stderr.write(
        `[dataforseo] bot_probe elapsed=${elapsedSec}s status=${lastTaskStatus ?? '?'} progress=${progress} pages=${crawled} ua=${currentUa.label}\n`
      );
      if (progress === 'finished') {
        if (isBotBlockResult(result, expectedPages)) {
          const extended = result?.domain_info?.extended_crawl_status ?? 'unknown';
          throw new BotBlockError(currentId, extended, result, { escalate: true });
        }
        return {
          taskId: currentId,
          uaInfo: currentUa,
          priorTaskId,
          uaRetried,
          probeFinished: true,
          result,
        };
      }
      if (progress === 'in_progress') break;
      await new Promise((r) => setTimeout(r, BOT_BLOCK_PROBE_POLL_MS));
    }
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
  const zeroProgressMs = maxZeroProgressMinutes * 60 * 1000;
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
    const zeroProgress = isInProgressZeroCrawl(progress, crawled);

    if (zeroProgress) {
      if (zeroProgressSince == null) {
        zeroProgressSince = Date.now();
        process.stderr.write(
          `[dataforseo] zero_crawl pages=0 queue=${inQueue} → force_stop if still 0 after ${maxZeroProgressMinutes}m\n`
        );
      }
      if (!forceStopSent && Date.now() - zeroProgressSince >= zeroProgressMs) {
        process.stderr.write(
          `[dataforseo] zero_progress ${maxZeroProgressMinutes}m pages=0 queue=${inQueue} → force_stop + instant_pages\n`
        );
        try {
          await forceStopTask(taskId);
        } catch (stopErr) {
          process.stderr.write(
            `[dataforseo] force_stop warn task_id=${taskId}: ${stopErr.message}\n`
          );
        }
        throw new StuckZeroError(taskId, `queue=${inQueue}`);
      }
    } else if (crawledNum > 0) {
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
        if ((crawled ?? 0) === 0) {
          throw new StuckZeroError(
            taskId,
            `pages=${crawled ?? '?'}. Check: node scripts/check-task.mjs --task-id ${taskId}`
          );
        }
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

/** Apex/www + trailing-slash fold so sitemap loc and DFS item.url can match. */
function sitemapUrlKey(u) {
  try {
    const x = new URL(u);
    const host = x.hostname.replace(/^www\./i, '').toLowerCase();
    let p = x.pathname || '/';
    if (p.length > 1) p = p.replace(/\/+$/, '');
    return `${host}${p.toLowerCase()}`;
  } catch {
    return String(u || '')
      .trim()
      .toLowerCase()
      .replace(/\/+$/, '');
  }
}

function missingSitemapLocs(rows, sitemapLocs) {
  const have = new Set((rows || []).map((r) => sitemapUrlKey(r.url)));
  const seen = new Set();
  const missing = [];
  for (const loc of sitemapLocs || []) {
    const k = sitemapUrlKey(loc);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    if (!have.has(k)) missing.push(loc);
  }
  return missing;
}

/**
 * A sitemap loc that redirects (or canonicalizes) to a URL already crawled is
 * covered. Do not append a second row for that target, and do not treat the
 * original loc as still missing.
 * fetched: [{ loc, url, row? }]
 */
export function coverRedirectedSitemapLocs(rows, sitemapLocs, fetched) {
  const extra = [];
  const covered = new Set();
  const have = new Set((rows || []).map((r) => sitemapUrlKey(r.url)));
  for (const hit of fetched || []) {
    const want = sitemapUrlKey(hit.loc);
    const got = sitemapUrlKey(hit.url);
    if (!want || !got) continue;
    if (got !== want) {
      covered.add(want);
      if (!have.has(got)) {
        extra.push(hit.row ?? { url: hit.url });
        have.add(got);
      }
      continue;
    }
    if (!have.has(got)) {
      extra.push(hit.row ?? { url: hit.url });
      have.add(got);
    }
  }
  const merged = (rows || []).concat(extra);
  const missing = missingSitemapLocs(merged, sitemapLocs).filter(
    (loc) => !covered.has(sitemapUrlKey(loc))
  );
  return { rows: merged, missing };
}

/**
 * Unique HTML rows can sit below the sitemap loc count when a loc redirects
 * onto a page already crawled. Unresolved locs are listed and the finished
 * crawl is still written. Zero rows, and a short crawl with no sitemap, are not.
 */
export function decideDeliverableWrite({
  rowCount,
  minPages,
  sitemapLocCount = 0,
  missingCount = 0,
}) {
  if (rowCount <= 0) return { write: false, reason: 'no_rows' };
  if (sitemapLocCount > 0) {
    if (missingCount > 0) return { write: true, reason: 'sitemap_gap' };
    if (rowCount < minPages) return { write: true, reason: 'redirects_share_rows' };
    return { write: true, reason: 'ok' };
  }
  if (rowCount < minPages) return { write: false, reason: 'below_min' };
  return { write: true, reason: 'ok' };
}

async function instantPageItemOnce(url, userAgentString) {
  const data = await dfsRequest('/on_page/instant_pages', {
    method: 'POST',
    body: [{ url, custom_user_agent: userAgentString, enable_javascript: false }],
  });
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

async function instantPageItem(url, userAgentString, { retryTaskId = null } = {}) {
  try {
    return await instantPageItemOnce(url, userAgentString);
  } catch (err) {
    if (retryTaskId && /40501|duplicate crawl/i.test(String(err?.message ?? err))) {
      await forceStopQuiet(retryTaskId);
      await new Promise((r) => setTimeout(r, 2000));
      return instantPageItemOnce(url, userAgentString);
    }
    throw err;
  }
}

async function fillMissingSitemapRows(rows, sitemapLocs, { delayMs = 1200, retryTaskId = null } = {}) {
  const missing = missingSitemapLocs(rows, sitemapLocs);
  if (missing.length === 0) return { rows, filled: 0, missing: [] };
  process.stderr.write(
    `[dataforseo] sitemap_gap ${missing.length} loc(s) missing from task pages → instant_pages fill\n`
  );
  const fetched = [];
  for (let i = 0; i < missing.length; i++) {
    const loc = missing[i];
    process.stderr.write(`[dataforseo] instant fill ${i + 1}/${missing.length} ${loc}\n`);
    const item = await instantPageItem(loc, BROWSER_CHROME_UA, { retryTaskId });
    const row = leanRow(item);
    if (sitemapUrlKey(row.url) !== sitemapUrlKey(loc)) {
      process.stderr.write(`[dataforseo] sitemap loc ${loc} resolved to ${row.url}\n`);
    }
    fetched.push({ loc, url: row.url, row });
    if (i < missing.length - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  const applied = coverRedirectedSitemapLocs(rows, sitemapLocs, fetched);
  return { rows: applied.rows, filled: fetched.length, missing: applied.missing };
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
  --domain               Crawl target. Required unless --task-id (resume/deliverables) or a dossier website.
  --project-dir          Campaign folder for the report (01-intake/1.2-audit/ when --output-dir is omitted). *Dossier.md is optional when --domain is set.
  --task-id              Resume existing task (skip task_post).
  --post-only            Post task + print JSON; do not poll full crawl (fast handoff).
  --force-new-task       Allow a new post while a same-host task is active (force_stops it first).
  --user-agent           googlebot (default) | browser | custom UA string.
  --no-probe-bot-block   With --post-only: skip short probe / Googlebot→browser auto-retry.
  --no-ua-retry          Never auto-repost with browser UA on BOT_BLOCK.
  --allow-empty-content  Write CSV even if ~all rows lack title/words (debug only).
  --allow-short-wait     Permit --max-wait-minutes < 12 when sitemap budget is known (not recommended).
  --max-crawl-pages      Page budget (auto-capped from sitemap when small).
  --allow-url-path       Repeatable. Keep sitemap locs whose path contains this (e.g. /pages/).
  --deny-url-path        Repeatable. Drop locs whose path contains this (e.g. /products/).
  --include-home         Always keep / and set start_url to the homepage.
  --exclude-sitemap-child  Comma list of child sitemap tokens to skip (e.g. product,products for PDP indexes; do not skip blog/post sitemaps on local SEO audits).
  --sitemap-only         Force crawl_sitemap_only=true.
  --no-sitemap-only      Force crawl_sitemap_only=false.
  --output-dir           Write .csv + .xlsx deliverables (default: {project-dir}/01-intake/1.2-audit/).
  --poll-seconds         Default 15.
  --max-wait-minutes     Default 15 (forbid 1-min waits for sitemap crawls).
  --max-queue-minutes    Fail if stuck at 40602 (default 5).
  --max-zero-progress-minutes  in_progress and 0 pages, even if queue > 0: force_stop then escalate (default 3).
  --min-pages            Refuse deliverables below N (auto from sitemap when omitted).
  --no-resolve-canonical Use --domain as target (not recommended).
  --enable-javascript    Force enable_javascript + load_resources on task_post.
  --no-auto-javascript   Disable auto JS when probe recommends it.

Requires DATAFORSEO_USERNAME and DATAFORSEO_PASSWORD.`);
}

/**
 * Host for a new crawl.
 * `--domain` is the target; `*Dossier.md` is optional in that case.
 * With no `--domain`, Official Website from the dossier supplies the host.
 * `readDossierWebsite` stays the optional hint on the resolve path.
 *
 * @param {{ domain?: string|null, projectDir?: string|null, taskId?: string|null }} args
 * @returns {string|null}
 */
export function resolveCrawlInputDomain(args) {
  let inputDomain = normalizeHost(args.domain);
  if (args.projectDir && !args.taskId) {
    const resolved = path.resolve(args.projectDir);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Project dir not found: ${resolved}`);
    }
    if (!inputDomain) {
      const { website } = assertDossierForCrawl(args.projectDir);
      try {
        inputDomain = normalizeHost(new URL(website).hostname);
      } catch {
        throw new Error(`Invalid Official Website in dossier: ${website}`);
      }
    }
  }
  return inputDomain;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  let inputDomain = resolveCrawlInputDomain(args);

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

  // Resolve on deliver (--task-id) too: sitemapLocs are required to fill gaps.
  if (inputDomain && args.resolveCanonical) {
    const dossierWebsite = args.projectDir ? readDossierWebsite(args.projectDir) : null;
    plan = await planCrawlTarget(inputDomain, {
      dossierWebsite,
      allowPathSubstrings: args.allowPathSubstrings,
      denyPathSubstrings: args.denyPathSubstrings,
      includeHome: args.includeHome,
      excludeSitemapChildren: args.excludeSitemapChildren,
    });
    logPlan(plan);
    crawlTarget = plan.crawlTarget;
    const pathFilterOn =
      args.includeHome ||
      args.allowPathSubstrings.length > 0 ||
      args.denyPathSubstrings.length > 0;
    if (args.forceSitemapOnly === true) crawlSitemapOnly = true;
    else if (args.forceSitemapOnly === false) crawlSitemapOnly = false;
    else crawlSitemapOnly = plan.crawlSitemapOnly;
    if (pathFilterOn && args.forceSitemapOnly !== true) {
      crawlSitemapOnly = false;
      process.stderr.write(
        '[dataforseo] path filter on → crawl_sitemap_only=false (avoid Shopify product index)\n',
      );
    }

    if (plan.sitemapUrlCount > 0 && maxCrawlPages === 500) {
      maxCrawlPages = plan.maxCrawlPagesSuggested;
    }
    if (args.minPages == null) minPages = plan.minPagesSuggested;
    else if (plan.sitemapUrlCount > 0) minPages = Math.max(args.minPages, plan.sitemapUrlCount);
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
  const targetDomain = crawlTarget ?? inputDomain ?? 'unknown';
  const pathFilterOn =
    args.includeHome ||
    args.allowPathSubstrings.length > 0 ||
    args.denyPathSubstrings.length > 0;
  const taskExtras = {};
  if (projectOverrides.startUrl) {
    taskExtras.startUrl = projectOverrides.startUrl;
    process.stderr.write(`[dataforseo] start_url=${projectOverrides.startUrl} (field-learnings.md)\n`);
  }
  if (pathFilterOn) {
    const home = plan?.canonicalUrl || `https://${targetDomain}/`;
    taskExtras.startUrl = home;
    taskExtras.customRobotsTxt = robotsTxtFromDenyPaths(args.denyPathSubstrings);
    taskExtras.robotsTxtMergeMode = 'merge';
  }

  const expectedPages = plan?.sitemapUrlCount ?? maxCrawlPages ?? 0;

  if (
    !args.allowShortWait &&
    !args.postOnly &&
    !args.taskId &&
    expectedPages >= 20 &&
    args.maxWaitMinutes < MIN_WAIT_MINUTES_WITH_EXPECTED
  ) {
    throw new Error(
      `WAIT_BUDGET: --max-wait-minutes ${args.maxWaitMinutes} is too short for sitemap budget ` +
        `${expectedPages}. Use 12–15 (default 15). Short waits caused fake failures (Harborview). ` +
        `Override only with --allow-short-wait.`
    );
  }

  let taskId = args.taskId;
  if (!taskId) {
    const gate = await gateOverlappingPost({
      outputDir: args.outputDir,
      host: targetDomain,
      forceNewTask: args.forceNewTask,
    });
    if (gate.priorStopped) priorTaskId = gate.priorStopped;

    taskId = await createTask(
      crawlTarget,
      maxCrawlPages,
      crawlSitemapOnly,
      args.enableJavascript,
      uaInfo.ua,
      taskExtras,
    );
    persistActive(args.outputDir, taskId, targetDomain, uaInfo.label);
  }
  process.stderr.write(
    `[dataforseo] task_id=${taskId} target=${targetDomain} sitemap_only=${crawlSitemapOnly} js=${args.enableJavascript} ua=${uaInfo.label} max_pages=${maxCrawlPages}\n`
  );

  if (args.postOnly) {
    try {
      if (args.probeBotBlock && !args.taskId) {
        const probed = await probeAndMaybeRetryUa({
          taskId,
          crawlTarget: targetDomain,
          maxCrawlPages,
          crawlSitemapOnly,
          enableJavascript: args.enableJavascript,
          uaInfo,
          allowRetry: !args.noUaRetry,
          expectedPages,
          projectDir: args.projectDir,
          outputDir: args.outputDir,
          taskExtras,
        });
        taskId = probed.taskId;
        uaInfo = probed.uaInfo;
        priorTaskId = probed.priorTaskId ?? priorTaskId;
        uaRetried = probed.uaRetried;
        persistActive(args.outputDir, taskId, targetDomain, uaInfo.label);
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
            path_filter: pathFilterOn
              ? {
                  allow: args.allowPathSubstrings,
                  deny: args.denyPathSubstrings,
                  include_home: args.includeHome,
                  exclude_sitemap_child: args.excludeSitemapChildren,
                }
              : null,
            post_only: true,
            recommended_max_wait_minutes: 15,
            active_task_file: args.outputDir
              ? path.join(args.outputDir, '.dfs-active-task.json')
              : null,
          },
          null,
          2
        )
      );
      return;
    } catch (err) {
      if (err instanceof BotBlockError || err instanceof StuckZeroError) {
        if (err.escalate_to_instant_fallback) {
          await forceStopQuiet(err.taskId);
          clearActiveTask(args.outputDir);
        }
        console.log(
          JSON.stringify(
            {
              error: err.name,
              message: err.message,
              task_id: err.taskId,
              escalate_to_instant_fallback: Boolean(err.escalate_to_instant_fallback),
              ua_retried: uaRetried,
              user_agent: uaInfo.label,
              next_step: err.escalate_to_instant_fallback
                ? 'node scripts/sitemap-instant-fallback.mjs --domain … --project-dir …'
                : 'retry --user-agent browser --post-only (once) then wait 12–15m',
            },
            null,
            2
          )
        );
        process.exitCode = 2;
        return;
      }
      throw err;
    }
  }

  async function runInstantFallbackNow(err) {
    const stalledId = err.taskId ?? taskId;
    await forceStopQuiet(stalledId);
    clearActiveTask(args.outputDir);
    process.stderr.write(
      `[dataforseo] ${err.name || 'stall'} → instant_pages in this run task_id=${stalledId}\n`
    );
    await runSitemapInstantFallback({
      domain: inputDomain || targetDomain,
      projectDir: args.projectDir,
      outputDir: args.outputDir,
      domainSlug: args.domainSlug,
      minPages: args.minPages ?? 8,
      userAgent: 'browser',
      allowEmptyContent: args.allowEmptyContent,
      stopTaskId: stalledId,
    });
  }

  let summary;
  try {
    ({ result: summary } = await waitForCrawl(
      taskId,
      args.pollSeconds,
      args.maxWaitMinutes,
      args.maxQueueMinutes,
      args.maxZeroProgressMinutes,
      expectedPages || minPages || 0
    ));
  } catch (err) {
    if (
      err instanceof BotBlockError &&
      !args.noUaRetry &&
      uaInfo.label === 'googlebot' &&
      !uaRetried &&
      !args.taskId
    ) {
      process.stderr.write(
        `[dataforseo] BOT_BLOCK on wait → force_stop + re-post with user_agent=browser (prior=${taskId})\n`
      );
      recordBrowserUaLearning(args.projectDir, args.outputDir);
      await forceStopQuiet(taskId);
      priorTaskId = taskId;
      uaInfo = resolveUserAgent('browser');
      taskId = await createTask(
        targetDomain,
        maxCrawlPages,
        crawlSitemapOnly,
        args.enableJavascript,
        uaInfo.ua,
        taskExtras,
      );
      uaRetried = true;
      persistActive(args.outputDir, taskId, targetDomain, uaInfo.label);
      process.stderr.write(`[dataforseo] retry_task_id=${taskId} ua=${uaInfo.label}\n`);
      try {
        ({ result: summary } = await waitForCrawl(
          taskId,
          args.pollSeconds,
          args.maxWaitMinutes,
          args.maxQueueMinutes,
          args.maxZeroProgressMinutes,
          expectedPages || minPages || 0
        ));
      } catch (err2) {
        if (err2 instanceof StuckZeroError || err2 instanceof BotBlockError) {
          err2.escalate_to_instant_fallback = true;
          await runInstantFallbackNow(err2);
          return;
        }
        throw err2;
      }
    } else if (
      err instanceof StuckZeroError ||
      err instanceof BotBlockError ||
      err?.escalate_to_instant_fallback
    ) {
      await runInstantFallbackNow(err);
      return;
    } else {
      throw err;
    }
  }
  clearActiveTask(args.outputDir);
  const items = await fetchAllPages(taskId);
  let rows = items.map(leanRow);
  const pagesCrawled = summary?.crawl_status?.pages_crawled ?? null;
  let sitemapFilled = 0;
  let sitemapMissing = [];

  if (plan?.sitemapLocs?.length) {
    const filled = await fillMissingSitemapRows(rows, plan.sitemapLocs, { retryTaskId: taskId });
    rows = filled.rows;
    sitemapFilled = filled.filled;
    sitemapMissing = filled.missing;
  }

  const writeGate = decideDeliverableWrite({
    rowCount: rows.length,
    minPages,
    sitemapLocCount: plan?.sitemapLocs?.length ?? 0,
    missingCount: sitemapMissing.length,
  });
  if (!writeGate.write) {
    throw new Error(
      `Only ${rows.length} HTML page(s) returned (pages_crawled=${pagesCrawled ?? '?'}, min=${minPages}). ` +
        `Not writing deliverables. task_id=${taskId}`
    );
  }
  if (writeGate.reason === 'redirects_share_rows') {
    process.stderr.write(
      `[dataforseo] sitemap covered with ${rows.length} HTML row(s) ` +
        `(sitemap locs=${plan.sitemapLocs.length}); redirect locs share a row. ` +
        `Writing deliverables. task_id=${taskId}\n`
    );
  }
  if (writeGate.reason === 'sitemap_gap') {
    process.stderr.write(
      `[dataforseo] sitemap_gap_remaining ${sitemapMissing.length} loc(s): ` +
        `${sitemapMissing.join(', ')}. Writing deliverables. task_id=${taskId}\n`
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
    sitemap_filled: sitemapFilled,
    sitemap_missing: sitemapMissing,
    sitemap_missing_count: sitemapMissing.length,
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

if (isDirectRun()) {
  main().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
