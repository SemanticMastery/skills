import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertSplitSource, findClientTokens, formatHit } from "./lib/client-tokens.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, "..", "..");
const helperRel = "scripts/tests/lib/client-tokens.mjs";
const allowSuffix = "test-output/brand-serp-audit-roto-rooter-90210-2026-05-27.json";
const skipExt = new Set([".xlsx",".png",".jpg",".jpeg",".gif",".zip",".pdf",".ico",".woff",".woff2",".mp4",".mov",".webp",".docx",".doc",".pptx",".xls"]);

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".git") continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function relPosix(full) {
  return path.relative(skillRoot, full).replaceAll("\\", "/");
}

test("holds no client text", () => {
  const files = walk(skillRoot).filter((full) => !skipExt.has(path.extname(full).toLowerCase()));
  assert.ok(files.length > 0);
  const hits = [];
  for (const full of files) {
    const rel = relPosix(full);
    if (rel === helperRel || rel.endsWith(allowSuffix)) continue;
    const text = fs.readFileSync(full, "utf8");
    for (const hit of findClientTokens(text)) hits.push(rel + " [" + formatHit(hit) + "]");
  }
  assert.deepEqual(hits, []);
});

test("helper stores tokens as split pairs", () => {
  const source = fs.readFileSync(path.join(here, "lib", "client-tokens.mjs"), "utf8");
  assertSplitSource(source);
});
