#!/usr/bin/env node
/**
 * Voice mode: create a call link, show status, and pull a finished session.
 *
 *   node interview-voice.mjs --campaign-dir "..." --scope oak-wilt-treatment --create-link
 *   node interview-voice.mjs --campaign-dir "..." --scope oak-wilt-treatment --status
 *   node interview-voice.mjs --campaign-dir "..." --scope oak-wilt-treatment --pull [--from-file export.json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fail, parseArgs } from "./lib/args.mjs";
import { groundFact } from "./lib/grounding.mjs";
import * as defaultHost from "./lib/host-client.mjs";
import { packHash, publishBeforeParent, spokenPrompt } from "./lib/pack.mjs";
import {
  agencyDisplayName,
  agencySlug,
  agencyUrlSlug,
  brandedSessionUrl,
  companySlug,
  displayLabel,
  serviceTitle,
  requireCampaign,
  resolveCampaignDir,
  transcriptPair,
} from "./lib/paths.mjs";
import {
  applyAnswer,
  applyUnanswered,
  atomicWrite,
  findActiveRecordEntry,
  findPackEntry,
  isPack,
  isRecord,
  listInterviewEntries,
  writePair,
} from "./lib/record.mjs";
import { getCall } from "./lib/retell.mjs";

const VOICE_ACTIONS = [
  "createLink",
  "status",
  "pull",
  "fromFile",
  "acceptWithdrawn",
  "acceptPackHash",
  "expires",
  "answeredBy",
  "role",
];

const RESUMABLE = new Set(["created", "opened", "connecting", "consent_pending", "in_progress", "dropped", "ended_early"]);

function newestPackEntry(campaignDir, scope) {
  const entries = listInterviewEntries(campaignDir, scope).filter((entry) => isPack(entry.data) && !isRecord(entry.data));
  return entries.length ? entries[entries.length - 1] : findPackEntry(campaignDir, scope);
}

function conflictCopyPresent(recordPath) {
  const dir = path.dirname(recordPath);
  const base = path.basename(recordPath, ".json");
  return fs.readdirSync(dir).some(
    (name) =>
      name !== path.basename(recordPath) &&
      name.startsWith(base) &&
      /DESKTOP|conflicted copy/i.test(name),
  );
}

function questionMap(pack) {
  return new Map((pack?.questions || []).map((question) => [question.id, question]));
}

function publishParentOf(pack, publishId) {
  return (pack?.questions || []).find((question) => question.publish_link === publishId) || null;
}

function publishDecisionFor(pack, questionId, answersById) {
  const question = questionMap(pack).get(questionId);
  if (!question) return { publish: "internal", source: "missing" };
  const publishId = question.publish_link;
  if (!publishId) return { publish: "internal", source: "missing" };
  const pubRow = answersById.get(publishId);
  const value = pubRow?.publish_decision;
  if (value === "public" || value === "framing-only" || value === "internal") {
    return { publish: value, source: pubRow.publish_source || "spoken" };
  }
  return { publish: "internal", source: "missing" };
}

function renderTranscriptMd(call) {
  const lines = [`# Interview transcript — ${call.call_id}`, ""];
  for (const turn of call.transcript?.utterances || call.utterances || []) {
    lines.push(`- **${turn.role || "speaker"}:** ${turn.content || turn.text || ""}`);
  }
  return `${lines.join("\n")}\n`;
}

function buildTranscriptFromSlices(call) {
  const utterances = [];
  for (const answer of call.answers || []) {
    if (answer.owner_slice || answer.owner_words) {
      utterances.push({
        role: "user",
        content: answer.owner_slice || answer.owner_words,
        question_id: answer.question_id,
      });
    }
  }
  return { utterances };
}

function seedAnsweredIds(record) {
  return (record.answers || [])
    .filter((row) => row.status === "answered")
    .map((row) => row.question_id);
}

export async function createLink({ campaignDir, scope, args = {}, host = defaultHost } = {}) {
  if (!scope) return { error: "scope_required" };
  const packEntry = newestPackEntry(campaignDir, scope);
  if (!packEntry) return { error: "pack_not_found" };
  const pack = packEntry.data;
  const violation = publishBeforeParent(pack.questions || []);
  if (violation) return { error: "publish_before_parent", extra: violation };
  const recordEntry = findActiveRecordEntry(campaignDir, scope);
  if (!recordEntry) return { error: "record_not_found" };
  const record = recordEntry.data;
  if (record.state === "compiled" || record.state === "superseded") {
    return { error: "record_not_writable", extra: { state: record.state } };
  }
  const questionIds = (pack.questions || []).map((question) => question.id);
  const seeded = seedAnsweredIds(record);
  const remaining = questionIds.filter((id) => !seeded.includes(id));
  const payload = {
    campaign: record.campaign || companySlug(campaignDir),
    scope,
    record_id: path.basename(recordEntry.json),
    pack_file: record.pack_file || packEntry.name.replace(/\.json$/i, ".md"),
    pack_hash: packHash(pack),
    question_ids: questionIds,
    remaining_question_ids: remaining,
    questions: (pack.questions || []).map((question) => ({
      id: question.id,
      type: question.type,
      prompt: spokenPrompt(question.prompt),
      answer_shape: question.answer_shape,
      followup: question.followup,
      publish_link: question.publish_link,
      claim: question.claim,
    })),
    answered_by: args.answeredBy || null,
    role: args.role || null,
    expires: args.expires || null,
    agency_name:
      args.agencyName ||
      record.agency_name ||
      agencyDisplayName(agencySlug(campaignDir)),
    agency_slug: args.agencySlug || agencyUrlSlug(campaignDir),
    agency: args.agencySlug || agencyUrlSlug(campaignDir),
    company_name:
      args.companyName || displayLabel(record.campaign || companySlug(campaignDir)),
    owner_name: args.ownerName || args.answeredBy || record.answered_by || "the owner",
    service_title: args.serviceTitle || serviceTitle(scope),
  };
  try {
    const session = await host.createSession(payload);
    const reusedUrl =
      record.voice_session_id &&
      record.voice_url &&
      session.session_id === record.voice_session_id
        ? record.voice_url
        : null;
    const publicUrl =
      reusedUrl ||
      brandedSessionUrl({
        fallbackUrl: session.url,
        agencySlug: payload.agency_slug,
        sessionId: session.session_id,
      });
    record.voice_session_id = session.session_id;
    record.voice_url = publicUrl;
    const wrote = writePair(recordEntry.json, recordEntry.md, record, pack);
    if (wrote?.error) return wrote;
    return {
      url: publicUrl,
      session_id: session.session_id,
      remaining_question_ids: session.remaining_question_ids || remaining,
      resumable: session.resumable ?? RESUMABLE.has(session.status || "created"),
    };
  } catch (err) {
    return { error: err.code || "host_http_error", extra: { message: err.message, http: err.http } };
  }
}

export async function statusSession({ campaignDir, scope, host = defaultHost } = {}) {
  const recordEntry = findActiveRecordEntry(campaignDir, scope);
  if (!recordEntry) return { error: "record_not_found" };
  try {
    const remote = await host.getStatus(recordEntry.data.voice_session_id || recordEntry.data.session_id);
    return { record_state: recordEntry.data.state, ...remote };
  } catch (err) {
    return { error: err.code || "host_http_error", extra: { message: err.message, http: err.http } };
  }
}

function loadExport(fromFile, fallback) {
  if (fallback) return fallback;
  if (!fromFile) return null;
  return JSON.parse(fs.readFileSync(fromFile, "utf8"));
}

function callDate(call) {
  const stamp = call.started_at || call.start || call.call_start;
  if (!stamp) return null;
  return String(stamp).slice(0, 10);
}

function groundingWords(answer, question) {
  const slice = answer.owner_slice;
  const words = slice == null || slice === "" ? "" : String(slice);
  if (question?.type === "verify" && answer.verify === "true" && question.claim?.text) {
    return `${words} ${question.claim.text}`.trim();
  }
  return words;
}

function proposedFacts(answer) {
  const raw = answer.facts || [];
  return raw.map((fact) => (typeof fact === "string" ? { text: fact } : { ...fact }));
}

export async function pullSession({
  campaignDir,
  scope,
  fromFile,
  acceptWithdrawn = false,
  acceptPackHash = false,
  exportData,
  host = defaultHost,
  retellGetCall = getCall,
} = {}) {
  if (!scope) return { error: "scope_required" };
  const packEntry = newestPackEntry(campaignDir, scope);
  if (!packEntry) return { error: "pack_not_found" };
  const recordEntry = findActiveRecordEntry(campaignDir, scope);
  if (!recordEntry) return { error: "record_not_found" };
  const record = recordEntry.data;
  if (record.state === "compiled" || record.state === "superseded") {
    return { error: "record_not_writable", extra: { state: record.state } };
  }
  if (conflictCopyPresent(recordEntry.json)) {
    return { error: "conflict_copy_present" };
  }

  let data;
  try {
    data = loadExport(fromFile, exportData);
  } catch (err) {
    return { error: "export_invalid", extra: { message: String(err?.message || err) } };
  }
  if (!data) {
    try {
      data = await host.exportSession(record.voice_session_id || record.session_id);
    } catch (err) {
      return { error: err.code || "host_http_error", extra: { message: err.message, http: err.http } };
    }
  }

  if (data.status === "in_progress" || data.call_live) return { error: "call_live" };
  if (data.status === "consent_refused") {
    return { consent: "refused", changed: false, written: [] };
  }
  if (data.status === "consent_withdrawn" && !acceptWithdrawn) {
    const held = (data.calls || []).reduce((n, call) => n + (call.answers || []).length, 0);
    return { consent: "withdrawn", held, changed: false, written: [] };
  }

  if (data.record_id && path.basename(recordEntry.json) !== data.record_id) {
    return { error: "record_mismatch", extra: { record_id: data.record_id } };
  }

  const currentIds = (packEntry.data.questions || []).map((question) => question.id);
  const exportIds = data.question_ids || [];
  const idsDiffer = exportIds.length && exportIds.join("\n") !== currentIds.join("\n");
  const hash = packHash(packEntry.data);
  const hashDiffers = data.pack_hash && data.pack_hash !== hash;
  const newestName = packEntry.name.replace(/\.json$/i, ".md");
  const packFileStale = record.pack_file && newestName && record.pack_file !== newestName && packEntry.name !== path.basename(recordEntry.json);
  if (idsDiffer || (!acceptPackHash && hashDiffers) || (data.pack_file && packFileStale && data.kind === "superseded_pack")) {
    return {
      error: "pack_mismatch",
      extra: { kind: idsDiffer ? "ids" : hashDiffers ? "hash" : "superseded_pack" },
    };
  }
  if (!acceptPackHash && hashDiffers) {
    return { error: "pack_mismatch", extra: { kind: "hash" } };
  }

  const ledger = Array.isArray(record.voice_calls) ? [...record.voice_calls] : [];
  const ledgerIds = new Set(ledger.map((row) => row.call_id));
  const notes = [];
  const conflicts = [];
  let retellMissing = false;
  const written = [];
  const pack = packEntry.data;
  const byQ = questionMap(pack);
  const answersById = new Map();
  for (const call of data.calls || []) {
    for (const answer of call.answers || []) answersById.set(answer.question_id, answer);
  }

  const ackOnly = [];
  for (const call of data.calls || []) {
    if (!call.call_id) continue;
    if (ledgerIds.has(call.call_id)) {
      ackOnly.push(call.call_id);
      continue;
    }
    const date = callDate(call);
    if (!date) return { error: "call_start_missing", extra: { call_id: call.call_id } };

    let transcript = call.transcript || null;
    if (!transcript) {
      try {
        const remote = await retellGetCall(call.call_id);
        transcript = { utterances: remote.transcript_object || remote.transcript || [] };
      } catch (err) {
        if (err?.http === 404 || err?.code === "retell_call_missing") {
          retellMissing = true;
          transcript = buildTranscriptFromSlices(call);
          notes.push("retell_call_missing");
        } else {
          return { error: err.code || "retell_http_error", extra: { message: err.message, http: err.http } };
        }
      }
    }

    const n = ledger.length + 1;
    const pair = transcriptPair(campaignDir, scope, date, n);
    const jsonBody = JSON.stringify(transcript, null, 2);
    const mdBody = renderTranscriptMd({ ...call, transcript });
    fs.mkdirSync(path.dirname(pair.json), { recursive: true });
    const jErr = atomicWrite(pair.json, jsonBody);
    if (jErr?.error) return jErr;
    const mErr = atomicWrite(pair.md, mdBody);
    if (mErr?.error) return mErr;
    written.push(pair.basenameJson, pair.basenameMd);

    const questionIds = [];
    const unansweredIds = [];
    const firstLast = `${(call.answers || [])[0]?.question_id || "q"}-${(call.answers || []).at(-1)?.question_id || "q"}`;
    const transcriptRef = `${call.call_id}#${firstLast}`;

    for (const answer of call.answers || []) {
      const question = byQ.get(answer.question_id);
      const existing = (record.answers || []).find((row) => row.question_id === answer.question_id);
      if (existing?.status === "answered" && existing.channel && existing.channel !== "voice") {
        conflicts.push({ question_id: answer.question_id, reason: "answered_other_channel" });
        continue;
      }
      if (existing?.status === "answered" && existing.channel === "voice" && existing.transcript_ref && !String(existing.transcript_ref).startsWith(`${call.call_id}#`)) {
        conflicts.push({ question_id: answer.question_id, reason: "answered_by_prior_call" });
        continue;
      }
      questionIds.push(answer.question_id);
      if (answer.status === "unanswered") {
        applyUnanswered(record, answer.question_id, call.call_id);
        unansweredIds.push(answer.question_id);
        continue;
      }
      const decision = answer.publish_decision
        ? { publish: answer.publish_decision, source: answer.publish_source || "spoken" }
        : publishDecisionFor(pack, answer.question_id, answersById);
      if (question?.type === "publish") {
        applyAnswer(
          record,
          {
            question_id: answer.question_id,
            answered_by: answer.answered_by || data.answered_by || "Jordan Hale",
            role: answer.role || data.role || "owner",
            date,
            channel: "voice",
            raw: answer.owner_words || answer.owner_slice || "",
            facts: [],
            transcript_ref: transcriptRef,
          },
          call.call_id,
        );
        continue;
      }
      const words = groundingWords(answer, question);
      const facts = proposedFacts(answer).map((fact) => {
        const review = groundFact(fact.text, words);
        const row = { text: fact.text, publish: decision.publish };
        if (review) row.review = review;
        return row;
      });
      if (answer.verify != null && question?.type !== "verify") {
        notes.push(`verify_ignored:${answer.question_id}`);
      }
      applyAnswer(
        record,
        {
          question_id: answer.question_id,
          answered_by: answer.answered_by || data.answered_by || "Jordan Hale",
          role: answer.role || data.role || "owner",
          date,
          channel: "voice",
          raw: answer.owner_words || "",
          facts,
          transcript_ref: transcriptRef,
          verify: question?.type === "verify" ? answer.verify : undefined,
        },
        call.call_id,
      );
    }

    ledger.push({
      call_id: call.call_id,
      pulled_at: new Date().toISOString(),
      question_ids: questionIds,
      unanswered_ids: unansweredIds,
    });
    ledgerIds.add(call.call_id);
  }

  const newCalls = (data.calls || []).filter((call) => call.call_id && !ackOnly.includes(call.call_id));
  if (!newCalls.length) {
    return {
      state: record.state,
      changed: false,
      ack_retried: ackOnly.length > 0,
      consent: data.status === "consent_withdrawn" ? "withdrawn" : "granted",
      conflicts,
      notes,
      retell_call_missing: retellMissing,
      written: [],
      json: recordEntry.json,
      md: recordEntry.md,
    };
  }

  record.voice_calls = ledger;
  if (record.state === "open") record.state = "captured";
  const recWrite = writePair(recordEntry.json, recordEntry.md, record, pack);
  if (recWrite?.error) return recWrite;

  if (!fromFile && !exportData) {
    try {
      await host.ackPulled(data.session_id, newCalls.map((call) => call.call_id));
    } catch {
      notes.push("ack_failed");
    }
  }

  return {
    state: record.state,
    changed: true,
    ack_retried: false,
    consent: data.status === "consent_withdrawn" ? "withdrawn" : data.status === "consent_refused" ? "refused" : "granted",
    conflicts,
    notes,
    retell_call_missing: retellMissing,
    written,
    json: recordEntry.json,
    md: recordEntry.md,
  };
}

export async function runVoice(args, deps = {}) {
  const campaignDir = args.campaignDir;
  const scope = args.scope;
  if (args.createLink) return createLink({ campaignDir, scope, args, host: deps.host || defaultHost });
  if (args.status) return statusSession({ campaignDir, scope, host: deps.host || defaultHost });
  if (args.pull) {
    return pullSession({
      campaignDir,
      scope,
      fromFile: args.fromFile,
      acceptWithdrawn: Boolean(args.acceptWithdrawn),
      acceptPackHash: Boolean(args.acceptPackHash),
      exportData: deps.exportData,
      host: deps.host || defaultHost,
      retellGetCall: deps.retellGetCall || getCall,
    });
  }
  return { error: "action_required" };
}

export async function main(argv = process.argv, deps = {}) {
  const args = parseArgs(argv, { actions: VOICE_ACTIONS });
  if (args.foreignFlag) fail("foreign_flag", { flag: args.foreignFlag });
  if (args.help) {
    console.log(
      "usage: interview-voice.mjs --campaign-dir <abs> --scope <slug> (--create-link | --status | --pull [--from-file <export.json>] [--accept-withdrawn] [--accept-pack-hash])",
    );
    return;
  }
  if (args.unknown) fail("unknown_flag", { flag: args.unknown });
  const campaignDir = resolveCampaignDir(args);
  requireCampaign(campaignDir);
  if (!args.scope) fail("scope_required");
  const result = await runVoice({ ...args, campaignDir }, deps);
  if (result?.error) fail(result.error, result.extra || {});
  console.log(JSON.stringify(result, null, 2));
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
