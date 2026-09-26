import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const DEFAULT_MIN_COUNT = 40;

export function parseSharedStrings(xml) {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => {
    const ts = [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((x) => x[1]);
    return ts.join("");
  });
}

export function cellValue(cxml, strings) {
  const v = (cxml.match(/<v>([^<]*)<\/v>/) || [])[1];
  if (v == null) return "";
  if (/t="s"/.test(cxml)) return strings[Number(v)] ?? "";
  return v;
}

export function parseTermCountSheet(sheetXml, strings) {
  const rows = [...sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)];
  const out = [];
  let termCol = "A";
  let countCol = "B";
  let headerSeen = false;
  for (const row of rows) {
    const cells = [...row[1].matchAll(/<c r="([A-Z]+)(\d+)"[^>]*>([\s\S]*?)<\/c>/g)].map(
      (m) => ({ col: m[1], val: cellValue(m[0], strings) }),
    );
    const map = Object.fromEntries(cells.map((c) => [c.col, c.val]));
    if (!headerSeen) {
      const vals = cells.map((c) => String(c.val).trim().toLowerCase());
      const t = cells.find((c) => /^term$/i.test(c.val));
      const n = cells.find((c) => /^(count|frequency score|frequency)$/i.test(c.val));
      if (t) termCol = t.col;
      if (n) countCol = n.col;
      if (vals.includes("term") && vals.some((v) => /count|frequency/.test(v))) {
        headerSeen = true;
        continue;
      }
    }
    const term = String(map[termCol] || "").trim();
    const count = Number(map[countCol]);
    if (!term || Number.isNaN(count)) continue;
    out.push({ term, count });
  }
  return out;
}

export function unzipXlsx(xlsxPath) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mx-terms-"));
  const zip = path.join(tmp, "m.zip");
  const dest = path.join(tmp, "x");
  fs.copyFileSync(xlsxPath, zip);
  fs.mkdirSync(dest, { recursive: true });
  if (process.platform === "win32") {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force"`,
      { stdio: "pipe" },
    );
  } else {
    execSync(`unzip -q "${zip}" -d "${dest}"`, { stdio: "pipe" });
  }
  return { tmp, dest };
}

export function readWorkbookSheetNames(dest) {
  const wb = fs.readFileSync(path.join(dest, "xl", "workbook.xml"), "utf8");
  return [...wb.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
}

export function extractTermCounts(xlsxPath) {
  const { tmp, dest } = unzipXlsx(xlsxPath);
  try {
    const names = readWorkbookSheetNames(dest);
    const idx = names.findIndex((n) => /algorithm trigger words/i.test(n));
    const sheetFile = idx >= 0 ? `sheet${idx + 1}.xml` : "sheet2.xml";
    const strings = parseSharedStrings(
      fs.readFileSync(path.join(dest, "xl", "sharedStrings.xml"), "utf8"),
    );
    const sheetXml = fs.readFileSync(path.join(dest, "xl", "worksheets", sheetFile), "utf8");
    return parseTermCountSheet(sheetXml, strings);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export function highImpactTerms(rows, minCount = DEFAULT_MIN_COUNT) {
  return rows
    .filter((r) => r.count >= minCount)
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
}

export function parseTermList(text) {
  return String(text || "")
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}
