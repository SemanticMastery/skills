#!/usr/bin/env node
/**
 * OnPage task status — one snapshot, or poll until finished.
 * Usage:
 *   node check-task.mjs --task-id UUID [--html-count]
 *   node check-task.mjs --task-id UUID --wait [--poll-seconds 15] [--max-wait-minutes 15]
 *
 * finished + pages_crawled===0 + forbidden_http_header ⇒ bot_block: true
 * (Northside Care 2026-07 — Googlebot WAF; not a JS stall).
 *
 * Stuck pages_crawled=0 beyond --max-zero-progress-minutes → force_stop +
 * escalate_to_instant_fallback (Harborview 2026-08-10). A non-empty
 * pages_in_queue does not keep the wait alive (Good Day Garage 2026-11-14:
 * queue=1, crawled=0, full 15 minutes). Never treat 1-minute waits as
 * definitive failure when --expected-pages is set.
 */

import { isInProgressZeroCrawl } from './crawl-stall.mjs';

import {
  clearActiveTask,
  readActiveTask,
} from './active-task.mjs';

const API = 'https://api.dataforseo.com/v3';
const MIN_WAIT_MINUTES_WITH_EXPECTED = 12;

const BOT_BLOCK_STATUS_RE =
  /forbidden_http_header|forbidden_user_agent|access.?denied|bot.?block|blocked_by_robots|http_header|site_unreachable/i;

function parseArgs(argv) {
  const out = {
    taskId: null,
    htmlCount: false,
    wait: false,
    pollSeconds: 15,
    maxWaitMinutes: 15,
    expectedPages: 0,
    maxZeroProgressMinutes: 3,
    projectDir: null,
    outputDir: null,
    allowShortWait: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--task-id' && argv[i + 1]) out.taskId = argv[++i];
    else if (a === '--html-count') out.htmlCount = true;
    else if (a === '--wait') out.wait = true;
    else if (a === '--poll-seconds' && argv[i + 1]) out.pollSeconds = Number(argv[++i]);
    else if (a === '--max-wait-minutes' && argv[i + 1]) out.maxWaitMinutes = Number(argv[++i]);
    else if (a === '--expected-pages' && argv[i + 1]) out.expectedPages = Number(argv[++i]);
    else if (a === '--max-zero-progress-minutes' && argv[i + 1])
      out.maxZeroProgressMinutes = Number(argv[++i]);
    else if (a === '--project-dir' && argv[i + 1]) out.projectDir = argv[++i];
    else if (a === '--output-dir' && argv[i + 1]) out.outputDir = argv[++i];
    else if (a === '--allow-short-wait') out.allowShortWait = true;
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

async function dfsGet(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: authHeader() } });
  return res.json();
}

async function dfsPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function forceStopTask(taskId) {
  const json = await dfsPost('/on_page/force_stop', [{ id: taskId }]);
  if (json?.status_code !== 20000) {
    throw new Error(
      `force_stop failed: ${json?.status_message ?? 'unknown'} (${json?.status_code})`
    );
  }
}

function detectBotBlock(status, expectedPages = 0) {
  if (status.crawl_progress !== 'finished') return false;
  const crawled = status.pages_crawled ?? 0;
  const extended = String(status.extended_crawl_status ?? '');
  const stop = String(status.crawl_stop_reason ?? '');

  if (BOT_BLOCK_STATUS_RE.test(extended)) {
    if (crawled === 0) return true;
    if (/site_unreachable|forbidden/i.test(extended) && crawled < 10) return true;
  }
  if (crawled === 0 && /forbidden|blocked|unreachable/i.test(extended + ' ' + stop)) {
    return true;
  }
  if (expectedPages >= 20) {
    const floor = Math.max(10, Math.floor(expectedPages * 0.05));
    if (crawled < floor) return true;
  }
  return false;
}

