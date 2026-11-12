import fs from "node:fs";
import path from "node:path";
import { WHO_MAY_ANSWER_ID } from "./pack.mjs";
import { canonicalPdPath } from "./paths.mjs";
import { findOffering, joinKey, parseProductDoc } from "./pd.mjs";
import { findActiveRecordEntry, findPackEntry, listActiveRecordEntries } from "./record.mjs";
import { resolveCatalogOffering } from "./sources.mjs";
import { CITATION_RE, lintFraming, loadBrandTokens, stripCitations } from "./framing.mjs";

export { lintFraming, loadBrandTokens, stripCitations };

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

export function sourceIdFor(record) {
  return record?.source_id || PLACEHOLDER_SRC;
}

export function citationToken(sourceId) {
  return `[${sourceId || PLACEHOLDER_SRC}]`;
}

export function internalMarker(sourceId) {
  return `${INTERNAL_BODY} ${citationToken(sourceId)}`;
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

/** A process is claimed by a sequence ("A → B", "then", "step 2"), not by a name. */
const SEQUENCE_MARK_RE = /→|->|=>|›|»|\bthen\b|\bstep\s*\d|\b\d+[- ]step\b/i;

/**
 * A verify whose claim is a live-page title or heading: a short name such as "Stump Grinding
 * Service" taken from the crawl. Confirming a title says nothing about how the service is
 * delivered, so it never writes field text. A sequence, a sentence, or a long line is a real
 * claim and is not a title.
 */
export function isPageTitleClaim(question) {
  if (question?.type !== "verify") return false;
  const claim = question.claim;
  if (!claim) return false;
  const source = String(claim.source || "").trim().toLowerCase();
  if (source !== "live page" && source !== "crawl") return false;
  const text = String(claim.text || "").trim();
  if (!text || SEQUENCE_MARK_RE.test(text) || /[.!?](\s|$)/.test(text)) return false;
  return text.split(/\s+/).length <= 10;
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

const LINK_STOP_WORDS = new Set(["the", "and", "for", "with", "from", "that", "this", "are", "was", "not", "our", "your"]);

function normalizeLink(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The texts that tie a question to a PD conflict: its claim and an optional `conflict` seed. */
function conflictLinks(question) {
  const seeded = Array.isArray(question?.conflict) ? question.conflict : [question?.conflict];
  return [question?.claim?.text, ...seeded].map(normalizeLink).filter(Boolean);
}

/** A link names a conflict when the conflict contains it, or contains every one of its words. */
function linksToConflict(link, conflict) {
  const body = normalizeLink(conflict);
  if (` ${body} `.includes(` ${link} `)) return true;
  const words = link.split(" ").filter((word) => word.length >= 3 && !LINK_STOP_WORDS.has(word));
  if (words.length < 2) return false;
  const present = new Set(body.split(" "));
  return words.every((word) => present.has(word));
}

/**
 * The Conflicts and Verification Needs items this question resolves. Only a real link counts:
 * the question's `claim.text`, or a `conflict` reference naming the item. Words in the prompt
 * or in the owner's answer never link, so an answer that merely mentions "license" or
 * "arborist" does not remove an unrelated conflict. The `answer` argument is kept for callers.
 */
export function matchingConflicts(parsed, question, _answer) {
  const links = conflictLinks(question);
  if (!links.length) return [];
  return (parsed?.conflicts || []).filter((conflict) =>
    links.some((link) => linksToConflict(link, conflict)),
  );
}

/** The claim a verify question tests, without case or punctuation, so two packs agree on it. */
function claimKey(question) {
  return normalizeLink(question?.claim?.text);
}

/**
 * What each other active record in the campaign decided about each claim it verified:
 * `[{ scope, claims: Map(claimKey -> true | partly | false) }]`. A superseded record is
 * not active, and the record being compiled is left out.
 */
export function otherRecordClaims(campaignDir, currentEntry) {
  const out = [];
  for (const entry of listActiveRecordEntries(campaignDir)) {
    if (path.resolve(entry.json) === path.resolve(currentEntry.json)) continue;
    const scope = entry.data.scope;
    const questions = entry.data.questions?.length
      ? entry.data.questions
      : findPackEntry(campaignDir, scope)?.data?.questions || [];
    const byId = new Map(questions.map((question) => [question.id, question]));
    const claims = new Map();
    for (const answer of entry.data.answers || []) {
      if (answer.status !== "answered") continue;
      const question = byId.get(answer.question_id);
      const outcome = verifyOutcome(answer, question);
      const key = claimKey(question);
      if (outcome && key) claims.set(key, outcome);
    }
    if (claims.size) out.push({ scope, claims });
  }
  return out;
}

/** Other records that verified this claim with a different outcome. */
function claimClashes(others, question, outcome) {
  const key = claimKey(question);
  if (!key || !outcome) return [];
  const clashes = [];
  for (const other of others || []) {
    const theirs = other.claims.get(key);
    if (theirs && theirs !== outcome) clashes.push({ scope: other.scope, outcome: theirs });
  }
  return clashes;
}

/**
 * The same text from either side of a disagreement (participants sorted by scope), apart from
 * the citation, which is each record's own source id. Applying both plans therefore writes
 * the same Conflict item twice, not two different ones.
 */
function clashText(claim, scope, outcome, clashes, sourceId) {
  const who = [{ scope: scope || "this record", outcome }, ...clashes]
    .sort((a, b) => String(a.scope).localeCompare(String(b.scope)))
    .map((row) => `${row.scope} verified it ${row.outcome}`)
    .join("; ");
  return `**${claim} — Conflict — operator review required.** Owner interviews disagree: ${who}. ${citationToken(sourceId)}`;
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

/**
 * Where a fact's publish value came from (`default` or `operator`), for the plan. An answer
 * from someone not authorized is forced `internal` above, so no source is claimed for it.
 */
function publishSourceOf(answer, fact) {
  if (answer?.authorized === false) return {};
  return fact?.publish_source ? { publish_source: fact.publish_source } : {};
}

/**
 * The answer that counts for each question. A record keeps one row per question, so this
 * only matters when a record holds the same question twice (for example a hand-merged delta):
 * the later date wins, and on a tie the last row wins. Answers to different questions for the
 * same PD field never replace each other; each one emits its own facts and the plan's field
 * items add up.
 */
function latestPerQuestion(answers, pack) {
  const winners = new Map();
  for (const answer of answers || []) {
    if (answer.status !== "answered") continue;
    const question = findQuestion(pack, answer.question_id);
    if (!question?.pd_field) continue;
    if (question.type === "publish") continue;
    if (question.id === WHO_MAY_ANSWER_ID) continue;
    const prev = winners.get(question.id);
    if (!prev || String(answer.date || "") >= String(prev.date || "")) {
      winners.set(question.id, answer);
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
    // Several questions answered on one call are not a revision; a later day is.
    const days = new Set(list.map((answer) => String(answer.date || "")));
    if (list.length < 2 || days.size < 2) continue;
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

export function buildHunks({ record, pack, parsed, scope, others = [] }) {
  const src = sourceIdFor(record);
  const answers = Array.isArray(record?.answers) ? record.answers : [];
  const winners = latestPerQuestion(answers, pack);
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
    if (answer.review) {
      // Owner words on a Publish? answer still need an operator (`--review --clear`).
      lintFailures.push({ error: "review_pending", hunk: id });
      continue;
    }
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

    // Another active record verified this claim differently: nothing from this answer is
    // published or cleared until an operator settles it.
    const clashes = claimClashes(others, question, outcome);
    if (clashes.length) {
      pushItem(groups, id, {
        target: "Conflicts and Verification Needs",
        action: "append",
        pd_field: "Conflicts and Verification Needs",
        text: clashText(question.claim.text, record?.scope, outcome, clashes, src),
      });
      continue;
    }

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

    if (isPageTitleClaim(question)) {
      // A title says nothing about delivery, so it writes no field text and removes no
      // conflict. A flagged fact still blocks compile, like any other.
      (answer.facts || []).forEach((fact, i) => {
        if (fact?.review) lintFailures.push({ error: "review_pending", hunk: answerId(answer, i) });
      });
      if (outcome === "partly") {
        pushItem(groups, id, {
          target: "Evidence Notes",
          action: "append",
          pd_field: question.pd_field || "Evidence Notes",
          text: `Live-page title “${question.claim.text}” partly confirmed by owner interview ${citationToken(src)}`,
        });
      }
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

    const winner = winners.get(question.id);
    const isWinner = !winner || winner === answer;

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
        ...publishSourceOf(answer, fact),
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
        ...publishSourceOf(answer, fact),
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
      if (item.publish_source) lines.push(`- publish_source: ${item.publish_source}`);
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
  // Pack and record files are named by the scope slug. The PD names the offering, and the
  // pipeline manifest maps one to the other (emergency-service -> Emergency storm response).
  // The slug is the fallback when no manifest page names it.
  const catalogScope =
    scope === "company" ? scope : resolveCatalogOffering(campaignDir, scope) || scope;
  if (scope !== "company") {
    const offering = findOffering(parsed.catalog, catalogScope);
    if (!offering) return { error: "offering_not_found", extra: { scope } };
  }

  const built = buildHunks({
    record,
    pack: packEntry.data,
    parsed,
    scope: catalogScope,
    others: otherRecordClaims(campaignDir, recordEntry),
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
