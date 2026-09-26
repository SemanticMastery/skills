#!/usr/bin/env node
/**
 * Generate one image via Fal.ai (FLUX.2 Pro) and save it to disk.
 * Uses Node 20+ fetch only — no npm deps.
 *
 * Usage:
 *   node fal-generate.mjs --prompt "..." --out "C:\\...\\post-01-img-01.png"
 *   node fal-generate.mjs --prompt-file prompt.txt --out out.png --aspect 16:9
 *
 * Env: FAL_AI_API_KEY or FAL_KEY (required). Never printed. Optional skill-local
 * `.env` next to this scripts folder is loaded if present (KEY=value lines only).
 * On Windows, User-scope env is read if the current process does not have the var.
 *
 * Default model: fal-ai/flux-2-pro
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_MODEL = "fal-ai/flux-2-pro";
const POLL_MS = 1500;
const MAX_WAIT_MS = 180_000;

const ASPECT_TO_SIZE = {
  "16:9": "landscape_16_9",
  "4:3": "landscape_4_3",
  "1:1": "square_hd",
  "9:16": "portrait_16_9",
  "3:4": "portrait_4_3",
};

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function parseArgs(argv) {
  const out = {
    prompt: null,
    promptFile: null,
    out: null,
    aspect: "16:9",
    model: DEFAULT_MODEL,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--prompt") out.prompt = argv[++i];
    else if (a === "--prompt-file") out.promptFile = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--aspect") out.aspect = argv[++i];
    else if (a === "--model") out.model = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function fail(msg, extra = {}) {
  console.error(JSON.stringify({ ok: false, error: msg, ...extra }));
  process.exit(1);
}

function readWindowsUserEnv(name) {
  if (process.platform !== "win32") return "";
  try {
    const v = execSync(
      `powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('${name}','User')"`,
      { encoding: "utf8", timeout: 8000, windowsHide: true },
    ).trim();
    return v;
  } catch {
    return "";
  }
}

function resolveFalKey() {
  const fromProcess =
    process.env.FAL_AI_API_KEY || process.env.FAL_KEY || "";
  if (fromProcess) return fromProcess;
  return (
    readWindowsUserEnv("FAL_AI_API_KEY") || readWindowsUserEnv("FAL_KEY") || ""
  );
}

function authHeaders(key) {
  return {
    Authorization: `Key ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function queueGenerate({ model, key, body }) {
  const submitUrl = `https://queue.fal.run/${model}`;
  const submitRes = await fetch(submitUrl, {
    method: "POST",
    headers: authHeaders(key),
    body: JSON.stringify(body),
  });
  const submitText = await submitRes.text();
  let submitJson;
  try {
    submitJson = JSON.parse(submitText);
  } catch {
    fail("fal submit returned non-JSON", {
      http: submitRes.status,
      bodyPreview: submitText.slice(0, 400),
    });
  }
  if (!submitRes.ok) {
    fail("fal submit failed", {
      http: submitRes.status,
      detail: submitJson,
    });
  }
  const requestId = submitJson.request_id || submitJson.requestId;
  if (!requestId) {
    // Some models return the result immediately from fal.run-style payloads
    if (submitJson.images) return submitJson;
    fail("fal submit missing request_id", { detail: submitJson });
  }

  const statusUrl = `https://queue.fal.run/${model}/requests/${requestId}/status`;
  const resultUrl = `https://queue.fal.run/${model}/requests/${requestId}`;
  const started = Date.now();
  while (Date.now() - started < MAX_WAIT_MS) {
    const stRes = await fetch(statusUrl, { headers: authHeaders(key) });
    const stJson = await stRes.json().catch(() => ({}));
    const status = stJson.status || stJson.state;
    if (status === "COMPLETED" || status === "OK") break;
    if (status === "FAILED" || status === "ERROR" || stJson.error) {
      fail("fal generation failed", { requestId, detail: stJson });
    }
    await sleep(POLL_MS);
  }
  if (Date.now() - started >= MAX_WAIT_MS) {
    fail("fal generation timed out", { requestId, waitedMs: MAX_WAIT_MS });
  }

  const resultRes = await fetch(resultUrl, { headers: authHeaders(key) });
  const resultJson = await resultRes.json().catch(() => ({}));
  if (!resultRes.ok) {
    fail("fal result fetch failed", {
      http: resultRes.status,
      requestId,
      detail: resultJson,
    });
  }
  return { ...resultJson, requestId };
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) fail("image download failed", { http: res.status, urlHost: new URL(url).host });
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buf);
  return buf.length;
}

async function main() {
  const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  loadDotEnv(path.join(skillRoot, ".env"));
  loadDotEnv(path.join(path.dirname(fileURLToPath(import.meta.url)), ".env"));

  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Usage: node fal-generate.mjs --prompt "..." --out <png-path> [--aspect 16:9] [--model ${DEFAULT_MODEL}]
Env: FAL_AI_API_KEY or FAL_KEY required. Optional .env next to skill root.
`);
    process.exit(0);
  }

  const key = resolveFalKey();
  if (!key) {
    fail("FAL_AI_API_KEY or FAL_KEY is not set (process env, Windows User env, or skill .env)");
  }

  let prompt = args.prompt;
  if (args.promptFile) {
    prompt = fs.readFileSync(path.resolve(args.promptFile), "utf8").trim();
  }
  if (!prompt) fail("missing --prompt or --prompt-file");
  if (!args.out) fail("missing --out");

  const imageSize = ASPECT_TO_SIZE[args.aspect];
  if (!imageSize) {
    fail("unsupported --aspect", {
      aspect: args.aspect,
      allowed: Object.keys(ASPECT_TO_SIZE),
    });
  }

  const outPath = path.resolve(args.out);
  const result = await queueGenerate({
    model: args.model,
    key,
    body: {
      prompt,
      image_size: imageSize,
      output_format: "png",
      safety_tolerance: "2",
    },
  });

  const images = result.images || result.data?.images || [];
  const url = images[0]?.url;
  if (!url) fail("fal result missing images[0].url", { keys: Object.keys(result) });

  const bytes = await downloadToFile(url, outPath);
  console.log(
    JSON.stringify({
      ok: true,
      out: outPath,
      model: args.model,
      aspect: args.aspect,
      image_size: imageSize,
      seed: result.seed ?? null,
      requestId: result.requestId ?? result.request_id ?? null,
      bytes,
    }),
  );
}

main().catch((e) => fail(e.message || String(e)));
