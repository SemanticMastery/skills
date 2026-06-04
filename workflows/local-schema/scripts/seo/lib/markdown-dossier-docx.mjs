/**
 * DOCX writer for Glen Patel business dossiers — matches Box Tree Care Dossier.docx layout.
 * Aptos font, GBP header block, TSCR intro, bold section headers, label:value lines, 3-col table.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';

const FONT = 'Aptos';
const BODY_SIZE = '24';
const DEFAULT_AFTER = '160';
const DEFAULT_LINE = '279';

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rsid() {
  return randomBytes(2).toString('hex').toUpperCase();
}

function runText(text, { bold = false, italic = false, underline = false, color = null } = {}) {
  let rPr = `<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:eastAsia="${FONT}" w:cs="${FONT}"/><w:sz w:val="${BODY_SIZE}"/><w:szCs w:val="${BODY_SIZE}"/>`;
  if (bold) rPr += '<w:b/><w:bCs/>';
  if (italic) rPr += '<w:i/><w:iCs/>';
  if (underline) rPr += '<w:u w:val="single"/>';
  if (color) rPr += `<w:color w:val="${color}"/>`;
  const preserve = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : '';
  return `<w:r><w:rPr>${rPr}</w:rPr><w:t${preserve}>${escapeXml(text)}</w:t></w:r>`;
}

function paragraphFromRuns(runs, spacing = {}) {
  const id = rsid();
  const before = spacing.before ?? null;
  const after = spacing.after ?? DEFAULT_AFTER;
  let pPr = `<w:pPr><w:spacing w:after="${after}" w:line="${DEFAULT_LINE}" w:lineRule="auto"`;
  if (before != null) pPr += ` w:before="${before}"`;
  pPr += '/></w:pPr>';
  return `<w:p w:rsidR="${id}" w:rsidRDefault="${id}">${pPr}${runs.join('')}</w:p>`;
}

function paragraphPlain(text) {
  if (!text) return paragraphFromRuns([runText('', {})]);
  return paragraphFromRuns([runText(text)]);
}

function paragraphBold(text) {
  return paragraphFromRuns([runText(text, { bold: true })]);
}

function paragraphBoldItalic(text) {
  return paragraphFromRuns([runText(text, { bold: true, italic: true })]);
}

function paragraphLabelValue(label, value) {
  const labelText = label.endsWith(':') ? label : `${label}:`;
  return paragraphFromRuns([
    runText(labelText, { bold: true }),
    runText(value ? (value.startsWith(' ') ? value : ` ${value}`) : ' '),
  ]);
}

function paragraphSectionHeader(text) {
  const cleaned = text.replace(/:\s*$/, '').trim();
  return paragraphBold(cleaned);
}

function cellParagraph(text, bold = false) {
  const id = rsid();
  const run = bold ? runText(text, { bold: true, color: '1F1F1F' }) : runText(text);
  return `<w:p w:rsidR="${id}" w:rsidRDefault="${id}"><w:pPr><w:spacing w:before="0" w:beforeAutospacing="0" w:after="0" w:afterAutospacing="0"/></w:pPr>${run}</w:p>`;
}

function tableCell(text, bold = false, width) {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="6"/><w:left w:val="single" w:sz="6"/><w:bottom w:val="single" w:sz="6"/><w:right w:val="single" w:sz="6"/></w:tcBorders><w:tcMar><w:top w:w="240" w:type="dxa"/><w:bottom w:w="240" w:type="dxa"/><w:right w:w="180" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/></w:tcPr>${cellParagraph(text, bold)}</w:tc>`;
}

function buildTable(headers, rows) {
  const widths = [1861, 2955, 3001];
  const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('');
  const headerRow = `<w:tr>${headers
    .map((h, i) => tableCell(h, true, widths[i] || widths[0]))
    .join('')}</w:tr>`;
  const bodyRows = rows
    .map(
      (row) =>
        `<w:tr>${row.map((cell, i) => tableCell(cell || '', false, widths[i] || widths[0])).join('')}</w:tr>`
    )
    .join('');
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableNormal"/><w:tblW w:w="0" w:type="auto"/><w:tblLook w:val="06A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${headerRow}${bodyRows}</w:tbl>`;
}

function stripNoise(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !/Would you like me to/i.test(line))
    .filter((line) => !/Click to open side panel/i.test(line))
    .filter((line) => !/ShareDirections Opens in a new window/i.test(line))
    .join('\n')
    .trim();
}

function parseMarkdownTable(lines, startIndex) {
  const rows = [];
  let i = startIndex;
  while (i < lines.length && lines[i].trim().startsWith('|')) {
    const cells = lines[i]
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());
    if (!cells.every((c) => /^[-:\s]+$/.test(c))) rows.push(cells);
    i++;
  }
  return { rows, nextIndex: i };
}

function parseLabelValue(line) {
  const md = line.match(/^\s*[-*]?\s*\*\*(.+?)\*\*:\s*(.*)$/);
  if (md) return { label: md[1], value: md[2] };
  const plain = line.match(/^\s*[-*]?\s*(.+?):\s+(.*)$/);
  if (plain && !plain[1].startsWith('http')) return { label: plain[1], value: plain[2] };
  return null;
}

function parseDossierMarkdown(markdown) {
  const lines = stripNoise(markdown).split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    const sectionMatch = trimmed.match(/^\[([IVX]+)\]\s+(.+)$/);
    if (sectionMatch) {
      blocks.push({ type: 'section', text: `[${sectionMatch[1]}] ${sectionMatch[2].replace(/:\s*$/, '')}` });
      i++;
      continue;
    }

    if (trimmed.startsWith('|')) {
      const { rows, nextIndex } = parseMarkdownTable(lines, i);
      if (rows.length >= 2) {
        blocks.push({ type: 'table', headers: rows[0], rows: rows.slice(1) });
      } else if (rows.length === 1) {
        blocks.push({ type: 'paragraph', text: rows[0].join(' | ') });
      }
      i = nextIndex;
      continue;
    }

    const lv = parseLabelValue(trimmed);
    if (lv) {
      blocks.push({ type: 'labelValue', ...lv });
      i++;
      continue;
    }

    blocks.push({ type: 'paragraph', text: trimmed.replace(/^[-*]\s+/, '') });
    i++;
  }

  return blocks;
}

function blocksToOoxml(blocks) {
  const parts = [];
  for (const block of blocks) {
    if (block.type === 'section') parts.push(paragraphSectionHeader(block.text));
    else if (block.type === 'labelValue') parts.push(paragraphLabelValue(block.label, block.value));
    else if (block.type === 'table') parts.push(buildTable(block.headers, block.rows));
    else parts.push(paragraphPlain(block.text));
  }
  return parts.join('');
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="279" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
</w:styles>`;

function zipDir(sourceDir, destDocx) {
  fs.mkdirSync(path.dirname(destDocx), { recursive: true });
  const tmpZip = path.join(os.tmpdir(), `dossier-docx-${Date.now()}-${randomBytes(4).toString('hex')}.zip`);
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${sourceDir.replace(/'/g, "''")}\\*' -DestinationPath '${tmpZip.replace(/'/g, "''")}' -Force"`,
    { stdio: 'pipe' }
  );
  if (fs.existsSync(destDocx)) fs.unlinkSync(destDocx);
  fs.copyFileSync(tmpZip, destDocx);
  fs.unlinkSync(tmpZip);
}

/**
 * @param {object} params
 * @param {string} params.markdown — Grok dossier body (sections I–VII)
 * @param {string} params.outputPath
 * @param {object} [params.header] — { businessName, starRating, category, hours }
 */
