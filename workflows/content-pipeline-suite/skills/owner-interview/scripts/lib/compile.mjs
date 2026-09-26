import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WHO_MAY_ANSWER_ID } from "./pack.mjs";
import { canonicalPdPath } from "./paths.mjs";
import { findOffering, joinKey, parseProductDoc } from "./pd.mjs";
import { findActiveRecordEntry, findPackEntry } from "./record.mjs";

const SEED_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "references",
  "industry-seeds",
  "tree-care.md",
);

const CITATION_RE = /\[PD-SRC-[0-9A-Z]+\]/gi;
const CURRENCY_RE = /[$€£¥₹]/;
const PLACEHOLDER_SRC = "PD-SRC-00N";
const INTERNAL_BODY = "Internal — not for publication";

const COMPANY_SECTIONS = {
  Description: "Company Offering Summary",
  "Company Offering Summary": "Company Offering Summary",
  "Delivery Process": "Cross-Offering Capabilities",
  "Cross-Offering Capabilities": "Cross-Offering Capabilities",
  "Geography and Eligibility": "Service Geography and Eligibility",
  "Service Geography and Eligibility": "Service Geography and Eligibility",
  "Credentials and Proof": "Credentials, Standards, and Risk Controls",
  "Conflicts and Verification Needs": "Conflicts and Verification Needs",
  "Open Questions": "Open Questions",
  "Evidence Notes": "Proof and Documented Claims",
};

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

export function sourceIdFor(record) {
  return record?.source_id || PLACEHOLDER_SRC;
}

export function citationToken(sourceId) {
  return `[${sourceId || PLACEHOLDER_SRC}]`;
}

export function internalMarker(sourceId) {
  return `${INTERNAL_BODY} ${citationToken(sourceId)}`;
}

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

export function answerId(answer, factIndex) {
  if (answer?.id) return String(answer.id);
  const qid = answer?.question_id || "answer";
  if (factIndex == null) return qid;
  return `${qid}:${factIndex}`;
}

function findQuestion(pack, questionId) {
  return (pack?.questions || []).find((question) => question.id === questionId) || null;
}

function packOrder(pack) {
  const map = new Map();
  (pack?.questions || []).forEach((question, i) => map.set(question.id, i));
  return map;
}

export function verifyOutcome(answer, question) {
  if (question?.type !== "verify") return null;
  const explicit = String(answer?.verify || "").trim().toLowerCase();
  const raw = explicit || String(answer?.raw || "").trim().toLowerCase();
  if (/^(true|yes|correct)\b/.test(raw)) return "true";
  if (/^(partly|partial)/.test(raw)) return "partly";
  if (/^(false|no|not how)\b/.test(raw)) return "false";
  return null;
}

export function isRegistryFact(text) {
  const raw = String(text || "");
  if (/(?:\blicen[cs]e\b|\bregistry\b).{0,60}\d/i.test(raw)) return true;
  if (/\b[A-Z]{2,}[- ]?\d{4,}\b/.test(raw)) return true;
  return false;
}

export function existingFieldText(parsed, scope, pdField) {
  if (!parsed || !pdField) return "";
  if (scope === "company") {
    const section = COMPANY_SECTIONS[pdField] || pdField;
    if (section === "Conflicts and Verification Needs") {
      return (parsed.conflicts || []).join("\n");
    }
    if (section === "Open Questions") {
      return (parsed.openQuestions || []).join("\n");
    }
    return parsed.sections?.[section] || "";
  }
  const profile = (parsed.profiles || []).find((row) => joinKey(row.offering) === joinKey(scope));
  if (!profile) return "";
  if (profile.fields?.[pdField]) return profile.fields[pdField];
  const aliased = Object.entries(COMPANY_SECTIONS).find(([, section]) => section === pdField);
  if (aliased && profile.fields?.[aliased[0]]) return profile.fields[aliased[0]];
  return "";
}

function distinctiveTokens(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !/^(this|that|with|from|your|which|should|true|partly|false|claim)$/.test(word));
}

