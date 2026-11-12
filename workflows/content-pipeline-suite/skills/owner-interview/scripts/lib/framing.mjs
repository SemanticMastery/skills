/**
 * Framing lint primitives. Kept apart from compile.mjs so record.mjs and
 * publish-default.mjs can use them without importing compile.mjs, which itself
 * imports record.mjs. compile.mjs re-exports these names.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SEED_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "references",
  "industry-seeds",
  "tree-care.md",
);

export const CITATION_RE = /\[PD-SRC-[0-9A-Z]+\]/gi;
const CURRENCY_RE = /[$€£¥₹]/;

const BRAND_STOP = new Set([
  "ASK",
  "NEVER",
  "ASSERT",
  "FAQ",
  "FAQS",
  "PD",
  "SRC",
  "CTA",
  "ICP",
  "LLC",
]);

let brandTokenCache;

export function stripCitations(text) {
  CITATION_RE.lastIndex = 0;
  return String(text || "").replace(CITATION_RE, "");
}

export function loadBrandTokens(seedText) {
  if (seedText == null && brandTokenCache) return brandTokenCache;
  const seed = seedText == null ? fs.readFileSync(SEED_PATH, "utf8") : String(seedText);
  const tokens = new Set();
  for (const m of seed.matchAll(/"([^"]+)"/g)) {
    const phrase = m[1].trim().toLowerCase();
    if (phrase.length >= 3 && !/ask, never assert/i.test(phrase)) tokens.add(phrase);
  }
  for (const m of seed.matchAll(/\b[A-Z]{2,}(?:[- ][A-Z0-9]+)*\b/g)) {
    const token = m[0];
    if (BRAND_STOP.has(token)) continue;
    tokens.add(token.toLowerCase());
  }
  if (seedText == null) brandTokenCache = tokens;
  return tokens;
}

function escapeRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function lintFraming(text, hunkId, seedText) {
  const stripped = stripCitations(text);
  if (/\d/.test(stripped) || CURRENCY_RE.test(stripped) || /%/.test(stripped)) {
    return { error: "framing_lint", hunk: hunkId };
  }
  const lower = stripped.toLowerCase();
  for (const token of loadBrandTokens(seedText)) {
    if (token.length < 2) continue;
    if (new RegExp(`\\b${escapeRe(token)}\\b`, "i").test(lower)) {
      return { error: "framing_lint", hunk: hunkId };
    }
  }
  return null;
}
