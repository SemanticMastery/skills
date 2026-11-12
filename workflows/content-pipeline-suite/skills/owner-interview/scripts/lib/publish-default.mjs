/**
 * Default publish decision for Describe facts that have no Publish? question.
 *
 * A Describe question that could yield a price, brand, product name, credential, tenure
 * date, vendor, or crew size carries a `publish_link` (R9) and takes the owner's answer.
 * Every other Describe question has nobody to ask, so its facts default here:
 *
 *   `public`    only when the fact is plain description
 *   `internal`  otherwise, until an operator decides with `interview-record.mjs --set-publish`
 *
 * "Plain description" is deliberately narrow, because the owner never approved these
 * facts for publication. A fact is held `internal` when it has any of:
 *   - a digit, currency symbol, %, or a framing-lint token (`lintFraming`)
 *   - a spelled-out number ("a crew of three", "within twelve hours")
 *   - credential, insurance, or guarantee wording ("certified", "insured", "warranty")
 *   - a capitalized word that is not the first word of its sentence (a name, place,
 *     brand, or acronym)
 *
 * Known gaps: a name that is the first word of a sentence is not detected, and the
 * word lists are English only. The operator review of `[internal]` facts is the backstop.
 * Keep the whole policy in this file so it can be tuned or reverted in one place.
 */
import { lintFraming } from "./framing.mjs";
import { WHO_MAY_ANSWER_ID } from "./pack.mjs";

export const CLAIM_WORDS_RE =
  /\b(?:certif(?:y|ies|ied|ication|ications)|licen[cs](?:e|es|ed|ing|ure|ures)|insur(?:ed|ance|er|ers)|bonded|accredit(?:ed|ation|ations)|credential(?:s|ed)?|guarantee(?:s|d)?|warrant(?:y|ies)|award(?:s|ed)?)\b/i;

export const NUMBER_WORDS_RE =
  /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundreds?|thousands?|million|dozens?)\b/i;

/** "I", "I'm", "I'd," and the like are capitalized without being names. */
const FIRST_PERSON_RE = /^I(?:['’](?:m|ll|ve|d))?[,.;:!?)"”’]*$/;

function hasProperNoun(text) {
  for (const sentence of String(text).split(/(?<=[.!?])\s+/)) {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    if (words.length && /^[A-Z]{2,}\b/.test(words[0])) return true;
    for (let i = 1; i < words.length; i++) {
      const word = words[i].replace(/^[("'“‘\[]+/, "");
      if (!/^[A-Z]/.test(word) || FIRST_PERSON_RE.test(word)) continue;
      return true;
    }
  }
  return false;
}

/** Why a fact is held `internal` by default, or null when it is plain description. */
function holdReason(text) {
  const body = String(text ?? "").trim();
  if (!body) return "empty";
  if (lintFraming(body, "default")) return "lint";
  if (NUMBER_WORDS_RE.test(body)) return "number";
  if (CLAIM_WORDS_RE.test(body)) return "claim";
  if (hasProperNoun(body)) return "name";
  return null;
}

/** True when facts on this question fall under the default policy. */
export function appliesDefaultPublish(question) {
  if (!question || question.type !== "describe") return false;
  if (question.publish_link) return false;
  if (question.id === WHO_MAY_ANSWER_ID) return false;
  return true;
}

/** `public`, `internal`, or null when the default policy does not apply to the question. */
export function defaultPublishFor(question, text) {
  if (!appliesDefaultPublish(question)) return null;
  return holdReason(text) ? "internal" : "public";
}