export function matchingConflicts(parsed, question, answer) {
  const blob = [
    question?.prompt,
    question?.claim?.text,
    answer?.raw,
    ...((answer?.facts || []).map((fact) => fact.text)),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const blobTokens = new Set(distinctiveTokens(blob));
  return (parsed?.conflicts || []).filter((conflict) => {
    const c = String(conflict).toLowerCase();
    if (/tenure|founding|serving since|established/.test(c) && /tenure|founding|serving since|established|start date/.test(blob)) {
      return true;
    }
    if (/arborist|credential|\bisa\b/.test(c) && /arborist|credential|\bisa\b/.test(blob)) {
      return true;
    }
    if (/license|insurance/.test(c) && /license|insurance/.test(blob)) {
      return true;
    }
    const conflictTokens = distinctiveTokens(conflict);
    const overlap = conflictTokens.filter((token) => blobTokens.has(token));
    return overlap.length >= 3;
  });
}

function withCitation(text, sourceId) {
  const token = citationToken(sourceId);
  const trimmed = String(text || "").trim();
  if (!trimmed) return token;
  CITATION_RE.lastIndex = 0;
  if (CITATION_RE.test(trimmed)) {
    CITATION_RE.lastIndex = 0;
    return trimmed;
  }
  return `${trimmed} ${token}`;
}

function resolvePublish(answer, fact) {
  if (answer?.authorized === false) return "internal";
  return fact?.publish || "internal";
}

function laterByField(answers, pack) {
  const winners = new Map();
  for (const answer of answers || []) {
    if (answer.status !== "answered") continue;
    const question = findQuestion(pack, answer.question_id);
    if (!question?.pd_field) continue;
    if (question.type === "publish") continue;
    if (question.id === WHO_MAY_ANSWER_ID) continue;
    const key = question.pd_field;
    const prev = winners.get(key);
    if (!prev || String(answer.date || "") >= String(prev.date || "")) {
      winners.set(key, answer);
    }
  }
  return winners;
}

function revisedFields(answers, pack) {
  const grouped = new Map();
  for (const answer of answers || []) {
    if (answer.status !== "answered") continue;
    const question = findQuestion(pack, answer.question_id);
    if (!question?.pd_field || question.type === "publish") continue;
    if (question.id === WHO_MAY_ANSWER_ID) continue;
    const list = grouped.get(question.pd_field) || [];
    list.push(answer);
    grouped.set(question.pd_field, list);
  }
  const notes = [];
  for (const [field, list] of grouped) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    const last = sorted[sorted.length - 1];
    notes.push({ field, date: last.date, answer: last });
  }
  return notes;
}

function pushItem(groups, answerKey, item) {
  if (!groups.has(answerKey)) groups.set(answerKey, []);
  groups.get(answerKey).push(item);
}

export function buildHunks({ record, pack, parsed, scope }) {
  const src = sourceIdFor(record);
  const answers = Array.isArray(record?.answers) ? record.answers : [];
  const winners = laterByField(answers, pack);
  const groups = new Map();
  const lintFailures = [];

  for (const answer of answers) {
    const question = findQuestion(pack, answer.question_id) || {
      id: answer.question_id,
      pd_field: answer.pd_field,
      type: answer.type,
    };
    const id = answerId(answer);
    if (question.id === WHO_MAY_ANSWER_ID) continue;
    if (question.type === "publish" && !(answer.facts || []).length) continue;

    if (answer.status === "unanswered" || answer.status === "declined") {
      const date = answer.date || record.opened;
      pushItem(groups, id, {
        target: "Open Questions",
        action: "append",
        pd_field: question.pd_field || "",
        text: `${question.pd_field || "field"}: asked on ${date}`,
        field_text_unchanged: true,
      });
      continue;
    }

    if (answer.status !== "answered") continue;

    const outcome = verifyOutcome(answer, question);
    const existing = existingFieldText(parsed, scope, question.pd_field);
    const registry = isRegistryFact(existing);
    const conflicts = matchingConflicts(parsed, question, answer);

    if (outcome === "false") {
      const claim = question.claim?.text || answer.raw || "claim";
      pushItem(groups, id, {
        target: "Evidence Notes",
        action: "append",
        pd_field: question.pd_field || "Evidence Notes",
        text: `Live-page sequence “${claim}” refuted by owner interview ${citationToken(src)}`,
      });
      continue;
    }

    if (conflicts.length && !registry) {
      for (const conflict of conflicts) {
        pushItem(groups, id, {
          target: "Conflicts and Verification Needs",
          action: "remove",
          pd_field: "Conflicts and Verification Needs",
          text: conflict,
        });
      }
    }

    const winner = winners.get(question.pd_field);
    const isWinner = !winner || winner.question_id === answer.question_id;

    if (outcome === "true" && isWinner) {
      const fact = (answer.facts || []).find((row) => row.text);
      if (fact?.review) {
        lintFailures.push({ error: "review_pending", hunk: id });
        continue;
      }
      const publish = resolvePublish(answer, fact || { publish: "internal" });
      if (publish === "framing-only" && fact) {
        const lint = lintFraming(fact.text, id);
        if (lint) lintFailures.push(lint);
      }
      const text =
        !fact || publish === "internal"
          ? internalMarker(src)
          : withCitation(fact.text, src);
      pushItem(groups, id, {
        target: "field",
        action: "replace",
        pd_field: question.pd_field,
        publish: fact ? publish : "internal",
        text,
      });
      continue;
    }

    const facts = Array.isArray(answer.facts) ? answer.facts : [];
    if (!facts.length && answer.authorized === false && isWinner) {
      const text = internalMarker(src);
      const lint = lintFraming(text, id);
      if (lint) lintFailures.push(lint);
      pushItem(groups, id, {
        target: "field",
        action: "replace",
        pd_field: question.pd_field,
        publish: "internal",
        text,
      });
      continue;
    }

    for (let i = 0; i < facts.length; i++) {
      const fact = facts[i];
      if (fact?.review) {
        lintFailures.push({ error: "review_pending", hunk: answerId(answer, i) });
        continue;
      }
      const publish = resolvePublish(answer, fact);
      if (!isWinner) continue;

      let text;
      let extra = {};
      if (publish === "internal") {
        text = internalMarker(src);
      } else if (publish === "framing-only") {
        text = withCitation(fact.text, src);
      } else {
        text = withCitation(fact.text, src);
        if (registry) {
          extra.retain_conflict = true;
          extra.existing = existing.trim();
          text = `${text}\n${existing.trim()}`.trim();
        }
      }

      if (publish === "framing-only") {
        const lint = lintFraming(fact.text, id);
        if (lint) lintFailures.push(lint);
      }

      pushItem(groups, id, {
        target: "field",
        action: registry && publish === "public" ? "keep-both" : "replace",
        pd_field: question.pd_field,
        publish,
        text,
        ...extra,
      });
    }
  }

  for (const note of revisedFields(answers, pack)) {
    const id = answerId(note.answer);
    pushItem(groups, id, {
      target: "Evidence Notes",
      action: "append",
      pd_field: note.field,
      text: `revised ${note.date}`,
    });
  }

  if (lintFailures.length) return { error: lintFailures[0].error, hunk: lintFailures[0].hunk };

  const order = packOrder(pack);
  const keys = [...groups.keys()].sort((a, b) => {
    const qa = String(a).split(":")[0];
    const qb = String(b).split(":")[0];
    const ia = order.has(qa) ? order.get(qa) : 1000;
    const ib = order.has(qb) ? order.get(qb) : 1000;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b);
  });

  return {
    hunks: keys.map((id) => ({ id, items: groups.get(id) })),
    sourceId: src,
  };
}

