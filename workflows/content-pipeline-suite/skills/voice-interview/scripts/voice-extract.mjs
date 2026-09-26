#!/usr/bin/env node
/**
 * Prepare extraction and land a validated Voice DNA file.
 *
 *   node voice-extract.mjs --campaign-dir "..." --speaker "Jordan Hale" --prepare
 *   node voice-extract.mjs --campaign-dir "..." --speaker "Jordan Hale" --land <file> --speaker-verified
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fail, parseArgs } from "./lib/args.mjs";
import {
  requireCampaign,
  resolveCampaignDir,
  speakerSlug,
  voiceArchiveDir,
  voiceDnaPath,
} from "./lib/paths.mjs";
import { findActiveRecordEntry, saveRecord } from "./lib/record.mjs";
import { loadAndValidate } from "./validate-voice-dna.mjs";

const EXTRACT_ACTIONS = [
  "prepare",
  "land",
  "retire",
  "speaker",
  "acceptUnderFloor",
  "confirmOverwrite",
  "speakerVerified",
  "acceptContentFlags",
];

function schemaPath() {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "voice-extractor",
    "references",
    "voice-dna-schema.json",
  );
}

function listVoiceDna(campaignDir) {
  const dir = path.join(campaignDir, "06-content-pipeline", "01-resources");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /voice[-_]?dna/i.test(name) && /\.(json|md)$/i.test(name))
    .map((name) => path.join(dir, name));
}

function extractorSummary(dna) {
  return {
    confidence: dna?.meta?.confidence || null,
    strongest_signals: (dna?.voice_instructions?.do_rules || []).slice(0, 3),
    quoted_evidence: dna?.rhythmic_dna?.sentence_rhythm_signature || dna?.voice_instructions?.summary || null,
  };
}

export function prepareExtract({ campaignDir, speaker } = {}) {
  if (!speaker) return { error: "speaker_required" };
  const entry = findActiveRecordEntry(campaignDir, speaker);
  if (!entry) return { error: "record_not_found" };
  if (entry.data.state !== "captured") {
    return { error: "record_not_captured", extra: { state: entry.data.state } };
  }
  return {
    campaign_dir: campaignDir,
    speaker,
    transcript_path: entry.data.transcript_json,
    schema_path: schemaPath(),
    author: speaker,
    output_path: voiceDnaPath(campaignDir, speaker),
  };
}

function archiveActive(campaignDir, destName) {
  const destDir = voiceArchiveDir(campaignDir);
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, destName);
  return dest;
}

export function landVoiceDna({
  campaignDir,
  speaker,
  inputPath,
  acceptUnderFloor = false,
  confirmOverwrite = false,
  speakerVerified = false,
  acceptContentFlags = false,
} = {}) {
  if (!speaker) return { error: "speaker_required" };
  if (!inputPath) return { error: "file_required" };
  const entry = findActiveRecordEntry(campaignDir, speaker);
  if (!entry) return { error: "record_not_found" };
  const record = entry.data;
  if (record.state !== "captured") {
    return { error: "record_not_captured", extra: { state: record.state } };
  }
  const checked = loadAndValidate(inputPath, { speaker });
  if (!checked.ok) {
    return { error: "invalid_voice_dna", extra: { violations: checked.violations } };
  }
  const summary = extractorSummary(checked.dna);
  const accessLog = record.access_log || [];
  if (record.under_floor && !acceptUnderFloor) {
    return {
      error: "under_floor_unresolved",
      extra: { word_count: record.word_count, access_log: accessLog, extractor_summary: summary },
    };
  }
  if (!speakerVerified) {
    return {
      error: "speaker_identity_unverified",
      extra: { access_log: accessLog, extractor_summary: summary },
    };
  }
  if (checked.flags.length && !acceptContentFlags) {
    return {
      error: "content_flags_unresolved",
      extra: { flags: checked.flags, access_log: accessLog, extractor_summary: summary },
    };
  }

  const dest = voiceDnaPath(campaignDir, speaker);
  const existing = listVoiceDna(campaignDir);
  const priorForAuthor = existing.find((file) => path.resolve(file) === path.resolve(dest));
  if (priorForAuthor && !confirmOverwrite) {
    return { error: "voice_dna_exists", extra: { path: dest } };
  }

  const retired = [];
  if (priorForAuthor && confirmOverwrite) {
    const stamp = new Date().toISOString().slice(0, 10);
    const archived = archiveActive(
      campaignDir,
      `${path.basename(priorForAuthor, path.extname(priorForAuthor))}-${stamp}-superseded${path.extname(priorForAuthor)}`,
    );
    fs.renameSync(priorForAuthor, archived);
    retired.push(archived);
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, `${JSON.stringify(checked.dna, null, 2)}\n`);

  record.state = "extracted";
  record.voice_dna_path = dest;
  const saved = saveRecord(entry);
  if (saved?.error) return saved;

  const remaining = listVoiceDna(campaignDir);
  const warning =
    remaining.length > 1
      ? "Draft step will ask which voice to use per post (two or more *voice-dna* files)."
      : null;

  return {
    campaign_dir: campaignDir,
    state: "extracted",
    transcript_path: record.transcript_json,
    voice_dna_path: dest,
    retired_paths: retired,
    extractor_summary: extractorSummary(checked.dna),
    access_log: record.access_log || [],
    warning,
  };
}

export function retireVoiceDna({ campaignDir, speaker } = {}) {
  if (!speaker) return { error: "speaker_required" };
  const dest = voiceDnaPath(campaignDir, speaker);
  if (!fs.existsSync(dest)) {
    return {
      error: "voice_dna_not_found",
      extra: { glob: `${speakerSlug(speaker)}-voice-dna.json` },
    };
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const archived = archiveActive(
    campaignDir,
    `${path.basename(dest, ".json")}-${stamp}-retired.json`,
  );
  fs.renameSync(dest, archived);
  const entry = findActiveRecordEntry(campaignDir, speaker);
  if (entry) {
    entry.data.voice_dna_path = null;
    saveRecord(entry);
  }
  return {
    campaign_dir: campaignDir,
    retired_path: archived,
    remaining: listVoiceDna(campaignDir),
  };
}

export function main(argv = process.argv) {
  const args = parseArgs(argv, { actions: EXTRACT_ACTIONS });
  if (args.foreignFlag) fail("foreign_flag", { flag: args.foreignFlag });
  if (args.help) {
    console.log(
      "usage: voice-extract.mjs --campaign-dir <abs> --speaker <name> (--prepare | --land <file> [--speaker-verified] [--accept-under-floor] [--confirm-overwrite] [--accept-content-flags] | --retire)",
    );
    return;
  }
  if (args.unknown) fail("unknown_flag", { flag: args.unknown });
  const campaignDir = resolveCampaignDir(args);
  requireCampaign(campaignDir);
  if (!args.speaker) fail("speaker_required");
  console.log(JSON.stringify({ campaign_dir: campaignDir }));

  let result;
  if (args.prepare) {
    result = prepareExtract({ campaignDir, speaker: args.speaker });
  } else if (args.land) {
    result = landVoiceDna({
      campaignDir,
      speaker: args.speaker,
      inputPath: args.extras[0],
      acceptUnderFloor: Boolean(args.acceptUnderFloor),
      confirmOverwrite: Boolean(args.confirmOverwrite),
      speakerVerified: Boolean(args.speakerVerified),
      acceptContentFlags: Boolean(args.acceptContentFlags),
    });
  } else if (args.retire) {
    result = retireVoiceDna({ campaignDir, speaker: args.speaker });
  } else {
    fail("action_required");
  }
  if (result?.error) fail(result.error, result.extra || {});
  console.log(JSON.stringify(result, null, 2));
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
