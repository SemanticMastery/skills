import fs from "node:fs";
import path from "node:path";
import { manifestPath, pagesBriefDir, resourcesDir } from "./paths.mjs";
import { gridRowForField, joinKey, loadCoverageMap } from "./pd.mjs";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const src = String(text || "").replace(/^\uFEFF/, "");
  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
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

function lastPathToken(url) {
  try {
    const u = url.includes("://") ? new URL(url) : new URL(url, "https://example.invalid");
    const segs = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    return segs.length ? decodeURIComponent(segs[segs.length - 1]) : "";
  } catch {
    const segs = String(url).replace(/\/+$/, "").split("/").filter(Boolean);
    return segs.length ? segs[segs.length - 1] : "";
  }
}

function readManifest(campaignDir) {
  const file = manifestPath(campaignDir);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function resolvePageSlug(campaignDir, scope) {
  const key = joinKey(scope);
  const manifest = readManifest(campaignDir);
  const page = (manifest?.setup?.pages || []).find(
    (p) => joinKey(p.slug) === key || joinKey(p.offering) === key,
  );
  if (page?.slug) return page.slug;
  return scope;
}

/** Manifest page slug → PD catalog offering name (e.g. emergency-service → Emergency storm response). */
export function resolveCatalogOffering(campaignDir, scope) {
  const key = joinKey(scope);
  const manifest = readManifest(campaignDir);
  const page = (manifest?.setup?.pages || []).find(
    (p) => joinKey(p.slug) === key || joinKey(p.offering) === key,
  );
  return page?.offering || null;
}

export function findCrawlCsv(campaignDir) {
  const manifest = readManifest(campaignDir);
  const src = manifest?.setup?.crawl_source;
  if (src && fs.existsSync(src)) return src;
  const onpage = path.join(resourcesDir(campaignDir), "onpage");
  if (!fs.existsSync(onpage)) return null;
  const files = fs
    .readdirSync(onpage)
    .filter((n) => /^onpage-crawl-.*\.csv$/i.test(n))
    .map((name) => {
      const abs = path.join(onpage, name);
      const date = (name.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || "";
      return { abs, date, mtime: fs.statSync(abs).mtimeMs };
    });
  if (!files.length) return null;
  files.sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.mtime - a.mtime;
  });
  return files[0].abs;
}

export function crawlRowForSlug(campaignDir, slug) {
  const csvPath = findCrawlCsv(campaignDir);
  if (!csvPath) return null;
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  if (!rows.length) return null;
  const header = rows[0].map((h) => String(h).replace(/^\uFEFF/, "").trim());
  const idx = {
    url: header.findIndex((h) => /^url$/i.test(h)),
    meta_title: header.findIndex((h) => /meta_title/i.test(h)),
    h1_headings: header.findIndex((h) => /h1_headings/i.test(h)),
  };
  const key = joinKey(slug);
  for (const r of rows.slice(1)) {
    const url = r[idx.url] || "";
    if (joinKey(lastPathToken(url)) !== key) continue;
    return {
      url,
      meta_title: idx.meta_title >= 0 ? r[idx.meta_title] || "" : "",
      h1_headings: idx.h1_headings >= 0 ? r[idx.h1_headings] || "" : "",
    };
  }
  return null;
}

export function omissionsFromBrief(briefMd) {
  const m = String(briefMd || "").match(
    /## Omissions \(do not invent\)\s*([\s\S]*?)(?=\n## |\s*$)/,
  );
  if (!m) return [];
  const bullets = [];
  for (const line of m[1].split(/\r?\n/)) {
    const hit = line.match(/^\s*-\s+(.+)$/);
    if (hit) bullets.push(hit[1].trim());
  }
  return bullets;
}

function fieldForOmission(text) {
  const t = String(text).toLowerCase();
  if (/price|package|sku|per-tree fee/.test(t)) return "Pricing, Packaging, and CTA";
  if (/24\/7|night call|response time/.test(t)) return "Constraints and Exclusions";
  if (/4-step|injection|formula|process|hours|dispatch|equipment|soil test|aeration|watering/.test(t)) {
    return "Delivery Process";
  }
  if (/shrub/.test(t)) return "Scope and Inclusions";
  if (/disease|foliage|stress|visible results|outcome/.test(t)) return "Outcomes and Benefits";
  if (/eco-friendly|organic as a promised/.test(t)) return "Differentiators";
  if (/certified|isa|joshua|tenure|founding/.test(t)) return "Credentials and Proof";
  if (/skipped slug/.test(t)) return "Related Offerings";
  return "Evidence Notes";
}

function livePageGap(pdField, text, source, map) {
  return {
    pd_field: pdField,
    label: "live-page claim",
    source,
    text,
    grid_row: gridRowForField(pdField, map),
  };
}

export function briefGaps(campaignDir, slug, map = loadCoverageMap()) {
  const briefPath = path.join(pagesBriefDir(campaignDir), `page-${slug}-brief.md`);
  if (!fs.existsSync(briefPath)) return [];
  const bullets = omissionsFromBrief(fs.readFileSync(briefPath, "utf8"));
  return bullets.map((text) => {
    const pdField = fieldForOmission(text);
    return {
      pd_field: pdField,
      label: "Unknown",
      source: "brief",
      text,
      grid_row: gridRowForField(pdField, map),
    };
  });
}

export function crawlGaps(campaignDir, slug, map = loadCoverageMap()) {
  const row = crawlRowForSlug(campaignDir, slug);
  if (!row) return [];
  const text = [row.meta_title, row.h1_headings]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .join("\n");
  if (!text) return [];
  return [livePageGap("Delivery Process", text, "crawl", map)];
}

export function pastedGaps(claimsPath, map = loadCoverageMap()) {
  if (!claimsPath || !fs.existsSync(claimsPath)) return [];
  const text = fs.readFileSync(claimsPath, "utf8").trim();
  if (!text) return [];
  return [livePageGap("Delivery Process", text, "pasted", map)];
}

export function sourceGaps({ campaignDir, slug, claimsPath, map = loadCoverageMap() }) {
  return [
    ...briefGaps(campaignDir, slug, map),
    ...crawlGaps(campaignDir, slug, map),
    ...pastedGaps(claimsPath, map),
  ];
}
