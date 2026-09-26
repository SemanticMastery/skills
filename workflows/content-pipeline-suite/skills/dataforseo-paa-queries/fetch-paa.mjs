#!/usr/bin/env node
/**
 * DataForSEO People Also Ask — SERP Google Organic Live Advanced
 *
 * Usage:
 *   node fetch-paa.mjs --keyword "tree removal" --location_name "Austin,Texas,United States"
 *   node fetch-paa.mjs --keywords "a,b,c" --location_name "Austin,Texas,United States"
 *   node fetch-paa.mjs --keyword "tree removal" --location_name "Austin,Texas,United States" --no-expand
 *
 * Hard-coded: language_code=en, device=desktop
 * Click depth: 4 (max API) to maximize PAA items; tree depth capped at 2 via seed_question + expand
 * Default: expand each unique depth-1 question with a follow-up SERP (depth-2 children)
 * Credentials: DATAFORSEO_USERNAME / DATAFORSEO_PASSWORD
 */

import fs from 'fs';
import path from 'path';

const USERNAME = process.env.DATAFORSEO_USERNAME;
const PASSWORD = process.env.DATAFORSEO_PASSWORD;
const ENDPOINT = 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced';
const LANGUAGE_CODE = 'en';
const DEVICE = 'desktop';
/** API click depth (1–4). Higher = more PAA elements returned on one SERP. */
const PAA_CLICK_DEPTH = 4;
/** Max tree depth in deliverable (seed SERP = 1, expanded children = 2). */
const MAX_TREE_DEPTH = 2;
const DEFAULT_OUT_DIR = 'outputs/dataforseo-paa-queries';

if (!USERNAME || !PASSWORD) {
  console.error('Missing DATAFORSEO_USERNAME or DATAFORSEO_PASSWORD');
  process.exit(1);
}

function getArg(name, def = null) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && process.argv[idx + 1] != null ? process.argv[idx + 1] : def;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function slugify(text) {
  return (
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'keyword'
  );
}

