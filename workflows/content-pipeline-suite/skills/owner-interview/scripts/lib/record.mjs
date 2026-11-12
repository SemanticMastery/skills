import fs from "node:fs";
import path from "node:path";
import { collectInterviewFiles, companySlug, interviewPair } from "./paths.mjs";
import { groundFact } from "./grounding.mjs";
import { defaultPublishFor } from "./publish-default.mjs";

export const RECORD_STATES = ["open", "captured", "compiled", "superseded"];
export const LEGAL_TRANSITIONS = {
  open: ["captured"],
  captured: [],
  compiled: ["superseded"],
  superseded: [],
};
export const WHO_MAY_ANSWER_QUESTION_ID = "q-company-who-may-answer-describe-1";
export const CHANNELS = ["call-notes", "form", "chat", "voice"];
export const PUBLISH_VALUES = ["public", "framing-only", "internal"];
/**
 * Who decided a fact's `publish` value. Absent means the owner's own Publish? answer, an
 * explicit value in `--add-answer`, or a record from before these keys existed.
 */
export const PUBLISH_SOURCES = ["spoken", "tap", "operator", "default"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

export function isRecord(data) {
  if (!data || typeof data !== "object") return false;
  return Boolean(data.state) || Array.isArray(data.answers);
}

export function isPack(data) {
  return Boolean(data && Array.isArray(data.questions));
}

/** Every active (not superseded) record in the campaign, whatever its scope. */
export function listActiveRecordEntries(campaignDir) {
  return readInterviewEntries(campaignDir, `${companySlug(campaignDir)}-owner-interview-`).filter(
    (entry) => isRecord(entry.data) && entry.data.state !== "superseded",
  );
}

export function listInterviewEntries(campaignDir, scope) {
  return readInterviewEntries(campaignDir, `${companySlug(campaignDir)}-owner-interview-${scope}-`);
}

function readInterviewEntries(campaignDir, prefix) {
  return collectInterviewFiles(
    campaignDir,
    "owner",
    (name) =>
      name.startsWith(prefix) &&
      name.endsWith(".json") &&
      !name.includes("-interview-transcript-"),
  )
    .map((file) => {
      let data = null;
      try {
        data = JSON.parse(fs.readFileSync(file.path, "utf8"));
      } catch {
        data = null;
      }
      return {
        name: file.name,
        json: file.path,
        md: file.path.replace(/\.json$/i, ".md"),
        data,
      };
    })
    .filter((entry) => entry.data);
}

export function findPackEntry(campaignDir, scope) {
  const entries = listInterviewEntries(campaignDir, scope);
  for (let i = entries.length - 1; i >= 0; i--) {
    if (isPack(entries[i].data)) return entries[i];
  }
  return null;
}

export function findRecordEntries(campaignDir, scope) {
  return listInterviewEntries(campaignDir, scope).filter((entry) => isRecord(entry.data));
}

export function findActiveRecordEntry(campaignDir, scope) {
  const entries = findRecordEntries(campaignDir, scope);
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].data.state !== "superseded") return entries[i];
  }
  return null;
}

export function loadCompanyWhoMayAnswer(campaignDir) {
  const entries = findRecordEntries(campaignDir, "company");
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].data.state === "superseded") continue;
    const list = entries[i].data.who_may_answer;
    return Array.isArray(list) ? list : [];
  }
  return [];
}

export function deriveAuthorized({ answered_by, role } = {}, whoMayAnswer = []) {
  const list = Array.isArray(whoMayAnswer) ? whoMayAnswer : [];
  if (String(role || "").trim().toLowerCase() === "owner") return true;
  if (!list.length) return false;
  const needle = String(answered_by || "")
    .trim()
    .toLowerCase();
  return list.some((name) => String(name).trim().toLowerCase() === needle);
}

function cloneReview(review) {
  if (!review || typeof review !== "object") return null;
  const out = { ...review };
  if (Array.isArray(review.tokens)) out.tokens = [...review.tokens];
  return out;
}