async function fetchStatus(taskId, htmlCount, expectedPages = 0) {
  const data = await dfsGet(`/on_page/summary/${taskId}`);
  const task = data.tasks?.[0];
  const r = task?.result?.[0];
  const cs = r?.crawl_status ?? {};
  const out = {
    task_id: taskId,
    task_status_code: task?.status_code ?? null,
    crawl_progress: r?.crawl_progress ?? null,
    target: task?.data?.target ?? r?.domain_info?.name ?? null,
    pages_crawled: cs.pages_crawled ?? null,
    pages_in_queue: cs.pages_in_queue ?? null,
    total_pages: r?.domain_info?.total_pages ?? null,
    crawl_stop_reason: r?.crawl_stop_reason ?? null,
    crawl_sitemap_only: task?.data?.crawl_sitemap_only ?? null,
    enable_javascript: task?.data?.enable_javascript ?? null,
    extended_crawl_status: r?.domain_info?.extended_crawl_status ?? null,
    crawl_start: r?.domain_info?.crawl_start ?? null,
    crawl_end: r?.domain_info?.crawl_end ?? null,
  };

  if (htmlCount) {
    const pages = await dfsPost('/on_page/pages', [
      { id: taskId, limit: 1, filters: [['resource_type', '=', 'html']] },
    ]);
    const block = pages.tasks?.[0]?.result?.[0];
    out.html_total_count = block?.total_count ?? block?.items?.length ?? null;
  }

  out.bot_block = detectBotBlock(out, expectedPages);
  if (out.bot_block) {
    out.ua_retry_hint =
      'Re-post with: crawl-domain.mjs --user-agent browser --post-only (or use post-only bot probe). Do not escalate to instant_pages until browser UA retry fails. Do not open a third overlapping task_post.';
  }

  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function resolveOutputDir(args) {
  if (args.outputDir) return args.outputDir;
  if (args.projectDir) {
    return `${args.projectDir.replace(/[\\/]+$/, '')}/01-intake/1.2-audit`;
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.taskId) {
    console.log(`Usage: node check-task.mjs --task-id TASK_UUID [options]

Options:
  --html-count           Include HTML row count from /pages
  --wait                 Poll until crawl_progress=finished (exits immediately when done)
  --poll-seconds N       Interval when --wait (default 15)
  --max-wait-minutes N   Give up after N minutes (default 15; min 12 when --expected-pages ≥ 20)
  --expected-pages N     Sitemap budget; tiny finished crawls flag bot_block
  --max-zero-progress-minutes N  in_progress and 0 pages (queue may be >0) → force_stop + escalate (default 3)
  --project-dir DIR      Clear .dfs-active-task.json on finish / escalate
  --output-dir DIR       Audit root for active-task file
  --allow-short-wait     Permit max-wait-minutes < 12 with expected-pages (not recommended)

On finished + forbidden_http_header / site_unreachable / tiny vs expected-pages, JSON includes bot_block: true.
On stuck-at-zero, JSON includes stuck_zero + escalate_to_instant_fallback (exit 0).`);
    process.exit(args.taskId ? 0 : 1);
  }

  if (
    args.wait &&
    !args.allowShortWait &&
    args.expectedPages >= 20 &&
    args.maxWaitMinutes < MIN_WAIT_MINUTES_WITH_EXPECTED
  ) {
    throw new Error(
      `WAIT_BUDGET: --max-wait-minutes ${args.maxWaitMinutes} is too short for --expected-pages ${args.expectedPages}. ` +
        `Use 12–15 minutes (default 15). 1-minute waits caused fake failures (Harborview 2026-08-10). ` +
        `Override only with --allow-short-wait.`
    );
  }

  const outputDir = resolveOutputDir(args);

  if (!args.wait) {
    const status = await fetchStatus(args.taskId, args.htmlCount, args.expectedPages);
    if (status.bot_block) {
      process.stderr.write(
        `[check-task] BOT_BLOCK extended=${status.extended_crawl_status} pages=${status.pages_crawled} — retry --user-agent browser before instant_pages\n`
      );
    }
    if (status.crawl_progress === 'finished' && outputDir) {
      const active = readActiveTask(outputDir);
      if (active?.task_id === args.taskId) clearActiveTask(outputDir);
    }
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  const deadline = Date.now() + args.maxWaitMinutes * 60 * 1000;
  const zeroDeadlineMs = args.maxZeroProgressMinutes * 60 * 1000;
  const waitStarted = Date.now();
  let zeroSince = null;
  let forceStopSent = false;
  let poll = 0;

  while (Date.now() < deadline) {
    const status = await fetchStatus(args.taskId, args.htmlCount, args.expectedPages);
    const elapsedSec = Math.round((Date.now() - waitStarted) / 1000);
    const remainSec = Math.max(0, Math.round((deadline - Date.now()) / 1000));
    process.stderr.write(
      `[check-task] poll=${poll} progress=${status.crawl_progress} crawled=${status.pages_crawled} queue=${status.pages_in_queue} elapsed=${elapsedSec}s remain~${remainSec}s\n`
    );

    if (status.crawl_progress === 'finished') {
      status.wait_complete = true;
      status.polls = poll + 1;
      status.elapsed_seconds = elapsedSec;
      if (status.bot_block) {
        process.stderr.write(
          `[check-task] BOT_BLOCK extended=${status.extended_crawl_status} pages=${status.pages_crawled} — retry --user-agent browser before instant_pages\n`
        );
      }
      if (outputDir) {
        const active = readActiveTask(outputDir);
        if (!active || active.task_id === args.taskId) clearActiveTask(outputDir);
      }
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    if (status.task_status_code >= 50000) {
      throw new Error(`Task failed: status ${status.task_status_code}`);
    }

    const crawled = status.pages_crawled ?? 0;
    const queue = status.pages_in_queue ?? 0;
    const stuckZero = isInProgressZeroCrawl(status.crawl_progress, status.pages_crawled);

    if (stuckZero) {
      if (zeroSince == null) {
        zeroSince = Date.now();
        process.stderr.write(
          `[check-task] zero_crawl pages=0 queue=${queue} → force_stop if still 0 after ${args.maxZeroProgressMinutes}m\n`
        );
      }
      if (!forceStopSent && Date.now() - zeroSince >= zeroDeadlineMs) {
        process.stderr.write(
          `[check-task] stuck_zero ${args.maxZeroProgressMinutes}m pages=0 queue=${queue} → force_stop + escalate to sitemap-instant-fallback\n`
        );
        try {
          await forceStopTask(args.taskId);
          forceStopSent = true;
        } catch (err) {
          process.stderr.write(`[check-task] force_stop warn: ${err.message}\n`);
          forceStopSent = true;
        }
        await sleep(Math.min(args.pollSeconds, 10) * 1000);
        const after = await fetchStatus(args.taskId, args.htmlCount, args.expectedPages);
        after.stuck_zero = true;
        after.force_stopped = true;
        after.escalate_to_instant_fallback = true;
        after.wait_complete = after.crawl_progress === 'finished';
        after.elapsed_seconds = Math.round((Date.now() - waitStarted) / 1000);
        after.next_step =
          'node scripts/sitemap-instant-fallback.mjs --domain … --project-dir … (clears host lock). Do not task_post again.';
        if (outputDir) clearActiveTask(outputDir);
        console.log(JSON.stringify(after, null, 2));
        return;
      }
    } else if (crawled > 0) {
      zeroSince = null;
    }

    poll += 1;
    await sleep(args.pollSeconds * 1000);
  }

  throw new Error(
    `Timed out after ${args.maxWaitMinutes} minutes (task_id=${args.taskId}). Last progress was not finished. ` +
      `If pages stayed 0, escalate to sitemap-instant-fallback.mjs after force_stop — do not post another overlapping crawl.`
  );
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