function normQ(q) {
  return String(q || '')
    .toLowerCase()
    .replace(/[?!.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectKeywords() {
  const multi = getArg('keywords');
  const single = getArg('keyword');
  const list = [];
  if (multi) {
    for (const part of multi.split(',')) {
      const k = part.trim();
      if (k) list.push(k);
    }
  }
  if (single) {
    const k = single.trim();
    if (k && !list.includes(k)) list.push(k);
  }
  return list;
}

function extractAnswerSnippet(expanded) {
  if (!Array.isArray(expanded) || expanded.length === 0) return null;

  const texts = [];
  const visit = (node, d = 0) => {
    if (!node || d > 6) return;
    if (Array.isArray(node)) {
      node.forEach((n) => visit(n, d));
      return;
    }
    if (typeof node !== 'object') return;
    for (const key of ['description', 'text', 'markdown', 'snippet']) {
      if (typeof node[key] === 'string' && node[key].trim()) {
        texts.push(node[key].trim());
      }
    }
    for (const v of Object.values(node)) {
      if (v && typeof v === 'object') visit(v, d + 1);
    }
  };
  visit(expanded);
  if (!texts.length) return null;
  // Prefer longer substantive snippet
  texts.sort((a, b) => b.length - a.length);
  return texts[0].slice(0, 500);
}

/**
 * Parse PAA elements from a SERP items array.
 * DataForSEO sets seed_question=null for root PAA; seed_question=<parent Q> after clicks.
 */
function extractPaaFromItems(items, { mode = 'seed', parentQuestion = null } = {}) {
  const out = [];
  if (!Array.isArray(items)) return out;

  for (const item of items) {
    if (!item || item.type !== 'people_also_ask') continue;
    for (const el of item.items || []) {
      if (!el || typeof el !== 'object') continue;
      const question = (el.title || '').trim();
      if (!question) continue;

      const seedQuestion =
        el.seed_question == null || el.seed_question === ''
          ? null
          : String(el.seed_question).trim();

      let depth;
      let parent;

      if (mode === 'seed') {
        // Root SERP for campaign keyword — use API seed_question for parent/depth
        if (!seedQuestion) {
          depth = 1;
          parent = null;
        } else {
          depth = 2;
          parent = seedQuestion;
        }
      } else if (mode === 'expand') {
        // Expansion SERP: keyword was a depth-1 question.
        // Keep only root PAAs of that SERP as depth-2 children (cap tree at 2).
        if (seedQuestion) continue;
        depth = 2;
        parent = parentQuestion;
      } else {
        continue;
      }

      if (depth > MAX_TREE_DEPTH) continue;

      out.push({
        question,
        answer_snippet: extractAnswerSnippet(el.expanded_element),
        depth,
        parent,
      });
    }
  }
  return out;
}

function rowKey(q) {
  // Keep same question under different parents / depths (content-graph friendly)
  return `${normQ(q.question)}|${normQ(q.parent || '')}|${q.depth}`;
}

function mergeQuestions(existing, incoming) {
  const byKey = new Map();
  for (const q of existing) {
    byKey.set(rowKey(q), q);
  }
  for (const q of incoming) {
    const key = rowKey(q);
    if (!normQ(q.question)) continue;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, q);
      continue;
    }
    // Same node: prefer non-null answer snippet
    if (!prev.answer_snippet && q.answer_snippet) byKey.set(key, q);
  }
  return [...byKey.values()].sort(
    (a, b) => a.depth - b.depth || String(a.parent || '').localeCompare(String(b.parent || '')) || a.question.localeCompare(b.question)
  );
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchSerp(keyword, locationName) {
  const auth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
  const body = [
    {
      keyword,
      location_name: locationName,
      language_code: LANGUAGE_CODE,
      device: DEVICE,
      people_also_ask_click_depth: PAA_CLICK_DEPTH,
      depth: 10,
    },
  ];

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.status_code && json.status_code !== 20000) {
    throw new Error(`DataForSEO status ${json.status_code}: ${json.status_message || 'unknown'}`);
  }

  const task = json.tasks?.[0];
  if (!task) throw new Error('No tasks in response');
  if (task.status_code && task.status_code !== 20000) {
    throw new Error(`Task status ${task.status_code}: ${task.status_message || 'unknown'}`);
  }

  const result = task.result?.[0];
  if (!result) throw new Error('Missing result[0] in task');

  return {
    items: result.items || [],
    cost: Number(task.cost ?? json.cost ?? 0),
    taskId: task.id || null,
    checkUrl: result.check_url || null,
  };
}

async function collectForKeyword(keyword, locationName, { expand }) {
  let credits = 0;
  const taskIds = [];
  const apiCalls = [];

  const seed = await fetchSerp(keyword, locationName);
  credits += seed.cost;
  taskIds.push(seed.taskId);
  apiCalls.push({ role: 'seed', keyword, cost: seed.cost });

  let questions = extractPaaFromItems(seed.items, { mode: 'seed' });
  questions = mergeQuestions([], questions);

  const depth1 = questions.filter((q) => q.depth === 1).map((q) => q.question);
  const expandTargets = expand ? [...new Set(depth1.map(normQ))].map((nq) => {
    return depth1.find((q) => normQ(q) === nq);
  }).filter(Boolean) : [];

  for (let i = 0; i < expandTargets.length; i++) {
    const parentQ = expandTargets[i];
    await sleep(250);
    try {
      const child = await fetchSerp(parentQ, locationName);
      credits += child.cost;
      taskIds.push(child.taskId);
      apiCalls.push({ role: 'expand', keyword: parentQ, cost: child.cost });
      const extracted = extractPaaFromItems(child.items, {
        mode: 'expand',
        parentQuestion: parentQ,
      });
      questions = mergeQuestions(questions, extracted);
    } catch (err) {
      apiCalls.push({
        role: 'expand_error',
        keyword: parentQ,
        error: err.message || String(err),
      });
    }
  }

  const d1 = questions.filter((q) => q.depth === 1).length;
  const d2 = questions.filter((q) => q.depth === 2).length;

  return {
    keyword,
    location_name: locationName,
    language_code: LANGUAGE_CODE,
    device: DEVICE,
    paa_click_depth: PAA_CLICK_DEPTH,
    max_tree_depth: MAX_TREE_DEPTH,
    expand_depth1: expand,
    paa_questions: questions,
    counts: {
      total: questions.length,
      depth_1: d1,
      depth_2: d2,
      expand_targets: expandTargets.length,
      api_calls: apiCalls.length,
    },
    retrieved_at: new Date().toISOString(),
    credits_used: Number(credits.toFixed(6)),
    raw_task_ids: taskIds.filter(Boolean),
    check_url: seed.checkUrl,
    api_calls: apiCalls,
  };
}

async function main() {
  const keywords = collectKeywords();
  const locationName = getArg('location_name');
  const outDirArg = getArg('out-dir', DEFAULT_OUT_DIR);
  const expand = !hasFlag('no-expand');
  const maxExpandArg = getArg('max-expand', null);
  // reserved for future cost caps; currently expand all unique depth-1
  void maxExpandArg;

  if (!keywords.length) {
    console.error(
      'Usage: node fetch-paa.mjs --keyword "term" --location_name "City,State,United States"\n' +
        '   or: node fetch-paa.mjs --keywords "a,b,c" --location_name "City,State,United States"\n' +
        'Flags: --no-expand (seed SERP only; no depth-1 follow-up SERPs)'
    );
    process.exit(1);
  }
  if (!locationName || !locationName.trim()) {
    console.error('Missing required --location_name (e.g. "Austin,Texas,United States")');
    process.exit(1);
  }

  const outDir = path.resolve(process.cwd(), outDirArg);
  fs.mkdirSync(outDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const loc = locationName.trim();

  const written = [];
  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    const payload = await collectForKeyword(keyword, loc, { expand });
    const outFile = path.join(outDir, `paa-${slugify(keyword)}-${date}.json`);
    fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
    written.push({
      written: outFile,
      keyword,
      paa_count: payload.counts.total,
      depth_1: payload.counts.depth_1,
      depth_2: payload.counts.depth_2,
      expand_targets: payload.counts.expand_targets,
      api_calls: payload.counts.api_calls,
      credits_used: payload.credits_used,
    });
    if (i < keywords.length - 1) await sleep(250);
  }

  console.log(
    JSON.stringify(
      {
        location_name: loc,
        expand_depth1: expand,
        paa_click_depth: PAA_CLICK_DEPTH,
        files: written,
        total_keywords: written.length,
        total_paa: written.reduce((n, w) => n + w.paa_count, 0),
        total_credits: Number(written.reduce((n, w) => n + w.credits_used, 0).toFixed(6)),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
