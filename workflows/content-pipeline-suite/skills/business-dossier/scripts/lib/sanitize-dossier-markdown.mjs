/**
 * Post-process Grok dossier markdown before write.
 * - Drop process chatter before [I] and closer questions after [VII]
 * - Turn stacked **Label:** lines into markdown lists so preview/DOCX do not run on
 * - Blank line after each [I]–[VII] header
 */

const SECTION_I = /\[I\]\s*EXECUTIVE SUMMARY/i;
const SECTION_VII = /\[VII\]\s*BUSINESS DESCRIPTION/i;
const CLOSER_RE =
  /\n{2,}(?:Would you like|Let me know|If you want|I can also|Shall I|Do you want)\b/i;
const LABELED_LINE_RE = /^\s*(?:[-*]\s+)?(\*\*[^*\n]+:\*\*.*)$/;
const SECTION_HEADER_RE = /^\[(?:I{1,3}|IV|V{1,3})\][^\n]*$/;

export function stripDossierChatter(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
  const start = normalized.search(SECTION_I);
  let body = start === -1 ? normalized.trimStart() : normalized.slice(start);

  const vii = body.search(SECTION_VII);
  if (vii !== -1) {
    const after = body.slice(vii);
    const closer = after.search(CLOSER_RE);
    if (closer !== -1) {
      body = `${body.slice(0, vii + closer).trimEnd()}\n`;
    }
  }

  return body.trimStart();
}

export function formatLabeledFieldsAsLists(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      if (/^\s*\|/.test(line)) return line;
      const m = line.match(LABELED_LINE_RE);
      return m ? `- ${m[1]}` : line;
    })
    .join('\n');
}

export function ensureBlankLineAfterSectionHeaders(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/^(\[(?:VII|VI|IV|III|II|I|V)\][^\n]*)\n(?!\n|$)/gm, '$1\n\n');
}

export function sanitizeDossierMarkdown(text) {
  let next = stripDossierChatter(text);
  next = formatLabeledFieldsAsLists(next);
  next = ensureBlankLineAfterSectionHeaders(next);
  if (!next.endsWith('\n')) next += '\n';
  return next;
}

export { SECTION_HEADER_RE };
