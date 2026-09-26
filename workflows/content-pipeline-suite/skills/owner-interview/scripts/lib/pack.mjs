import { createHash } from "node:crypto";
import fs from "node:fs";
import { collectInterviewFiles, companySlug } from "./paths.mjs";
import { gridRowForField } from "./pd.mjs";

export const WHO_MAY_ANSWER_ID = "q-company-who-may-answer-describe-1";
export const DEFAULT_FOLLOWUP = "If it depends, what does it depend on?";
export const OFFERING_CAP = 15;
export const COMPANY_CAP = 12;

const PUBLISH_TRIGGER_RE =
  /\b(price|pricing|fee|hourly|per-tree|per-job|brand|product name|credential|tenure|vendor|crew size|rig)\b/i;

const ORDER_RANK = {
  "How it is delivered": 0,
  "Techniques or tools": 0,
  "What the service is": 1,
  "What the customer can expect": 2,
  Timeline: 3,
  "Average cost or pricing": 4,
  FAQs: 5,
};

export function fieldSlug(field) {
  return String(field || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function claimHash(text) {
  return createHash("sha256").update(String(text ?? ""), "utf8").digest("hex").slice(0, 6);
}

/** Stored claim.source stays `dossier`. Owners hear this instead. */
export function spokenSource(source) {
  const raw = String(source || "").trim();
  if (/^dossier$/i.test(raw) || /business\s+dossier/i.test(raw)) return "company documentation";
  return raw;
}

export function spokenPrompt(prompt) {
  return String(prompt || "")
    .replace(/\bDossier materials say\b/g, "Company documentation says")
    .replace(/\bdossier materials say\b/g, "company documentation says")
    .replace(/\b[Dd]ossier materials\b/g, "company documentation")
    .replace(/\bthe dossier\b/gi, "the company documentation")
    .replace(/\ba dossier\b/gi, "company documentation")
    .replace(/\bdossier\b/gi, "company documentation");
}

export function normalizeType(type) {
  const t = String(type || "")
    .toLowerCase()
    .replace(/\?$/, "")
    .trim();
  if (t === "verify") return "verify";
  if (t === "publish") return "publish";
  return "describe";
}

export function isWhoMayAnswer(question) {
  if (!question) return false;
  if (question.id === WHO_MAY_ANSWER_ID) return true;
  return (
    question.pd_field === "Open Questions" &&
    /who (besides|may answer)/i.test(question.prompt || "")
  );
}

export function standingWhoMayAnswer() {
  return {
    id: WHO_MAY_ANSWER_ID,
    type: "describe",
    pd_field: "Open Questions",
    grid_row: "FAQs",
    prompt: "Who besides the owner may answer these questions?",
    answer_shape: "free text",
    followup: DEFAULT_FOLLOWUP,
  };
}

function defaultAnswerShape(type) {
  if (type === "verify") return "true / partly / false";
  if (type === "publish") return "choice";
  return "free text";
}

export function normalizeQuestion(question, map) {
  const type = normalizeType(question.type);
  return {
    ...question,
    type,
    pd_field: question.pd_field,
    grid_row: question.grid_row || gridRowForField(question.pd_field, map),
    prompt: spokenPrompt(question.prompt || ""),
    answer_shape: question.answer_shape || defaultAnswerShape(type),
    followup: question.followup || undefined,
    claim: question.claim,
    publish_link: question.publish_link,
  };
}

export function assignIds(questions, scope) {
  const counters = new Map();
  return questions.map((question) => {
    if (isWhoMayAnswer(question)) {
      return { ...question, id: WHO_MAY_ANSWER_ID };
    }
    const slug = fieldSlug(question.pd_field);
    const type = normalizeType(question.type);
    const key = `${scope}:${slug}:${type}`;
    const n = (counters.get(key) || 0) + 1;
    counters.set(key, n);
    let id = `q-${scope}-${slug}-${type}-${n}`;
    if (type === "verify" && question.claim?.text) {
      id += `-${claimHash(question.claim.text)}`;
    }
    return { ...question, id };
  });
}

export function isPublishTrigger(question) {
  if (!question || normalizeType(question.type) === "publish") return false;
  const blob = `${question.prompt || ""} ${question.pd_field || ""}`;
  return PUBLISH_TRIGGER_RE.test(blob);
}

export function matchesGap(question, gaps) {
  if (isWhoMayAnswer(question)) return true;
  return (gaps || []).some((gap) => {
    if (gap.pd_field && gap.pd_field === question.pd_field) return true;
    if (
      question.type === "verify" &&
      question.claim?.text &&
      gap.text &&
      String(gap.text).includes(question.claim.text)
    ) {
      return true;
    }
    return false;
  });
}

function orderRank(question) {
  if (normalizeType(question.type) === "verify") return 50;
  return ORDER_RANK[question.grid_row] ?? 5;
}

export function orderQuestions(questions) {
  return questions
    .map((question, index) => ({ question, index }))
    .sort((a, b) => {
      const rank = orderRank(a.question) - orderRank(b.question);
      if (rank !== 0) return rank;
      return a.index - b.index;
    })
    .map((row) => row.question);
}

export function packHash(pack) {
  const ids = (pack?.questions || []).map((question) => question.id).join("\n");
  return createHash("sha256").update(ids, "utf8").digest("hex");
}

export function publishBeforeParent(questions) {
  const indexById = new Map((questions || []).map((question, index) => [question.id, index]));
  for (const question of questions || []) {
    if (!question.publish_link) continue;
    const parentIdx = indexById.get(question.id);
    const publishIdx = indexById.get(question.publish_link);
    if (parentIdx == null || publishIdx == null) continue;
    if (publishIdx < parentIdx) {
      return { publish_id: question.publish_link, parent_id: question.id };
    }
  }
  return null;
}

export function seatPublishAfterParents(questions) {
  const list = questions || [];
  const byId = new Map(list.map((question) => [question.id, question]));
  const linkedPublishIds = new Set(
    list.filter((question) => question.publish_link).map((question) => question.publish_link),
  );
  const seated = new Set();
  const out = [];
  for (const question of list) {
    if (seated.has(question.id)) continue;
    if (linkedPublishIds.has(question.id) && list.some((row) => row.publish_link === question.id)) {
      continue;
    }
    out.push(question);
    seated.add(question.id);
    if (question.publish_link) {
      const pub = byId.get(question.publish_link);
      if (pub && !seated.has(pub.id)) {
        out.push(pub);
        seated.add(pub.id);
      }
    }
  }
  return out;
}

export function dedupeCompanyFields(questions) {
  const seen = new Set();
  const out = [];
  const standing = [];
  for (const question of questions) {
    if (isWhoMayAnswer(question)) {
      standing.push(question);
      continue;
    }
    if (seen.has(question.pd_field)) continue;
    seen.add(question.pd_field);
    out.push(question);
  }
  if (standing[0]) out.push(standing[0]);
  return out;
}

export function addFollowups(questions) {
  return questions.map((question) => {
    if (question.followup) return question;
    return { ...question, followup: DEFAULT_FOLLOWUP };
  });
}

export function findPriorRecord(campaignDir, scope) {
  const prefix = `${companySlug(campaignDir)}-owner-interview-${scope}-`;
  const files = collectInterviewFiles(
    campaignDir,
    "owner",
    (name) => name.startsWith(prefix) && name.endsWith(".json"),
  );
  for (let i = files.length - 1; i >= 0; i--) {
    try {
      const data = JSON.parse(fs.readFileSync(files[i].path, "utf8"));
      if (Array.isArray(data.answers)) return data;
    } catch {
      /* skip unreadable */
    }
  }
  return null;
}

function priorAnswerFor(question, answers) {
  const byId = answers.find((row) => row.question_id === question.id);
  if (byId) return byId;
  const slug = fieldSlug(question.pd_field);
  const type = normalizeType(question.type);
  const needle = `-${slug}-${type}-`;
  const hits = answers.filter((row) => String(row.question_id || "").includes(needle));
  return hits.length === 1 ? hits[0] : null;
}

function isNewOmission(question, gaps, answers) {
  const briefHit = (gaps || []).some(
    (gap) =>
      gap.source === "brief" &&
      gap.pd_field === question.pd_field &&
      gap.text &&
      question.prompt &&
      (String(gap.text).includes(question.prompt.slice(0, 24)) ||
        question.prompt.includes(String(gap.text).slice(0, 24))),
  );
  if (!briefHit) return false;
  return !answers.some((row) => row.question_id === question.id);
}

export function applyDelta(questions, gaps, priorRecord) {
  const answers = priorRecord?.answers || [];
  const openPd = new Set(
    (gaps || []).filter((gap) => gap.source === "pd").map((gap) => gap.pd_field),
  );
  const kept = [];
  for (const question of questions) {
    const prior = priorAnswerFor(question, answers);
    if (prior?.status === "declined") continue;
    const pdOpen = openPd.has(question.pd_field) || isWhoMayAnswer(question);
    if (!pdOpen && !isNewOmission(question, gaps, answers)) continue;
    const next = { ...question };
    if (prior && prior.skip_count != null) next.skip_count = prior.skip_count;
    kept.push(next);
  }
  return kept;
}

export function buildPack({
  draft,
  gaps,
  campaignDir,
  scope,
  delta = false,
  map,
} = {}) {
  const questionsIn = Array.isArray(draft?.questions) ? draft.questions : [];
  let questions = questionsIn.map((question) => normalizeQuestion(question, map));

  if (scope === "company" && !questions.some(isWhoMayAnswer)) {
    questions.push(standingWhoMayAnswer());
  }

  questions = assignIds(questions, scope);

  if (delta) {
    const prior = findPriorRecord(campaignDir, scope);
    questions = applyDelta(questions, gaps, prior);
  }

  const unmatched = questions.filter((question) => !matchesGap(question, gaps));
  if (unmatched.length) {
    return {
      error: "no_matching_gap",
      extra: {
        questions: unmatched.map((question) => ({
          id: question.id,
          pd_field: question.pd_field,
          prompt: question.prompt,
        })),
      },
    };
  }

  const missingPublish = questions.filter(
    (question) => isPublishTrigger(question) && !question.publish_link,
  );
  if (missingPublish.length) {
    const first = missingPublish[0];
    return {
      error: "publish_link_required",
      extra: {
        question: { id: first.id, pd_field: first.pd_field, prompt: first.prompt },
      },
    };
  }

  if (scope === "company") {
    questions = dedupeCompanyFields(questions);
  }

  questions = seatPublishAfterParents(orderQuestions(questions));
  const cap = scope === "company" ? COMPANY_CAP : OFFERING_CAP;
  if (questions.length > cap) {
    const toDrop = questions.slice(cap);
    return {
      error: "pack_over_cap",
      extra: {
        cap,
        count: questions.length,
        to_drop: toDrop.map((question) => ({
          id: question.id,
          type: question.type,
          pd_field: question.pd_field,
          prompt: question.prompt,
          claim: question.claim || undefined,
        })),
      },
    };
  }

  questions = addFollowups(questions);

  return {
    pack: {
      campaign: draft?.campaign || companySlug(campaignDir),
      scope,
      opened: new Date().toISOString().slice(0, 10),
      questions,
    },
  };
}
