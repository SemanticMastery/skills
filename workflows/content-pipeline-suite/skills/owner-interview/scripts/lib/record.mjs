import fs from "node:fs";
import path from "node:path";
import { collectInterviewFiles, companySlug, interviewPair } from "./paths.mjs";
import { groundFact } from "./grounding.mjs";

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

export function listInterviewEntries(campaignDir, scope) {
  const prefix = `${companySlug(campaignDir)}-owner-interview-${scope}-`;
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

export function normalizeFacts(facts) {
  if (facts == null) return { facts: [], needs_publish_decision: false };
  if (!Array.isArray(facts)) return { error: "facts_invalid" };
  let needs = false;
  const out = facts.map((fact) => {
    const text = fact?.text == null ? "" : String(fact.text);
    const rawPublish = fact?.publish;
    const publish =
      rawPublish && PUBLISH_VALUES.includes(rawPublish) ? rawPublish : "internal";
    if (!rawPublish || !PUBLISH_VALUES.includes(rawPublish)) needs = true;
    const row = { text, publish };
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

export function applyAnswer(record, answer, callId) {
  if (!record || !answer?.question_id) return record;
  const questionId = answer.question_id;
  const normalized = normalizeFacts(answer.facts);
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

export function applyUnanswered(record, questionId, callId) {
  if (!record || !questionId) return record;
  if (callId && callAlreadyHasQuestion(record, callId, questionId)) return record;
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
  if (callId) {
    const ledger = ensureCallLedger(record, callId);
    if (!ledger.question_ids.includes(questionId)) ledger.question_ids.push(questionId);
    if (!ledger.unanswered_ids.includes(questionId)) ledger.unanswered_ids.push(questionId);
  }
  return record;
}

function emptyAnswerRow(questionId) {
  return {
    question_id: questionId,
    answered_by: null,
    role: null,
    authorized: false,
    date: todayStamp(),
    channel: null,
    raw: "",
    facts: [],
    status: "unanswered",
    needs_publish_decision: false,
    skip_count: 0,
    transcript_ref: null,
  };
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
          lines.push(`- [${fact.publish}] ${fact.text}${marker}`);
        }
        lines.push("");
      }
    }
  }

  lines.push("## Unmapped notes");
  lines.push("");
  const notes = record?.unmapped_notes;
  if (notes) lines.push(String(notes), "");
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

  const normalized = normalizeFacts(incoming.facts);
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
