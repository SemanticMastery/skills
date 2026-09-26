#!/usr/bin/env node
/**
 * Mint, status, and pull a voice-interview host session.
 *
 *   node voice-session.mjs --campaign-dir "..." --speaker "Jordan Hale" --create-link
 *   node voice-session.mjs --campaign-dir "..." --speaker "Jordan Hale" --status
 *   node voice-session.mjs --campaign-dir "..." --speaker "Jordan Hale" --pull [--from-file export.json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fail, parseArgs } from "./lib/args.mjs";
import * as defaultHost from "./lib/host-client.mjs";
import { voiceSessionPayload } from "./lib/host-client.mjs";
import {
  agencySlug,
  companySlug,
  displayLabel,
  requireCampaign,
  resolveCampaignDir,
  speakerSlug,
  voiceTranscriptPair,
} from "./lib/paths.mjs";
import { atomicWrite, findActiveRecordEntry, saveRecord } from "./lib/record.mjs";
import { getCall } from "./lib/retell.mjs";

const FLOOR_WORDS = 2000;
const POLL_ATTEMPTS = 15;
const POLL_MS = 60_000;

const SESSION_ACTIONS = [
  "createLink",
  "status",
  "pull",
  "fromFile",
  "acceptWithdrawn",
  "expires",
  "speaker",
];

function loadExport(fromFile, fallback) {
  if (fallback) return fallback;
  if (!fromFile) return null;
  return JSON.parse(fs.readFileSync(fromFile, "utf8"));
}

function turnsFromCall(call) {
  if (Array.isArray(call?.transcript_object)) return call.transcript_object;
  if (Array.isArray(call?.transcript?.utterances)) return call.transcript.utterances;
  if (Array.isArray(call?.utterances)) return call.utterances;
  return [];
}

export function countUserWords(calls = []) {
  let n = 0;
  for (const call of calls) {
    for (const turn of turnsFromCall(call)) {
      const role = String(turn.role || "").toLowerCase();
      if (role !== "user") continue;
      n += String(turn.content || turn.text || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
    }
  }
  return n;
}

function callDurationMs(call) {
  if (Number.isFinite(call?.duration_ms)) return call.duration_ms;
  if (Number.isFinite(call?.duration)) return call.duration;
  return 0;
}

function renderTranscriptMd({ speaker, calls }) {
  const lines = [`# Voice interview transcript — ${speaker}`, ""];
  for (const call of calls) {
    lines.push(`## ${call.call_id}`);
    for (const turn of turnsFromCall(call)) {
      lines.push(`- **${turn.role || "speaker"}:** ${turn.content || turn.text || ""}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function sameSpeaker(record, data) {
  if (!data?.speaker) return true;
  return speakerSlug(record.speaker) === speakerSlug(data.speaker);
}

function sameCampaign(record, data) {
  if (!data?.campaign) return true;
  return String(record.campaign) === String(data.campaign);
}

async function fillTranscripts(calls, retellGetCall, sleep) {
  const out = [];
  for (const call of calls) {
    const next = { ...call };
    if (turnsFromCall(next).length) {
      out.push(next);
      continue;
    }
    if (!call.call_id) {
      out.push(next);
      continue;
    }
    let fetched = null;
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
      fetched = await retellGetCall(call.call_id);
      const turns = turnsFromCall(fetched || {});
      if (turns.length) {
        next.transcript_object = fetched.transcript_object || turns;
        next.transcript = fetched.transcript || { utterances: turns };
        break;
      }
      if (attempt < POLL_ATTEMPTS - 1) await sleep(POLL_MS);
    }
    if (!turnsFromCall(next).length) {
      return { error: "transcript_pending", extra: { call_id: call.call_id } };
    }
    out.push(next);
  }
  return { calls: out };
}

export async function createLink({ campaignDir, speaker, args = {}, host = defaultHost } = {}) {
  if (!speaker) return { error: "speaker_required" };
  const recordEntry = findActiveRecordEntry(campaignDir, speaker);
  if (!recordEntry) return { error: "record_not_found" };
  const record = recordEntry.data;
  if (record.state === "extracted" || record.state === "superseded") {
    return { error: "record_not_writable", extra: { state: record.state } };
  }
  const payload = {
    ...voiceSessionPayload({
      campaign: record.campaign || companySlug(campaignDir),
      agency: agencySlug(campaignDir),
      speaker: record.speaker,
      speaker_slug: record.speaker_slug || speakerSlug(speaker),
      expires: args.expires,
    }),
    record_id: path.basename(recordEntry.json),
    agency_name: displayLabel(agencySlug(campaignDir)),
    company_name: displayLabel(record.campaign || companySlug(campaignDir)),
  };
  try {
    const session = await host.createSession(payload);
    record.host_session_id = session.session_id;
    record.voice_session_id = session.session_id;
    record.voice_url = session.url;
    const wrote = saveRecord(recordEntry);
    if (wrote?.error) return wrote;
    return {
      campaign_dir: campaignDir,
      url: session.url,
      session_id: session.session_id,
      agent_kind: payload.agent_kind,
      speaker: record.speaker,
    };
  } catch (err) {
    return { error: err.code || "host_http_error", extra: { message: err.message, http: err.http } };
  }
}

export async function statusSession({ campaignDir, speaker, host = defaultHost } = {}) {
  if (!speaker) return { error: "speaker_required" };
  const recordEntry = findActiveRecordEntry(campaignDir, speaker);
  if (!recordEntry) return { error: "record_not_found" };
  try {
    const remote = await host.getStatus(
      recordEntry.data.host_session_id || recordEntry.data.voice_session_id,
    );
    return { campaign_dir: campaignDir, record_state: recordEntry.data.state, ...remote };
  } catch (err) {
    return { error: err.code || "host_http_error", extra: { message: err.message, http: err.http } };
  }
}

export async function pullSession({
  campaignDir,
  speaker,
  fromFile,
  acceptWithdrawn = false,
  exportData,
  host = defaultHost,
  retellGetCall = getCall,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  if (!speaker) return { error: "speaker_required" };
  const recordEntry = findActiveRecordEntry(campaignDir, speaker);
  if (!recordEntry) return { error: "record_not_found" };
  const record = recordEntry.data;
  if (record.state === "extracted" || record.state === "superseded") {
    return { error: "record_not_writable", extra: { state: record.state } };
  }

  let data;
  try {
    data = loadExport(fromFile, exportData);
  } catch (err) {
    return { error: "export_invalid", extra: { message: String(err?.message || err) } };
  }
  if (!data) {
    try {
      data = await host.exportSession(record.host_session_id || record.voice_session_id);
    } catch (err) {
      return { error: err.code || "host_http_error", extra: { message: err.message, http: err.http } };
    }
  }

  if (data.status === "in_progress" || data.call_live) return { error: "call_live" };
  if (data.status === "consent_refused") {
    return { consent: "refused", changed: false, written: [] };
  }
  if (data.status === "consent_withdrawn" && !acceptWithdrawn) {
    return { error: "consent_withdrawn", consent: "withdrawn", changed: false, written: [] };
  }
  if (data.status === "consent_withdrawn" && acceptWithdrawn) {
    return { consent: "withdrawn", accepted: true, changed: false, written: [] };
  }

  if (data.record_id && path.basename(recordEntry.json) !== data.record_id) {
    return { error: "record_mismatch", extra: { record_id: data.record_id } };
  }
  if (!sameSpeaker(record, data) || !sameCampaign(record, data)) {
    return {
      error: "record_mismatch",
      extra: { speaker: data.speaker, campaign: data.campaign },
    };
  }

  const filled = await fillTranscripts(data.calls || [], retellGetCall, sleep);
  if (filled.error) return filled;
  const calls = filled.calls;
  const wordCount = countUserWords(calls);
  const durationMs = calls.reduce((sum, call) => sum + callDurationMs(call), 0);
  const underFloor = wordCount < FLOOR_WORDS;

  const pair = voiceTranscriptPair(campaignDir, speaker, record.opened);
  const transcript = {
    kind: "voice-interview-transcript",
    campaign: record.campaign,
    speaker: record.speaker,
    host_session_id: record.host_session_id,
    call_ids: calls.map((call) => call.call_id).filter(Boolean),
    word_count: wordCount,
    duration_ms: durationMs,
    calls,
  };
  fs.mkdirSync(path.dirname(pair.json), { recursive: true });
  const jsonErr = atomicWrite(pair.json, `${JSON.stringify(transcript, null, 2)}\n`);
  if (jsonErr) return jsonErr;
  const mdErr = atomicWrite(pair.md, renderTranscriptMd({ speaker: record.speaker, calls }));
  if (mdErr) return mdErr;

  record.call_ids = transcript.call_ids;
  record.transcript_json = pair.json;
  record.transcript_md = pair.md;
  record.word_count = wordCount;
  record.under_floor = underFloor;
  record.state = "captured";
  const captured = saveRecord(recordEntry);
  if (captured?.error) return captured;

  if (record.host_session_id || record.voice_session_id) {
    try {
      await host.ackPulled(record.host_session_id || record.voice_session_id, record.call_ids);
    } catch {
      /* ack is best-effort after a fixture pull */
    }
  }

  return {
    campaign_dir: campaignDir,
    state: "captured",
    transcript_json: pair.json,
    transcript_md: pair.md,
    word_count: wordCount,
    duration_ms: durationMs,
    under_floor: underFloor,
    written: [pair.json, pair.md],
  };
}

