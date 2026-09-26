/**
 * CAMPAIGN-OWNED classifier prompt.
 *
 * Copy this file to:
 *   {campaign}/06-content-pipeline/01-resources/image-library/classify.mjs
 * Then edit KEEP / OFF_TOPIC for THIS business and set CLASSIFIER_READY = true.
 *
 * The shared skill will not classify without this file. Two campaigns must not
 * share one prompt.
 */
export const CLASSIFIER_READY = false;

export const KEEP = "(edit) stills that can illustrate this business's blog years later";

export const OFF_TOPIC =
  "sports, parties, wrecked cars as the subject, unrelated people, or anything outside this campaign's tag enum";

export function buildClassifyPrompt({ allowlist, caption }) {
  return [
    "Tag this photo only if it is an evergreen, page-owned still that could illustrate this business's blog years later.",
    `KEEP: ${KEEP}.`,
    `Set off_topic=true for ${OFF_TOPIC}.`,
    "Set ephemeral_promo=true for fundraising graphics, donate/Venmo overlays, dated event flyers, or other time-limited campaign text.",
    "Use only the provided tag enum. Do not invent tags. Do not guess county from the photo.",
    `Business topics (tag enum): ${JSON.stringify(allowlist)}.`,
    `Caption: ${JSON.stringify(caption || "")}`,
  ].join(" ");
}
