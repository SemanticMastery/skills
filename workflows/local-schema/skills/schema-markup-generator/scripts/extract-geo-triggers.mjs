#!/usr/bin/env node
/**
 * Extract ContentMaxima Algorithm Trigger Words with Count >= threshold.
 *
 * Official XLSX: sheet name matches /algorithm\s*trigger\s*words/i
 *   term = column A; Count = header named Count / frequency / freq
 * Reverse-engineered CSV: Term,Count (or first two columns)
 *
 * Usage:
 *   node extract-geo-triggers.mjs --input "{file}" --slug "{slug}" --out "{knowsaboutDir}"
 *   node extract-geo-triggers.mjs --input "{file}" --slug "{slug}" --out "{file.csv}"
 *
 * Writes {slug}-geo-triggers.csv with headers term,count
 * Exit 0 on success. Exit 1 when the sheet/file cannot be parsed or no rows pass.
 */

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const DEFAULT_THRESHOLD = 40;
const SHEET_RE = /algorithm\s*trigger\s*words/i;
const COUNT_HEADER_RE = /^(count|frequency|freq)$/i;

function usage() {
  console.error(
    'Usage: node extract-geo-triggers.mjs --input <matrix.xlsx|triggers.csv> --slug <slug> --out <dir-or-csv> [--threshold 40]'
  );
}

function parseArgs(argv) {
  const out = { input: '', slug: '', out: '', threshold: DEFAULT_THRESHOLD };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--input' && next) out.input = next, i++;
    else if (a === '--slug' && next) out.slug = next, i++;
    else if (a === '--out' && next) out.out = next, i++;
    else if (a === '--threshold' && next) out.threshold = Number(next), i++;
    else if (a === '--help' || a === '-h') return { help: true };
  }
  return out;
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCsvLine(line) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function parseCsv(text) {
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length);
  return lines.map(parseCsvLine);
}

function rowsFromCsv(text, threshold) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map((c) => String(c || '').trim());
  let termIdx = header.findIndex((h) => /^term$/i.test(h));
  let countIdx = header.findIndex((h) => COUNT_HEADER_RE.test(h));
  if (termIdx < 0) termIdx = 0;
  if (countIdx < 0) countIdx = 1;
  const out = [];
  for (const row of rows.slice(1)) {
    const term = String(row[termIdx] || '').trim();
    const count = Number(String(row[countIdx] || '').replace(/,/g, ''));
    if (term && Number.isFinite(count) && count >= threshold) out.push({ term, count });
  }
  return out;
}

function readUInt16LE(buf, offset) {
  return buf.readUInt16LE(offset);
}

function readUInt32LE(buf, offset) {
  return buf.readUInt32LE(offset);
}

/** Minimal ZIP reader: stored + deflated local-file entries only. */
function unzipEntries(buf) {
  const entries = new Map();
  let i = 0;
  while (i + 30 <= buf.length) {
    const sig = readUInt32LE(buf, i);
    if (sig !== 0x04034b50) break;
    const method = readUInt16LE(buf, i + 8);
    const compSize = readUInt32LE(buf, i + 18);
    const uncompSize = readUInt32LE(buf, i + 22);
    const nameLen = readUInt16LE(buf, i + 26);
    const extraLen = readUInt16LE(buf, i + 28);
    const name = buf.slice(i + 30, i + 30 + nameLen).toString('utf8');
    const dataStart = i + 30 + nameLen + extraLen;
    const data = buf.slice(dataStart, dataStart + compSize);
    let raw;
    if (method === 0) raw = data;
    else if (method === 8) raw = inflateRawSync(data);
    else throw new Error(`unsupported zip method ${method} for ${name}`);
    if (uncompSize && raw.length !== uncompSize && method === 0) {
      // allow
    }
    entries.set(name.replace(/\\/g, '/'), raw);
    i = dataStart + compSize;
  }
  if (!entries.size) throw new Error('no zip local-file entries (not a valid xlsx)');
  return entries;
}

function xmlDecode(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseSharedStrings(xml) {
  const strings = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let m;
  while ((m = siRe.exec(xml))) {
    const texts = [];
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
    let tm;
    while ((tm = tRe.exec(m[1]))) texts.push(xmlDecode(tm[1]));
    strings.push(texts.join(''));
  }
  return strings;
}

function colRowFromRef(ref) {
  const m = String(ref).match(/^([A-Z]+)(\d+)$/i);
  if (!m) return null;
  const letters = m[1].toUpperCase();
  let col = 0;
  for (let i = 0; i < letters.length; i++) col = col * 26 + (letters.charCodeAt(i) - 64);
  return { col: col - 1, row: Number(m[2]) - 1 };
}

function parseSheetCells(xml, shared) {
  const grid = [];
  const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
  let m;
  while ((m = cellRe.exec(xml))) {
    const attrs = m[1];
    const inner = m[2];
    const refM = attrs.match(/\br="([^"]+)"/);
    if (!refM) continue;
    const pos = colRowFromRef(refM[1]);
    if (!pos) continue;
    const typeM = attrs.match(/\bt="([^"]+)"/);
    const type = typeM ? typeM[1] : '';
    const vM = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
    const isM = inner.match(/<is\b[^>]*>([\s\S]*?)<\/is>/);
    let value = '';
    if (type === 's' && vM) {
      value = shared[Number(vM[1])] ?? '';
    } else if (type === 'inlineStr' && isM) {
      const tM = isM[1].match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
      value = tM ? xmlDecode(tM[1]) : '';
    } else if (vM) {
      value = xmlDecode(vM[1]);
    }
    if (!grid[pos.row]) grid[pos.row] = [];
    grid[pos.row][pos.col] = value;
  }
  return grid;
}

