/** Shared entity notation parsing for audit paste formatters. */

export function wikiUrl(articleTitle) {
  const segment = articleTitle.trim().replace(/ /g, '_');
  return `https://en.wikipedia.org/wiki/${segment}`;
}

export function extractEntityLabels(line) {
  const labels = [];
  const re =
    /([A-Za-z0-9][A-Za-z0-9\s(),\-']*?)\s*\((?:C\s*&\s*T|T|ST|D|R)\)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const name = m[1].trim();
    if (!name) continue;
    labels.push({ name, start: m.index, end: m.index + m[0].length });
  }
  return labels;
}
