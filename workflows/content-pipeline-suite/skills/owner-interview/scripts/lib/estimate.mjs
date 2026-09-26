/** Calibrated from live Ridgeline voice calls. Old pad was 45s/question (~30% high). */
export const SECONDS_PER_QUESTION = 30;

export function estimateMinutes(questionCount) {
  const n = Number(questionCount) || 0;
  if (n <= 0) return 0;
  return Math.max(1, Math.round((n * SECONDS_PER_QUESTION) / 60));
}