function sheetPathFromWorkbook(entries) {
  const wb = (entries.get('xl/workbook.xml') || Buffer.alloc(0)).toString('utf8');
  const rels = (entries.get('xl/_rels/workbook.xml.rels') || Buffer.alloc(0)).toString('utf8');
  const sheetRe = /<sheet\b([^>]*)\/?>/gi;
  let m;
  const ridToTarget = new Map();
  const relRe = /<Relationship\b([^>]*)\/?>/gi;
  let rm;
  while ((rm = relRe.exec(rels))) {
    const idM = rm[1].match(/\bId="([^"]+)"/);
    const tgtM = rm[1].match(/\bTarget="([^"]+)"/);
    if (idM && tgtM) ridToTarget.set(idM[1], tgtM[1].replace(/^\//, ''));
  }
  while ((m = sheetRe.exec(wb))) {
    const nameM = m[1].match(/\bname="([^"]+)"/);
    const ridM = m[1].match(/\br:id="([^"]+)"/);
    const name = nameM ? xmlDecode(nameM[1]) : '';
    if (!SHEET_RE.test(name) || !ridM) continue;
    let target = ridToTarget.get(ridM[1]);
    if (!target) continue;
    if (!target.startsWith('xl/')) target = `xl/${target.replace(/^\.\//, '')}`;
    return { name, path: target };
  }
  return null;
}

function tryExcelJs(inputPath, threshold) {
  const require = createRequire(import.meta.url);
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '../../contentmaxima/node_modules/exceljs'),
    join(here, '../../../contentmaxima/node_modules/exceljs'),
    'exceljs',
  ];
  let ExcelJS;
  for (const c of candidates) {
    try {
      ExcelJS = require(c);
      break;
    } catch {
      // next
    }
  }
  if (!ExcelJS) return null;
  return (async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(inputPath);
    const sheet = wb.worksheets.find((ws) => SHEET_RE.test(ws.name));
    if (!sheet) throw new Error('no Algorithm Trigger Words sheet');
    const headerRow = sheet.getRow(1);
    let countIdx = 2;
    headerRow.eachCell((cell, colNumber) => {
      if (COUNT_HEADER_RE.test(String(cell.value ?? '').trim())) countIdx = colNumber;
    });
    const out = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const term = String(row.getCell(1).value ?? '').trim();
      const count = Number(String(row.getCell(countIdx).value ?? '').replace(/,/g, ''));
      if (term && Number.isFinite(count) && count >= threshold) out.push({ term, count });
    });
    return out;
  })();
}

function rowsFromXlsxBuffer(buf, threshold) {
  const entries = unzipEntries(buf);
  const sharedXml = (entries.get('xl/sharedStrings.xml') || Buffer.from('')).toString('utf8');
  const shared = parseSharedStrings(sharedXml);
  const found = sheetPathFromWorkbook(entries);
  if (!found) throw new Error('no worksheet named Algorithm Trigger Words');
  const sheetXml = (entries.get(found.path) || Buffer.alloc(0)).toString('utf8');
  if (!sheetXml) throw new Error(`missing sheet xml ${found.path}`);
  const grid = parseSheetCells(sheetXml, shared);
  if (!grid.length) return [];
  const header = (grid[0] || []).map((c) => String(c || '').trim());
  let countIdx = header.findIndex((h) => COUNT_HEADER_RE.test(h));
  if (countIdx < 0) countIdx = 1;
  const out = [];
  for (const row of grid.slice(1)) {
    if (!row) continue;
    const term = String(row[0] || '').trim();
    const count = Number(String(row[countIdx] || '').replace(/,/g, ''));
    if (term && Number.isFinite(count) && count >= threshold) out.push({ term, count });
  }
  return out;
}

function resolveOutPath(outArg, slug) {
  const target = isAbsolute(outArg) ? outArg : resolve(process.cwd(), outArg);
  if (target.toLowerCase().endsWith('.csv')) return target;
  return join(target, `${slug}-geo-triggers.csv`);
}

function writeTriggers(outPath, rows) {
  mkdirSync(dirname(outPath), { recursive: true });
  const body = ['term,count', ...rows.map((r) => `${csvEscape(r.term)},${r.count}`)].join('\n');
  writeFileSync(outPath, `${body}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }
  if (!args.input || !args.slug || !args.out) {
    usage();
    process.exit(1);
  }
  if (!Number.isFinite(args.threshold) || args.threshold < 0) {
    console.error('invalid --threshold');
    process.exit(1);
  }
  const inputPath = isAbsolute(args.input) ? args.input : resolve(process.cwd(), args.input);
  if (!existsSync(inputPath)) {
    console.error(`input not found: ${inputPath}`);
    process.exit(1);
  }
  const ext = extname(inputPath).toLowerCase();
  let rows;
  if (ext === '.csv') {
    rows = rowsFromCsv(readFileSync(inputPath, 'utf8'), args.threshold);
  } else if (ext === '.xlsx' || ext === '.xlsm') {
    try {
      const viaExcel = await tryExcelJs(inputPath, args.threshold);
      rows = viaExcel ?? rowsFromXlsxBuffer(readFileSync(inputPath), args.threshold);
    } catch (err) {
      try {
        rows = rowsFromXlsxBuffer(readFileSync(inputPath), args.threshold);
      } catch (err2) {
        console.error(err2.message || err.message);
        process.exit(1);
      }
    }
  } else {
    console.error(`unsupported input type: ${ext || '(none)'} (use .xlsx or .csv)`);
    process.exit(1);
  }

  rows.sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
  const outPath = resolveOutPath(args.out, args.slug);
  writeTriggers(outPath, rows);
  console.log(`wrote ${rows.length} terms (count >= ${args.threshold}) → ${outPath}`);
  if (!rows.length) {
    console.error('no high-impact terms at this threshold');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
