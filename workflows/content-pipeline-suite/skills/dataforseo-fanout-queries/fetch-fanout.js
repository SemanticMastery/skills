#!/usr/bin/env node
/**
 * DataForSEO Query Fan-Out — generative expansion via ChatGPT LLM Responses Live
 *
 * Produces a Wellows-style list of generated search queries (default 120), not the
 * sparse llm_scraper fan_out_queries browse crumbs.
 *
 * Usage:
 *   node fetch-fanout.js --keyword "oak wilt treatment austin texas" \
 *     [--count 120] [--model_name gpt-4.1-mini] \
 *     [--out-dir "outputs/dataforseo-fanout-queries"]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const USERNAME = process.env.DATAFORSEO_USERNAME;
const PASSWORD = process.env.DATAFORSEO_PASSWORD;

if (!USERNAME || !PASSWORD) {
  console.error('Missing DATAFORSEO_USERNAME or DATAFORSEO_PASSWORD');
  process.exit(1);
}

function getArg(name, def = null) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : def;
}

const keyword = (getArg('keyword') || '').trim();
if (!keyword) {
  console.error('Usage: node fetch-fanout.js --keyword "your term" [--count 120]');
  process.exit(1);
}

const count = Math.max(10, Math.min(200, Number(getArg('count', '120')) || 120));
const modelName = getArg('model_name', 'gpt-4.1-mini');
const outDirArg = getArg('out-dir', 'outputs/dataforseo-fanout-queries');

const auth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
const endpoint = 'https://api.dataforseo.com/v3/ai_optimization/chat_gpt/llm_responses/live';

const systemMessage =
  'You generate SEO query fan-out lists. Output ONLY a JSON array of unique lowercase search-query strings. No markdown, no commentary.';

function buildUserPrompt(seed, n) {
  // DataForSEO hard-caps user_prompt at 500 chars
  let prompt =
    `Generate exactly ${n} unique Google-style search queries people might type for: "${seed}". ` +
    `Mix intents (info, commercial, cost, how-to, local). Keep most under 8 words. JSON array only.`;
  if (prompt.length > 500) {
    const room = 500 - `Generate exactly ${n} unique Google-style search queries for: "". JSON array only.`.length;
    const clipped = seed.slice(0, Math.max(20, room));
    prompt =
      `Generate exactly ${n} unique Google-style search queries for: "${clipped}". JSON array only.`;
  }
  return prompt;
}

function extractMessageText(result) {
  const parts = [];
  for (const item of result?.items || []) {
    if (item.type !== 'message') continue;
    for (const section of item.sections || []) {
      if (section.type === 'text' && section.text) parts.push(section.text);
    }
  }
  return parts.join('\n');
}

function parseQueryList(raw) {
  if (!raw || !raw.trim()) return [];

  // Prefer JSON array
  const match = raw.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        return parsed
          .map((q) => (typeof q === 'string' ? q : q?.query || q?.keyword || ''))
          .map((q) => String(q).trim())
          .filter(Boolean);
      }
    } catch {
      // fall through to line parse
    }
  }

  return raw
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*[-*•]\s*/, '')
        .replace(/^\s*\d+[\).:\-]\s*/, '')
        .replace(/^["']|["']$/g, '')
        .replace(/,$/, '')
        .trim()
    )
    .filter((q) => q && !q.startsWith('[') && !q.startsWith(']') && q.toLowerCase() !== 'generated query');
}

function dedupePreserveOrder(queries) {
  const seen = new Set();
  const out = [];
  for (const q of queries) {
    const key = q.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function toCsv(queries) {
  const escape = (v) => {
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [',Generated Query'];
  queries.forEach((q, i) => {
    lines.push(`${i + 1},${escape(q)}`);
  });
  return lines.join('\n') + '\n';
}

async function main() {
  const userPrompt = buildUserPrompt(keyword, count);
  const body = [
    {
      model_name: modelName,
      system_message: systemMessage,
      user_prompt: userPrompt,
      max_output_tokens: 4096,
      temperature: 0.9,
      web_search: false,
    },
  ];

  const res = await fetch(endpoint, {
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
  const task = json.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    throw new Error(
      `Task failed ${task?.status_code ?? 'n/a'}: ${task?.status_message ?? json.status_message ?? 'unknown'}`
    );
  }

  const result = task.result?.[0];
  if (!result) throw new Error('Missing result[0] in successful task response');

  const rawText = extractMessageText(result);
  const generatedQueries = dedupePreserveOrder(parseQueryList(rawText));
  // Optional: sparse browse fan-outs from the same response (usually unused for research)
  const browseFanOuts = Array.isArray(result.fan_out_queries) ? result.fan_out_queries : [];

  if (generatedQueries.length < 10) {
    throw new Error(
      `Parsed only ${generatedQueries.length} generated queries (expected ~${count}). Raw head: ${rawText.slice(0, 200)}`
    );
  }

  const slug = slugify(keyword);
  const date = new Date().toISOString().slice(0, 10);
  const outDir = path.resolve(process.cwd(), outDirArg);
  fs.mkdirSync(outDir, { recursive: true });

  const base = `fanout-queries-${slug}-${date}`;
  const jsonFile = path.join(outDir, `${base}.json`);
  const csvFile = path.join(outDir, `${base}.csv`);

  const payload = {
    keyword,
    count_requested: count,
    generated_queries: generatedQueries,
    browse_fan_out_queries: browseFanOuts,
    model_name: result.model_name || modelName,
    source: 'dataforseo_chat_gpt_llm_responses_live',
    retrieved_at: new Date().toISOString(),
    credits_used: task.cost || 0,
    money_spent: result.money_spent || null,
    input_tokens: result.input_tokens || null,
    output_tokens: result.output_tokens || null,
    raw_task_id: task.id || null,
    files: {
      json: jsonFile,
      csv: csvFile,
    },
  };

  fs.writeFileSync(jsonFile, JSON.stringify(payload, null, 2));
  fs.writeFileSync(csvFile, toCsv(generatedQueries));

  console.log(
    JSON.stringify({
      written_json: jsonFile,
      written_csv: csvFile,
      generated_queries: generatedQueries.length,
      browse_fan_out_queries: browseFanOuts.length,
      credits_used: payload.credits_used,
    })
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