export function writeMarkdownDossierDocx({ markdown, outputPath, header = {} }) {
  const blocks = parseDossierMarkdown(markdown);
  const headerParts = [];

  if (header.businessName) headerParts.push(paragraphBoldItalic(`${header.businessName} `));
  if (header.starRating) headerParts.push(paragraphBoldItalic(header.starRating));
  if (header.category) headerParts.push(paragraphBoldItalic(`Category: ${header.category} `));
  if (header.hours) headerParts.push(paragraphBoldItalic(header.hours));

  const introName = header.businessName || 'the subject business';
  headerParts.push(
    paragraphPlain(
      `Based on the data points retrieved and cross-referenced through the TSCR Protocol, here is the official dossier for ${introName}.`
    )
  );

  const body = headerParts.join('') + blocksToOoxml(blocks);

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">
  <w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840" w:orient="portrait"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body>
</w:document>`;

  const tmp = path.join(os.tmpdir(), `dossier-docx-build-${Date.now()}-${randomBytes(4).toString('hex')}`);
  fs.mkdirSync(path.join(tmp, '_rels'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'word', '_rels'), { recursive: true });

  fs.writeFileSync(path.join(tmp, '[Content_Types].xml'), CONTENT_TYPES);
  fs.writeFileSync(path.join(tmp, '_rels', '.rels'), ROOT_RELS);
  fs.writeFileSync(path.join(tmp, 'word', 'document.xml'), documentXml);
  fs.writeFileSync(path.join(tmp, 'word', 'styles.xml'), STYLES_XML);
  fs.writeFileSync(path.join(tmp, 'word', '_rels', 'document.xml.rels'), DOC_RELS);

  zipDir(tmp, outputPath);
  fs.rmSync(tmp, { recursive: true, force: true });
}

/** @deprecated Use object signature writeMarkdownDossierDocx({ markdown, outputPath, header }) */
export function writeMarkdownDossierDocxLegacy(markdown, outputPath) {
  writeMarkdownDossierDocx({ markdown, outputPath, header: {} });
}