/**
 * Normalize a fact list. A fact with a valid `publish` keeps it, with its provenance keys
 * (`publish_source`, `publish_set_by`, `publish_set_on`) when valid. A fact with none is
 * decided by the default policy when `question` is a Describe question with no Publish?
 * link (`publish_source: "default"`), and is stored `internal` otherwise (R30).
 * `needs_publish_decision` is true when a fact arrived with no usable `publish`, or the
 * default held it `internal`. Key order stays text, publish, provenance, review so a
 * record without provenance re-saves byte for byte.
 */
export function normalizeFacts(facts, { question } = {}) {
  if (facts == null) return { facts: [], needs_publish_decision: false };
  if (!Array.isArray(facts)) return { error: "facts_invalid" };
  let needs = false;
  const out = facts.map((fact) => {
    const text = fact?.text == null ? "" : String(fact.text);
    const rawPublish = fact?.publish;
    const row = { text };
    if (rawPublish && PUBLISH_VALUES.includes(rawPublish)) {
      row.publish = rawPublish;
      if (PUBLISH_SOURCES.includes(fact.publish_source)) row.publish_source = fact.publish_source;
      const by = typeof fact.publish_set_by === "string" ? fact.publish_set_by.trim() : "";
      if (by) row.publish_set_by = by;
      if (typeof fact.publish_set_on === "string" && DATE_RE.test(fact.publish_set_on)) {
        row.publish_set_on = fact.publish_set_on;
      }
    } else {
      const fallback = defaultPublishFor(question, text);
      if (fallback) {
        row.publish = fallback;
        row.publish_source = "default";
        if (fallback === "internal") needs = true;
      } else {
        row.publish = "internal";
        needs = true;
      }
    }
    const review = cloneReview(fact?.review);
    if (review) row.review = review;
    return row;
  });
  return { facts: out, needs_publish_decision: needs };
}

export function recordCallLedger(record, callId) {
  const calls = Array.isArray(record?.voice_calls) ? record.voice_calls : [];
  return calls.find((row) => row.call_id === callId) || null;
}

function ensureCallLedger(record, callId) {
  if (!Array.isArray(record.voice_calls)) record.voice_calls = [];
  let row = record.voice_calls.find((item) => item.call_id === callId);
  if (!row) {
    row = { call_id: callId, pulled_at: null, question_ids: [], unanswered_ids: [] };
    record.voice_calls.push(row);
  }
  if (!Array.isArray(row.question_ids)) row.question_ids = [];
  if (!Array.isArray(row.unanswered_ids)) row.unanswered_ids = [];
  return row;
}

function callAlreadyHasQuestion(record, callId, questionId) {
  const ledger = recordCallLedger(record, callId);
  if (!ledger) return false;
  return (
    (ledger.question_ids || []).includes(questionId) ||
    (ledger.unanswered_ids || []).includes(questionId)
  );
}

