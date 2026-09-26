/**
 * Refuse OnPage deliverables that look complete by row count but have ~empty content.
 * Greater Life 2026-07-13: 390 URLs written with 100% empty title/words after bot-block fallback.
 */

/** Default: refuse when ≥95% of rows lack both title and words (i.e. usable content < 5%). */
export const DEFAULT_MIN_CONTENT_RATIO = 0.05;

/**
 * @param {Array<{ meta_title?: unknown, word_count?: unknown, url?: unknown }>} rows
 */
export function assessLeanRowContent(rows) {
  const n = rows?.length ?? 0;
  let withTitle = 0;
  let withWords = 0;
  let withEither = 0;
  let withNeither = 0;

  for (const r of rows ?? []) {
    const title = String(r?.meta_title ?? '').trim();
    const wordsRaw = r?.word_count;
    const words =
      typeof wordsRaw === 'number'
        ? wordsRaw
        : wordsRaw == null || wordsRaw === ''
          ? 0
          : Number(wordsRaw);
    const hasTitle = title.length > 0;
    const hasWords = Number.isFinite(words) && words > 0;
    if (hasTitle) withTitle += 1;
    if (hasWords) withWords += 1;
    if (hasTitle || hasWords) withEither += 1;
    else withNeither += 1;
  }

  return {
    n,
    with_title: withTitle,
    with_words: withWords,
    with_either: withEither,
    with_neither: withNeither,
    empty_title_pct: n ? withTitle === 0 ? 100 : Math.round((1000 * (n - withTitle)) / n) / 10 : 0,
    empty_words_pct: n ? withWords === 0 ? 100 : Math.round((1000 * (n - withWords)) / n) / 10 : 0,
    empty_both_pct: n ? Math.round((1000 * withNeither) / n) / 10 : 0,
    content_ratio: n ? withEither / n : 0,
  };
}

/**
 * Throws if pages_returned > 0 but nearly all rows lack title and word_count.
 * @param {Array<object>} rows
 * @param {{ minContentRatio?: number, allowEmptyContent?: boolean, context?: string }} [opts]
 * @returns {ReturnType<typeof assessLeanRowContent>}
 */
export function assertDeliverableContent(rows, opts = {}) {
  const minContentRatio = opts.minContentRatio ?? DEFAULT_MIN_CONTENT_RATIO;
  const stats = assessLeanRowContent(rows);

  if (opts.allowEmptyContent) {
    return stats;
  }

  if (stats.n > 0 && stats.content_ratio < minContentRatio) {
    const pctEmpty = Math.round((1 - stats.content_ratio) * 1000) / 10;
    const ctx = opts.context ? ` ${opts.context}` : '';
    throw new Error(
      `EMPTY_CONTENT: ${stats.n} page(s) returned but ~${pctEmpty}% lack title and word_count ` +
        `(with_title=${stats.with_title}, with_words=${stats.with_words}, content_ratio=${stats.content_ratio.toFixed(3)}, ` +
        `min=${minContentRatio}). Not writing deliverables.${ctx} ` +
        `Likely bot-block / empty HTML shell — retry --user-agent browser or fix WAF before treating crawl as complete.`
    );
  }

  return stats;
}
