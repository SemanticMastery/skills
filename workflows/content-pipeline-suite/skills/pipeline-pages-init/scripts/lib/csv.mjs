import fs from "node:fs";
import path from "node:path";

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function stripBom(s) {
  return String(s || "").replace(/^\uFEFF/, "").trim();
}

export function csvDateFromName(name) {
  const m = String(name).match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export function findNewestCrawl(onpageDir) {
  if (!fs.existsSync(onpageDir)) return null;
  const files = fs
    .readdirSync(onpageDir)
    .filter((n) => /^onpage-crawl-.*\.csv$/i.test(n))
    .map((name) => {
      const abs = path.join(onpageDir, name);
      const st = fs.statSync(abs);
      return {
        name,
        abs,
        date: csvDateFromName(name),
        mtime: st.mtimeMs,
      };
    });
  if (!files.length) return null;
  files.sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.mtime - a.mtime;
  });
  return files[0];
}

export function loadCrawlRows(csvPath) {
  const text = fs.readFileSync(csvPath, "utf8");
  const rows = parseCsv(text);
  if (!rows.length) return { header: [], records: [] };
  const header = rows[0].map(stripBom);
  const idx = {
    url: header.findIndex((h) => /^url$/i.test(h)),
    meta_title: header.findIndex((h) => /meta_title/i.test(h)),
    h1_headings: header.findIndex((h) => /h1_headings/i.test(h)),
    word_count: header.findIndex((h) => /word_count/i.test(h)),
  };
  const records = rows.slice(1).map((r) => ({
    url: r[idx.url] || "",
    meta_title: r[idx.meta_title] || "",
    h1_headings: r[idx.h1_headings] || "",
    word_count: r[idx.word_count] || "",
  }));
  return { header, records };
}

export function lastPathToken(url) {
  try {
    const u = url.includes("://") ? new URL(url) : new URL(url, "https://example.invalid");
    const segs = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (!segs.length) return "";
    return decodeURIComponent(segs[segs.length - 1]);
  } catch {
    const segs = String(url).replace(/\/+$/, "").split("/").filter(Boolean);
    return segs.length ? segs[segs.length - 1] : "";
  }
}

export function isHomepage(url) {
  return lastPathToken(url) === "";
}

export function isLocationSlug(slug) {
  return /-[a-z]{2}$/i.test(slug || "");
}

export function servicePagesFromCrawl(records) {
  const out = [];
  for (const rec of records) {
    if (isHomepage(rec.url)) continue;
    const slug = lastPathToken(rec.url);
    if (!slug || isLocationSlug(slug)) continue;
    out.push({ ...rec, slug });
  }
  return out;
}
