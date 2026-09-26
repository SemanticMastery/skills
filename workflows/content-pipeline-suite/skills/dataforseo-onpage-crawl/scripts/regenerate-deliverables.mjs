#!/usr/bin/env node
/**
 * Rebuild .csv + .xlsx from an existing crawl CSV (fixes encoding / bad XLSX).
 * Usage: node regenerate-deliverables.mjs --csv path/to/file.csv
 */

import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { normalizeField } from './text-normalize.mjs';
import { assertDeliverableContent } from './content-quality.mjs';

const ROW_HEADERS = [
  'url',
  'meta_title',
  'h1_count',
  'h1_headings',
  'h2_h6_count',
  'word_count',
  'is_orphan_page',
];

function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else cur += ch;
  }
  fields.push(cur);
  return fields;
}

function parseCsv(content) {
  const text = content.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const [headerLine, ...dataLines] = lines;
  const headers = parseCsvLine(headerLine);
  return dataLines.map((line) => {
    const vals = parseCsvLine(line);
    /** @type {Record<string, string>} */
    const row = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? '';
    });
    if (row.h1_headings?.includes(' | ')) row.h1_headings = row.h1_headings.split(' | ');
    if (row.is_orphan_page === 'true') row.is_orphan_page = true;
    else if (row.is_orphan_page === 'false') row.is_orphan_page = false;
    if (row.h1_count !== '') row.h1_count = Number(row.h1_count);
    if (row.h2_h6_count !== '') row.h2_h6_count = Number(row.h2_h6_count);
    if (row.word_count !== '') row.word_count = Number(row.word_count);
    return normalizeField(row);
  });
}

function cellValue(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return v.join(' | ');
  return String(v);
}

function toCsv(rows) {
  const q = (v) => {
    const s = cellValue(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [ROW_HEADERS.join(','), ...rows.map((r) => ROW_HEADERS.map((h) => q(r[h])).join(','))].join('\n');
}

function writePair(csvPath, rows) {
  const dir = path.dirname(csvPath);
  const base = path.basename(csvPath, '.csv');
  const outCsv = path.join(dir, `${base}.csv`);
  const outXlsx = path.join(dir, `${base}.xlsx`);
  fs.writeFileSync(outCsv, '\uFEFF' + toCsv(rows), 'utf8');
  const sheetRows = [ROW_HEADERS, ...rows.map((r) => ROW_HEADERS.map((h) => cellValue(r[h])))];
  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pages');
  XLSX.writeFile(wb, outXlsx);
  return { outCsv, outXlsx };
}

const csvArg = process.argv.find((a, i) => process.argv[i - 1] === '--csv' || a === '--csv');
const csvPath = csvArg === '--csv' ? process.argv[process.argv.indexOf('--csv') + 1] : process.argv[2];
const allowEmptyContent = process.argv.includes('--allow-empty-content');
if (!csvPath) {
  console.error(
    'Usage: node regenerate-deliverables.mjs --csv path/to/onpage-crawl-....csv [--allow-empty-content]'
  );
  process.exit(1);
}

const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const contentStats = assertDeliverableContent(rows, {
  allowEmptyContent,
  context: `regenerate csv=${csvPath}`,
});
const written = writePair(csvPath, rows);
console.log(JSON.stringify({ pages: rows.length, content_quality: contentStats, ...written }, null, 2));