export function renderCompilePlan({ record, hunks, sourceId, mdBasename }) {
  const src = sourceId || sourceIdFor(record);
  const file = mdBasename || record?.pack_file || "owner-interview.md";
  const lines = [
    "# Owner-interview refresh plan",
    "",
    `- record: \`${file}\``,
    `- scope: ${record?.scope || ""}`,
    `- source_id: ${src}`,
    "",
    "## Source Ledger",
    "",
    "Re-compile replaces this row. File is the idempotency key. Do not append a second Owner interview row for the same File.",
    "",
    "| Source ID | File | Type | Section | Upstream URL | Date | Authority | Limitations |",
    "|---|---|---|---|---|---|---|---|",
    `| ${src} | ${file} | Owner interview | ${record?.scope || ""} | — | ${record?.opened || ""} | Owner interview | Confirm before overwrite |`,
    "",
    "## Hunks",
    "",
  ];

  for (const group of hunks || []) {
    lines.push(`### Hunk \`${group.id}\``);
    lines.push("");
    for (const item of group.items || []) {
      lines.push(`- target: ${item.target}`);
      if (item.pd_field) lines.push(`- pd_field: ${item.pd_field}`);
      if (item.action) lines.push(`- action: ${item.action}`);
      if (item.publish) lines.push(`- publish: ${item.publish}`);
      if (item.retain_conflict) lines.push("- retain_conflict: true");
      if (item.field_text_unchanged) lines.push("- field_text_unchanged: true");
      if (item.existing) lines.push(`- existing: ${item.existing}`);
      lines.push(`- text: ${item.text}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function compilePlan({ campaignDir, scope, partial = false } = {}) {
  if (!campaignDir) return { error: "campaign_dir_required" };
  if (!scope) return { error: "scope_required" };

  const pdPath = canonicalPdPath(campaignDir);
  if (!fs.existsSync(pdPath)) return { error: "product_doc_missing" };

  const packEntry = findPackEntry(campaignDir, scope);
  if (!packEntry) return { error: "pack_not_found" };

  const recordEntry = findActiveRecordEntry(campaignDir, scope);
  if (!recordEntry) return { error: "record_not_found" };

  const record = recordEntry.data;
  if (record.state === "open" && !partial) {
    return { error: "record_open" };
  }

  const markdown = fs.readFileSync(pdPath, "utf8");
  const parsed = parseProductDoc(markdown);
  if (scope !== "company") {
    const offering = findOffering(parsed.catalog, scope);
    if (!offering) return { error: "offering_not_found", extra: { scope } };
  }

  const built = buildHunks({
    record,
    pack: packEntry.data,
    parsed,
    scope,
  });
  if (built.error) return { error: built.error, extra: { hunk: built.hunk } };

  const mdBasename = path.basename(recordEntry.md);
  const rendered = renderCompilePlan({
    record,
    hunks: built.hunks,
    sourceId: built.sourceId,
    mdBasename,
  });

  const outDir = path.join(campaignDir, "04-archives", "planning", "owner-interview");
  const outName = `${path.basename(recordEntry.md, ".md")}-compile-plan.md`;
  const outPath = path.join(outDir, outName);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, rendered);

  return {
    path: outPath,
    scope,
    state: record.state,
    source_id: built.sourceId,
  };
}
