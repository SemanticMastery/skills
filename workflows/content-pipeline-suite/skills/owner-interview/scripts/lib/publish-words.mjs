/**
 * Owner words on a Publish? answer beyond the decision itself.
 *
 * A Publish? row carries no facts (schemas.md), so anything else the owner says there, such
 * as a correction or a guarantee, never reaches a fact or the Product-Documentation. The pull
 * flags those answers so an operator reads them.
 *
 * A bare decision is short: "Public.", "Yes, you can make that public.", "Let's keep that one
 * internal for now." After the decision words and conversational filler are removed, fewer
 * than OWNER_WORDS_MIN distinct words remain. A correction or guarantee leaves many more.
 */

export const OWNER_WORDS_MIN = 3;

const DECISION_AND_FILLER = new Set([
  // the decision itself
  "public", "publicly", "publicize", "publicise", "publish", "published",
  "internal", "internally", "private", "privately", "framing", "only",
  "general", "generally", "vague", "vaguely",
  // agreement and politeness
  "yes", "yeah", "yep", "yup", "sure", "okay", "ok", "no", "nope", "fine", "good", "great",
  "right", "please", "thanks", "thank", "well", "um", "uh", "hmm",
  // function words and phrasing around a decision
  "you", "your", "can", "could", "may", "might", "would", "will", "should", "that", "that's",
  "thats", "this", "it", "it's", "its", "is", "was", "be", "as", "a", "an", "the", "to", "i",
  "i'd", "i'll", "i'm", "i've", "we", "go", "ahead", "keep", "make", "mark", "leave", "put",
  "let", "let's", "for", "now", "just", "so", "and", "or", "but", "one", "then", "guess",
  "think", "not", "don't", "dont", "do", "want", "like", "say", "of", "in", "on", "at", "if",
  "all", "any", "some", "there", "here", "with", "out",
]);

/**
 * The distinct words (at most 12) that make a Publish? answer more than a bare decision, or
 * null when it is a bare decision.
 */
export function ownerWordsBeyondDecision(raw) {
  const tokens = String(raw ?? "")
    .toLowerCase()
    .replace(/’/g, "'")
    .match(/[a-z0-9]+(?:'[a-z]+)?/g);
  const content = [];
  for (const token of tokens || []) {
    if (DECISION_AND_FILLER.has(token) || content.includes(token)) continue;
    content.push(token);
  }
  return content.length >= OWNER_WORDS_MIN ? content.slice(0, 12) : null;
}