export async function main(argv = process.argv, deps = {}) {
  const args = parseArgs(argv, { actions: SESSION_ACTIONS });
  if (args.foreignFlag) fail("foreign_flag", { flag: args.foreignFlag });
  if (args.help) {
    console.log(
      "usage: voice-session.mjs --campaign-dir <abs> --speaker <name> (--create-link | --status | --pull [--from-file <path>] [--accept-withdrawn])",
    );
    return;
  }
  if (args.unknown) fail("unknown_flag", { flag: args.unknown });
  const campaignDir = resolveCampaignDir(args);
  requireCampaign(campaignDir);
  if (!args.speaker) fail("speaker_required");
  console.log(JSON.stringify({ campaign_dir: campaignDir }));

  const host = deps.host || defaultHost;
  let result;
  if (args.createLink) {
    result = await createLink({ campaignDir, speaker: args.speaker, args, host });
  } else if (args.status) {
    result = await statusSession({ campaignDir, speaker: args.speaker, host });
  } else if (args.pull) {
    result = await pullSession({
      campaignDir,
      speaker: args.speaker,
      fromFile: args.fromFile,
      acceptWithdrawn: Boolean(args.acceptWithdrawn),
      host,
      retellGetCall: deps.retellGetCall || getCall,
      sleep: deps.sleep,
    });
  } else {
    fail("action_required");
  }
  if (result?.error) fail(result.error, result.extra || result);
  console.log(JSON.stringify(result, null, 2));
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
