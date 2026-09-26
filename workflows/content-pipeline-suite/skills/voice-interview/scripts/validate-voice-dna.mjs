#!/usr/bin/env node
/**
 * Mechanical Voice DNA checks before landing (KTD12).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fail, parseArgs } from "./lib/args.mjs";
import { speakerSlug } from "./lib/paths.mjs";

export const REQUIRED_SECTIONS = [
  "$schema",
  "meta",
  "structural_dna",
  "rhythmic_dna",
  "emotional_dna",
  "semantic_dna",
  "hook_architecture",
  "persuasion_architecture",
  "anti_patterns",
  "voice_instructions",
];

const CONFIDENCE = new Set(["low", "medium", "high"]);
const URL_RE = /https?:\/\/|www\./i;
const PHONE_RE = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
const WRITER_RE =
  /\b(write|draft|create|publish|mention|include)\b.{0,40}\b(blog|article|post|copy|cta|page)\b/i;

function walkStrings(value, visit) {
  if (typeof value === "string") visit(value);
  else if (Array.isArray(value)) value.forEach((item) => walkStrings(item, visit));
  else if (value && typeof value === "object") {
    for (const item of Object.values(value)) walkStrings(item, visit);
  }
}

export function contentFlags(dna) {
  const flags = [];
  const targets = [
    dna?.voice_instructions?.do_rules,
    dna?.voice_instructions?.never_rules,
    dna?.semantic_dna,
    dna?.anti_patterns,
  ];
  walkStrings(targets, (text) => {
    if (URL_RE.test(text)) flags.push({ kind: "url", text });
    if (PHONE_RE.test(text)) flags.push({ kind: "phone", text });
    if (WRITER_RE.test(text)) flags.push({ kind: "writer_imperative", text });
  });
  return flags;
}

export function validateVoiceDna(dna, { speaker } = {}) {
  const violations = [];
  if (!dna || typeof dna !== "object") {
    return { ok: false, violations: ["not_object"], flags: [] };
  }
  if (dna.$schema !== "voice-dna-v1") violations.push("schema");
  for (const key of REQUIRED_SECTIONS) {
    if (!(key in dna)) violations.push(`missing_${key}`);
  }
  const author = String(dna.meta?.author || "").trim();
  if (!author) violations.push("empty_author");
  if (speaker && author && speakerSlug(author) !== speakerSlug(speaker)) {
    violations.push("author_mismatch");
  }
  if (!CONFIDENCE.has(dna.meta?.confidence)) violations.push("invalid_confidence");
  const types = dna.meta?.sample_types;
  if (!Array.isArray(types) || !types.includes("interview_transcript")) {
    violations.push("missing_interview_transcript");
  }
  const doRules = dna.voice_instructions?.do_rules;
  const neverRules = dna.voice_instructions?.never_rules;
  if (!Array.isArray(doRules) || doRules.filter(Boolean).length === 0) violations.push("empty_do_rules");
  if (!Array.isArray(neverRules) || neverRules.filter(Boolean).length === 0) {
    violations.push("empty_never_rules");
  }
  const flags = contentFlags(dna);
  return { ok: violations.length === 0, violations, flags };
}

export function loadAndValidate(filePath, opts = {}) {
  let dna;
  try {
    dna = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    return { ok: false, violations: ["malformed_json"], flags: [], extra: { message: String(err.message) } };
  }
  return { ...validateVoiceDna(dna, opts), dna };
}

export function main(argv = process.argv) {
  const args = parseArgs(argv, { actions: ["speaker"] });
  if (args.help) {
    console.log("usage: validate-voice-dna.mjs <file> [--speaker <name>]");
    return;
  }
  const filePath = args.extras[0];
  if (!filePath) fail("file_required");
  const result = loadAndValidate(filePath, { speaker: args.speaker });
  if (!result.ok) fail("invalid_voice_dna", { violations: result.violations });
  console.log(JSON.stringify({ ok: true, flags: result.flags }, null, 2));
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