function namesFromWhoMayAnswerFacts(facts, raw) {
  const list = facts || [];
  const names = [];
  for (const fact of list) {
    if (fact.review) continue;
    if (fact.text) {
      names.push(
        ...String(fact.text)
          .split(/[,;\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
  }
  if (!list.length && raw) {
    names.push(
      ...String(raw)
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  return names;
}

export function applyAnswer(record, answer, callId, { question } = {}) {
  if (!record || !answer?.question_id) return record;
  const questionId = answer.question_id;
  const normalized = normalizeFacts(answer.facts, { question });
  if (normalized.error) return { error: normalized.error };
  const existing = (record.answers || []).find((row) => row.question_id === questionId);
  const row = {
    ...(existing || emptyAnswerRow(questionId)),
    question_id: questionId,
    answered_by: answer.answered_by ?? existing?.answered_by ?? null,
    role: answer.role ?? existing?.role ?? null,
    date: answer.date || todayStamp(),
    channel: answer.channel ?? existing?.channel ?? null,
    raw: answer.raw == null ? "" : String(answer.raw),
    facts: normalized.facts,
    status: "answered",
    needs_publish_decision: normalized.needs_publish_decision,
    skip_count: existing?.skip_count || 0,
    transcript_ref: answer.transcript_ref ?? existing?.transcript_ref ?? null,
  };
  if (answer.verify != null) row.verify = answer.verify;
  // An answer-level review (owner words on a Publish? answer) describes this answer's words,
  // so a new answer replaces it instead of inheriting the old one.
  const answerReview = cloneReview(answer.review);
  if (answerReview) row.review = answerReview;
  else delete row.review;
  row.authorized = deriveAuthorized(row, record.who_may_answer || []);
  if (questionId === WHO_MAY_ANSWER_QUESTION_ID && record.scope === "company") {
    record.who_may_answer = namesFromWhoMayAnswerFacts(row.facts, row.raw);
  }
  record.answers = (record.answers || []).filter((item) => item.question_id !== questionId);
  record.answers.push(row);
  if (record.state === "open") record.state = "captured";
  if (callId) {
    const ledger = ensureCallLedger(record, callId);
    if (!ledger.question_ids.includes(questionId)) ledger.question_ids.push(questionId);
  }
  return record;
}

/**
 * Record a skipped question. `date` is the day of the call for a pulled voice call, so a new
 * row says when the owner was asked and not when the call was pulled; it defaults to today.
 */
export function applyUnanswered(record, questionId, callId, { date } = {}) {
  if (!record || !questionId) return record;
  if (callId && callAlreadyHasQuestion(record, callId, questionId)) return record;
  const existing = (record.answers || []).find((row) => row.question_id === questionId);
  const row = existing || emptyAnswerRow(questionId, date);
  row.question_id = questionId;
  row.skip_count = (row.skip_count || 0) + 1;
  row.status = row.skip_count >= 2 ? "declined" : "unanswered";
  if (!existing) {
    row.raw = "";
    row.facts = [];
  }
  record.answers = (record.answers || []).filter((item) => item.question_id !== questionId);
  record.answers.push(row);
  if (record.state === "open") record.state = "captured";
  if (callId) {
    const ledger = ensureCallLedger(record, callId);
    if (!ledger.question_ids.includes(questionId)) ledger.question_ids.push(questionId);
    if (!ledger.unanswered_ids.includes(questionId)) ledger.unanswered_ids.push(questionId);
  }
  return record;
}

function emptyAnswerRow(questionId, date) {
  return {
    question_id: questionId,
    answered_by: null,
    role: null,
    authorized: false,
    date: date || todayStamp(),
    channel: null,
    raw: "",
    facts: [],
    status: "unanswered",
    needs_publish_decision: false,
    skip_count: 0,
    transcript_ref: null,
  };
}

/** Where a fact's publish value came from. Empty for owner decisions and older records. */
function publishNote(fact) {
  if (fact.publish_source === "operator") {
    const by = fact.publish_set_by || "operator";
    return ` (publish set by ${by}${fact.publish_set_on ? ` on ${fact.publish_set_on}` : ""})`;
  }
  if (fact.publish_source === "default") return " (publish default)";
  return "";
}

export function renderRecordMarkdown(record, pack) {
  const scope = record?.scope || "record";
  const answers = Array.isArray(record?.answers) ? record.answers : [];
  const byId = new Map(answers.map((row) => [row.question_id, row]));
  const packQuestions = Array.isArray(pack?.questions) ? pack.questions : [];

  const unanswered = [];
  const seen = new Set();
  for (const row of answers) {
    if (row.status === "unanswered" || row.status === "declined") {
      unanswered.push(row);
      seen.add(row.question_id);
    }
  }
  for (const question of packQuestions) {
    if (seen.has(question.id)) continue;
    const row = byId.get(question.id);
    if (!row || row.status === "unanswered" || row.status === "declined") {
      unanswered.push(
        row || {
          question_id: question.id,
          status: "unanswered",
          skip_count: 0,
        },
      );
      seen.add(question.id);
    }
  }

  const answered = answers.filter((row) => row.status === "answered");

  const lines = [
    `# Owner interview record — ${scope}`,
    "",
    `- campaign: ${record?.campaign || ""}`,
    `- state: ${record?.state || ""}`,
    `- opened: ${record?.opened || ""}`,
    `- pack_file: ${record?.pack_file || ""}`,
    `- source_id: ${record?.source_id || ""}`,
  ];
  if (Array.isArray(record?.voice_calls) && record.voice_calls.length) {
    lines.push("- Voice calls:");
    for (const call of record.voice_calls) {
      const questions = (call.question_ids || []).join(", ");
      lines.push(`  - \`${call.call_id}\`${call.pulled_at ? ` ${call.pulled_at}` : ""}${questions ? ` ${questions}` : ""}`);
    }
  }
  lines.push("");
  lines.push("## Unanswered", "");

  if (!unanswered.length) {
    lines.push("_None._", "");
  } else {
    for (const row of unanswered) {
      const skips = row.skip_count == null ? 0 : row.skip_count;
      lines.push(`- \`${row.question_id}\` — ${row.status} (skip_count: ${skips})`);
    }
    lines.push("");
  }

  lines.push("## Answers", "");
  if (!answered.length) {
    lines.push("_None._", "");
  } else {
    for (const row of answered) {
      lines.push(`### \`${row.question_id}\``);
      lines.push("");
      lines.push(`- answered_by: ${row.answered_by || ""} (${row.role || ""})`);
      lines.push(`- authorized: ${row.authorized}`);
      lines.push(`- date: ${row.date || ""}`);
      lines.push(`- channel: ${row.channel || ""}`);
      lines.push(`- raw: ${row.raw || ""}`);
      lines.push("");
      if (Array.isArray(row.facts) && row.facts.length) {
        lines.push("Facts:");
        for (const fact of row.facts) {
          const tokens = Array.isArray(fact.review?.tokens)
            ? fact.review.tokens.join(", ")
            : fact.review?.reason;
          const marker = fact.review ? ` [REVIEW: ${tokens}]` : "";
          lines.push(`- [${fact.publish}] ${fact.text}${publishNote(fact)}${marker}`);
        }
        lines.push("");
      }
    }
  }

  lines.push("## Unmapped notes");
  lines.push("");
  const notes = record?.unmapped_notes;
  if (notes) lines.push(String(notes), "");
  const publishWords = answers.filter((row) => row.review?.reason === "owner_words_on_publish");
  for (const row of publishWords) {
    const tokens = Array.isArray(row.review.tokens) ? row.review.tokens.join(", ") : row.review.reason;
    lines.push(
      `- \`${row.question_id}\` (${row.date || ""}) [REVIEW: ${tokens}] Owner words on a Publish? answer: ${row.raw || ""}`,
    );
  }
  if (publishWords.length) lines.push("");
  return lines.join("\n");
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function atomicWrite(filePath, contents, io = {}) {
  const rename = io.rename || fs.renameSync;
  const unlink = io.unlink || fs.unlinkSync;
  const writeFile = io.writeFile || fs.writeFileSync;
  const tmpPath = `${filePath}.tmp`;
  writeFile(tmpPath, contents);
  const tryRename = (from, to) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        rename(from, to);
        return null;
      } catch (err) {
        if (err?.code !== "EBUSY" && err?.code !== "EPERM" && err?.code !== "EEXIST") {
          try {
            unlink(tmpPath);
          } catch {
            /* ignore */
          }
          throw err;
        }
        if (attempt < 2) sleepMs(25 * (attempt + 1));
      }
    }
    return { error: "write_locked", extra: { path: to } };
  };

  let renamed = tryRename(tmpPath, filePath);
  if (!renamed) return null;
  if (fs.existsSync(filePath)) {
    const bakPath = `${filePath}.bak`;
    const movedAside = tryRename(filePath, bakPath);
    if (movedAside) {
      try {
        unlink(tmpPath);
      } catch {
        /* ignore */
      }
      return movedAside;
    }
    const placed = tryRename(tmpPath, filePath);
    if (placed) {
      try {
        rename(bakPath, filePath);
      } catch {
        /* ignore */
      }
      try {
        unlink(tmpPath);
      } catch {
        /* ignore */
      }
      return placed;
    }
    try {
      unlink(bakPath);
    } catch {
      /* ignore */
    }
    return null;
  }
  try {
    unlink(tmpPath);
  } catch {
    /* ignore */
  }
  return renamed;
}

export function writePair(entryPath, mdPath, record, pack, io) {
  fs.mkdirSync(path.dirname(entryPath), { recursive: true });
  const jsonError = atomicWrite(entryPath, JSON.stringify(record, null, 2), io);
  if (jsonError) return jsonError;
  const mdError = atomicWrite(mdPath, renderRecordMarkdown(record, pack), io);
  if (mdError) return mdError;
  return null;
}

function resultPayload(jsonPath, mdPath, record) {
  return {
    json: jsonPath,
    md: mdPath,
    state: record.state,
    source_id: record.source_id,
    scope: record.scope,
  };
}

function packBasename(entry) {
  if (entry?.data?.pack_file) return entry.data.pack_file;
  return path.basename(entry.md);
}

function findQuestion(pack, questionId) {
  return (pack?.questions || []).find((question) => question.id === questionId) || null;
}

function parseAnswerInput(raw) {
  if (raw == null || raw === "") return { error: "answer_required" };
  const text = String(raw);
  try {
    if (text.trim().startsWith("{")) return { answer: JSON.parse(text) };
    if (fs.existsSync(text)) {
      return { answer: JSON.parse(fs.readFileSync(text, "utf8")) };
    }
  } catch (err) {
    return { error: "answer_invalid", extra: { message: String(err?.message || err) } };
  }
  return { error: "answer_invalid" };
}

export function createRecord({ campaignDir, scope } = {}) {
  if (!scope) return { error: "scope_required" };
  const packEntry = findPackEntry(campaignDir, scope);
  if (!packEntry) return { error: "pack_not_found" };

  const pack = packEntry.data;
  const pair = interviewPair(campaignDir, scope);
  for (const entry of findRecordEntries(campaignDir, scope)) {
    if (entry.data.state === "superseded") continue;
    entry.data.state = "superseded";
    let destJson = entry.json;
    let destMd = entry.md;
    if (path.resolve(entry.json) === path.resolve(pair.json)) {
      const moved = interviewPair(campaignDir, scope, `${entry.data.opened || todayStamp()}-superseded`);
      destJson = moved.json;
      destMd = moved.md;
    }
    const supersededWrite = writePair(destJson, destMd, entry.data, isPack(entry.data) ? entry.data : pack);
    if (supersededWrite?.error) return supersededWrite;
    if (destJson !== entry.json && fs.existsSync(entry.json)) {
      fs.unlinkSync(entry.json);
      if (fs.existsSync(entry.md)) fs.unlinkSync(entry.md);
    }
  }

  const record = {
    campaign: pack.campaign || companySlug(campaignDir),
    scope,
    pack_file: packBasename(packEntry),
    opened: todayStamp(),
    state: "open",
    source_id: null,
    who_may_answer: [],
    answers: [],
    questions: pack.questions,
  };

  const createdWrite = writePair(pair.json, pair.md, record, pack);
  if (createdWrite?.error) return createdWrite;
  return resultPayload(pair.json, pair.md, record);
}

function loadWritable(campaignDir, scope) {
  const packEntry = findPackEntry(campaignDir, scope);
  if (!packEntry) return { error: "pack_not_found" };
  const entry = findActiveRecordEntry(campaignDir, scope);
  if (!entry) return { error: "record_not_found" };
  if (entry.data.state === "compiled" || entry.data.state === "superseded") {
    return { error: "record_not_writable", extra: { state: entry.data.state } };
  }
  return { packEntry, entry, pack: packEntry.data, record: entry.data };
}

export function addAnswer({ campaignDir, scope, answerInput } = {}) {
  if (!scope) return { error: "scope_required" };
  const parsed = parseAnswerInput(answerInput);
  if (parsed.error) return parsed;
  const incoming = parsed.answer;
  if (!incoming || typeof incoming !== "object") return { error: "answer_invalid" };

  const loaded = loadWritable(campaignDir, scope);
  if (loaded.error) return loaded;
  const { pack, record, entry } = loaded;

  const questionId = incoming.question_id;
  if (!questionId) return { error: "question_id_required" };
  const question = findQuestion(pack, questionId);
  if (!question) return { error: "question_not_found", extra: { question_id: questionId } };

  if (incoming.channel && !CHANNELS.includes(incoming.channel)) {
    return { error: "invalid_channel", extra: { channel: incoming.channel } };
  }

  const normalized = normalizeFacts(incoming.facts, { question });
  if (normalized.error) return normalized;

  const whoMayAnswer = loadCompanyWhoMayAnswer(campaignDir);
  const existing = (record.answers || []).find((row) => row.question_id === questionId);
  const row = {
    ...(existing || emptyAnswerRow(questionId)),
    question_id: questionId,
    answered_by: incoming.answered_by ?? existing?.answered_by ?? null,
    role: incoming.role ?? existing?.role ?? null,
    date: incoming.date || todayStamp(),
    channel: incoming.channel ?? existing?.channel ?? null,
    raw: incoming.raw == null ? "" : String(incoming.raw),
    facts: normalized.facts,
    status: "answered",
    needs_publish_decision: normalized.needs_publish_decision,
    skip_count: existing?.skip_count || 0,
    transcript_ref: incoming.transcript_ref ?? existing?.transcript_ref ?? null,
  };
  delete row.review;
  row.authorized = deriveAuthorized(row, whoMayAnswer);
  if (questionId === WHO_MAY_ANSWER_QUESTION_ID && record.scope === "company") {
    record.who_may_answer = namesFromWhoMayAnswerFacts(row.facts, row.raw);
  }

  record.answers = (record.answers || []).filter((item) => item.question_id !== questionId);
  record.answers.push(row);
  if (record.state === "open") record.state = "captured";

  const answerWrite = writePair(entry.json, entry.md, record, pack);
  if (answerWrite?.error) return answerWrite;
  return { ...resultPayload(entry.json, entry.md, record), answer: row };
}

export function markUnanswered({ campaignDir, scope, questionId } = {}) {
  if (!scope) return { error: "scope_required" };
  if (!questionId) return { error: "question_id_required" };
  const loaded = loadWritable(campaignDir, scope);
  if (loaded.error) return loaded;
  const { pack, record, entry } = loaded;
  if (!findQuestion(pack, questionId)) {
    return { error: "question_not_found", extra: { question_id: questionId } };
  }

  const existing = (record.answers || []).find((row) => row.question_id === questionId);
  const row = existing || emptyAnswerRow(questionId);
  row.question_id = questionId;
  row.skip_count = (row.skip_count || 0) + 1;
  row.status = row.skip_count >= 2 ? "declined" : "unanswered";
  if (!existing) {
    row.raw = "";
    row.facts = [];
  }

  record.answers = (record.answers || []).filter((item) => item.question_id !== questionId);
  record.answers.push(row);
  if (record.state === "open") record.state = "captured";

  const unansweredWrite = writePair(entry.json, entry.md, record, pack);
  if (unansweredWrite?.error) return unansweredWrite;
  return { ...resultPayload(entry.json, entry.md, record), answer: row };
}

export function setState({ campaignDir, scope, state } = {}) {
  if (!scope) return { error: "scope_required" };
  if (!state) return { error: "state_required" };
  if (!RECORD_STATES.includes(state)) {
    return { error: "illegal_state_transition", extra: { to: state } };
  }
  const packEntry = findPackEntry(campaignDir, scope);
  if (!packEntry) return { error: "pack_not_found" };
  const entry = findActiveRecordEntry(campaignDir, scope);
  if (!entry) return { error: "record_not_found" };
  const from = entry.data.state;
  const allowed = LEGAL_TRANSITIONS[from] || [];
  if (!allowed.includes(state)) {
    return { error: "illegal_state_transition", extra: { from, to: state } };
  }
  entry.data.state = state;
  const stateWrite = writePair(entry.json, entry.md, entry.data, packEntry.data);
  if (stateWrite?.error) return stateWrite;
  return resultPayload(entry.json, entry.md, entry.data);
}

export function listFlagged(record) {
  const out = [];
  for (const answer of record?.answers || []) {
    if (answer?.review) {
      // Answer-level flag: owner words on a Publish? answer. There is no fact to point at.
      out.push({
        question_id: answer.question_id,
        fact_index: null,
        text: answer.raw,
        publish: null,
        review: answer.review,
      });
    }
    (answer.facts || []).forEach((fact, factIndex) => {
      if (!fact?.review) return;
      out.push({
        question_id: answer.question_id,
        fact_index: factIndex,
        text: fact.text,
        publish: fact.publish,
        review: fact.review,
      });
    });
  }
  return out;
}

function ownerWordsForGrounding(answer, question) {
  const raw = String(answer?.raw || "");
  const verify = String(answer?.verify || answer?.raw || "").trim().toLowerCase();
  if (question?.type === "verify" && /^(true|yes|correct)\b/.test(verify) && question.claim?.text) {
    return `${raw} ${question.claim.text}`.trim();
  }
  return raw;
}

export function reviewFact({
  campaignDir,
  scope,
  questionId,
  factIndex,
  clear = false,
  edit,
  drop = false,
} = {}) {
  if (!scope) return { error: "scope_required" };
  if (!questionId) return { error: "question_id_required" };
  const loaded = loadWritable(campaignDir, scope);
  if (loaded.error) return loaded;
  const { pack, record, entry } = loaded;
  const answer = (record.answers || []).find((row) => row.question_id === questionId);
  const noFact = factIndex === undefined || factIndex === null || factIndex === "";
  if (noFact && answer?.review && clear && edit === undefined && !drop) {
    // `--review --question-id <id> --clear` with no --fact clears the answer-level flag.
    delete answer.review;
    const cleared = writePair(entry.json, entry.md, record, pack);
    if (cleared?.error) return cleared;
    return { ...resultPayload(entry.json, entry.md, record), flagged: listFlagged(record) };
  }
  const idx = Number(factIndex);
  if (!answer || !Array.isArray(answer.facts) || !answer.facts[idx]) {
    return { error: "fact_not_found", extra: { question_id: questionId, fact: factIndex } };
  }
  if (drop) {
    answer.facts.splice(idx, 1);
  } else if (edit !== undefined) {
    const question = findQuestion(pack, questionId);
    const grounded = groundFact(String(edit), ownerWordsForGrounding(answer, question));
    if (grounded && !clear) {
      return { error: "still_ungrounded", extra: grounded };
    }
    answer.facts[idx].text = String(edit);
    if (grounded && clear) delete answer.facts[idx].review;
    else if (!grounded) delete answer.facts[idx].review;
  } else if (clear) {
    delete answer.facts[idx].review;
  } else {
    return { error: "review_action_required" };
  }
  const written = writePair(entry.json, entry.md, record, pack);
  if (written?.error) return written;
  return { ...resultPayload(entry.json, entry.md, record), flagged: listFlagged(record) };
}

/**
 * Operator override of one fact's publish value (or every fact in an answer). Stores who
 * set it and when, so the record and the compile plan show the decision was not the owner's.
 * `needs_publish_decision` clears once no untouched fact is still held `internal`.
 */
export function setPublish({
  campaignDir,
  scope,
  questionId,
  factIndex,
  all = false,
  value,
  by,
  today,
} = {}) {
  if (!scope) return { error: "scope_required" };
  if (!questionId) return { error: "question_id_required" };
  if (value == null || value === "") return { error: "value_required" };
  if (!PUBLISH_VALUES.includes(value)) return { error: "publish_value_invalid", extra: { value } };
  const setBy = String(by ?? "").trim();
  if (!setBy) return { error: "by_required" };
  const hasFact = factIndex !== undefined && factIndex !== null && factIndex !== "";
  if (!hasFact && !all) return { error: "fact_or_all_required" };
  if (hasFact && all) return { error: "fact_and_all_conflict" };

  const loaded = loadWritable(campaignDir, scope);
  if (loaded.error) return loaded;
  const { pack, record, entry } = loaded;
  const answer = (record.answers || []).find((row) => row.question_id === questionId);
  if (!answer || !Array.isArray(answer.facts)) {
    return { error: "answer_not_found", extra: { question_id: questionId } };
  }

  let targets;
  if (all) {
    if (!answer.facts.length) {
      return { error: "fact_not_found", extra: { question_id: questionId, fact: "all" } };
    }
    targets = answer.facts.map((_, index) => index);
  } else {
    const index = Number(factIndex);
    if (!Number.isInteger(index) || !answer.facts[index]) {
      return { error: "fact_not_found", extra: { question_id: questionId, fact: factIndex } };
    }
    targets = [index];
  }

  const on = today || todayStamp();
  const touched = new Set(targets);
  for (const index of targets) {
    const [next] = normalizeFacts([
      {
        ...answer.facts[index],
        publish: value,
        publish_source: "operator",
        publish_set_by: setBy,
        publish_set_on: on,
      },
    ]).facts;
    answer.facts[index] = next;
  }
  if (answer.needs_publish_decision) {
    answer.needs_publish_decision = answer.facts.some(
      (fact, index) => !touched.has(index) && fact.publish === "internal" && fact.publish_source !== "operator",
    );
  }

  const written = writePair(entry.json, entry.md, record, pack);
  if (written?.error) return written;
  return {
    ...resultPayload(entry.json, entry.md, record),
    publish_set: targets.map((index) => ({
      question_id: questionId,
      fact_index: index,
      publish: answer.facts[index].publish,
      publish_source: answer.facts[index].publish_source,
      publish_set_by: answer.facts[index].publish_set_by,
      publish_set_on: answer.facts[index].publish_set_on,
    })),
    needs_publish_decision: Boolean(answer.needs_publish_decision),
  };
}

export function listFlaggedForScope({ campaignDir, scope } = {}) {
  if (!scope) return { error: "scope_required" };
  const entry = findActiveRecordEntry(campaignDir, scope);
  if (!entry) return { error: "record_not_found" };
  return { flagged: listFlagged(entry.data) };
}

export function setSourceId({ campaignDir, scope, sourceId } = {}) {
  if (!scope) return { error: "scope_required" };
  if (!sourceId) return { error: "source_id_required" };
  const packEntry = findPackEntry(campaignDir, scope);
  if (!packEntry) return { error: "pack_not_found" };
  const entry = findActiveRecordEntry(campaignDir, scope);
  if (!entry) return { error: "record_not_found" };
  const from = entry.data.state;
  if (from !== "captured") {
    return { error: "illegal_state_transition", extra: { from, to: "compiled" } };
  }
  entry.data.source_id = sourceId;
  entry.data.state = "compiled";
  const sourceWrite = writePair(entry.json, entry.md, entry.data, packEntry.data);
  if (sourceWrite?.error) return sourceWrite;
  return resultPayload(entry.json, entry.md, entry.data);
}
