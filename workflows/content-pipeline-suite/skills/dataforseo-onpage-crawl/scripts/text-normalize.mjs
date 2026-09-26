/**
 * Normalize crawl text for CSV/Excel: fix UTF-8 mojibake and unify Unicode.
 */

/** UTF-8 bytes mis-read as Latin-1 (e.g. â + \u0080 + \u0093 instead of en-dash). */
const MOJIBAKE_UTF8_AS_LATIN1 =
  /(?:\u00E2\u0080[\u0080-\u00BF])|(?:\u00C2[\u0080-\u00BF])|(?:\u00C3[\u0080-\u00BF]{2})|â€[™œžŸ""–—]/;

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function normalizeText(value) {
  if (value == null || value === '') return value;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (Array.isArray(value)) return value.map((v) => normalizeText(v));
  if (typeof value !== 'string') return value;

  let out = value;
  if (MOJIBAKE_UTF8_AS_LATIN1.test(out)) {
    try {
      const fixed = Buffer.from(out, 'latin1').toString('utf8');
      if (fixed && !fixed.includes('\uFFFD')) out = fixed;
    } catch {
      /* keep original */
    }
  }

  return out.normalize('NFC');
}

/** @param {unknown} value */
export function normalizeField(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((v) => normalizeField(v));
  if (typeof value === 'string') return normalizeText(value);
  return value;
}
