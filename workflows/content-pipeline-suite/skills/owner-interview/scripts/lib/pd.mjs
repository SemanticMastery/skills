import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const COVERAGE_MAP_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "references",
  "coverage-map.json",
);

const GAP_LABELS = new Set(["Unknown", "Unverified company claim", "Conflict —"]);

const FIELD_ALIASES = {
  "Credentials, Standards, and Risk Controls": "Credentials and Proof",
  "Proof and Documented Claims": "Credentials and Proof",
  "Company Offering Summary": "Description",
  "Cross-Offering Capabilities": "Delivery Process",
  "Service Geography and Eligibility": "Geography and Eligibility",
};

const FIELD_GRID_FALLBACK = {
  "Customer Problem": "What the service is",
  "Category and Type": "What the service is",
  "Related Offerings": "What the service is",
  "Geography and Eligibility": "What the service is",
  "Evidence Notes": "FAQs",
  "Open Questions": "FAQs",
  "Conflicts and Verification Needs": "FAQs",
  "Purpose and Authority": "FAQs",
};

let cachedMap;

export function loadCoverageMap() {
  if (!cachedMap) {
    cachedMap = JSON.parse(fs.readFileSync(COVERAGE_MAP_PATH, "utf8"));
  }
  return cachedMap;
}

export function joinKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseMarkdownTable(block) {
  const lines = String(block || "")
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith("|"));
  if (lines.length < 2) return [];
  const header = lines[0]
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);
  const offeringIdx = header.findIndex((h) => /^offering$/i.test(h));
  const rows = [];
  for (const line of lines.slice(2)) {
    const parts = line.split("|").slice(1, -1).map((c) => c.trim());
    if (!parts.length || parts.every((p) => !p)) continue;
    const row = { raw: parts, cells: {} };
    header.forEach((h, i) => {
      row.cells[h] = parts[i] || "";
    });
    if (offeringIdx >= 0) row.offering = parts[offeringIdx];
    rows.push(row);
  }
  return rows;
}

export function offeringsFromProductDoc(markdown) {
  const catalogMatch = String(markdown).match(/## Offering Catalog\s*([\s\S]*?)(?=\n## )/);
  if (catalogMatch) {
    const rows = parseMarkdownTable(catalogMatch[1]);
    if (rows.length) return rows.map((r) => r.offering).filter(Boolean);
  }
  const profiles = String(markdown).match(
    /## Product and Service Profiles\s*([\s\S]*?)(?=\n## )/,
  );
  if (!profiles) return [];
  const names = [];
  for (const m of profiles[1].matchAll(/^### (.+)$/gm)) {
    names.push(m[1].trim());
  }
  return names;
}

export function findOffering(catalog, scope) {
  const key = joinKey(scope);
  return (catalog || []).find((name) => joinKey(name) === key) || null;
}

export function labelField(text, map = loadCoverageMap()) {
  const raw = String(text || "");
  const unknownRe = new RegExp(map.unknown_pattern, "m");
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.some((l) => unknownRe.test(l))) return "Unknown";
  const blob = lines.join("\n");
  if (lines.some((l) => l.startsWith(map.conflict_prefix)) || blob.includes(map.conflict_prefix)) {
    return map.conflict_prefix;
  }
  if (
    lines.some((l) => l.startsWith(map.unverified_prefix)) ||
    blob.includes(map.unverified_prefix)
  ) {
    return map.unverified_prefix;
  }
  if (
    lines.some((l) => l.startsWith(map.inference_prefix)) ||
    blob.includes(map.inference_prefix)
  ) {
    return map.inference_prefix;
  }
  return "cited";
}

export function isGapLabel(label) {
  return GAP_LABELS.has(label);
}

export function gridRowForField(field, map = loadCoverageMap()) {
  for (const row of map.grid_rows || []) {
    if ((row.fields || []).includes(field)) return row.row;
  }
  const aliased = FIELD_ALIASES[field];
  if (aliased) {
    for (const row of map.grid_rows || []) {
      if ((row.fields || []).includes(aliased)) return row.row;
    }
    if (FIELD_GRID_FALLBACK[aliased]) return FIELD_GRID_FALLBACK[aliased];
  }
  return FIELD_GRID_FALLBACK[field] || "FAQs";
}

function parseProfiles(markdown) {
  const m = String(markdown).match(/## Product and Service Profiles\s*([\s\S]*?)(?=\n## )/);
  if (!m) return [];
  const body = m[1];
  const hits = [...body.matchAll(/^### (.+)$/gm)];
  const profiles = [];
  for (let i = 0; i < hits.length; i++) {
    const name = hits[i][1].trim();
    const start = hits[i].index + hits[i][0].length;
    const end = i + 1 < hits.length ? hits[i + 1].index : body.length;
    const block = body.slice(start, end);
    const fields = {};
    const subs = [...block.matchAll(/^#### (.+)$/gm)];
    for (let j = 0; j < subs.length; j++) {
      const field = subs[j][1].trim();
      const fs = subs[j].index + subs[j][0].length;
      const fe = j + 1 < subs.length ? subs[j + 1].index : block.length;
      fields[field] = block.slice(fs, fe).trim();
    }
    profiles.push({ offering: name, fields });
  }
  return profiles;
}

function parseH2Sections(markdown) {
  const sections = {};
  const hits = [...String(markdown).matchAll(/^## (.+)$/gm)];
  for (let i = 0; i < hits.length; i++) {
    const title = hits[i][1].trim();
    const start = hits[i].index + hits[i][0].length;
    const end = i + 1 < hits.length ? hits[i + 1].index : markdown.length;
    sections[title] = String(markdown).slice(start, end).trim();
  }
  return sections;
}

function numberedItems(text) {
  const items = [];
  const re = /^\d+\.\s+([\s\S]*?)(?=^\d+\.\s+|\s*$)/gm;
  let m;
  while ((m = re.exec(String(text || "")))) {
    items.push(m[1].trim());
  }
  return items;
}

export function parseProductDoc(markdown) {
  const sections = parseH2Sections(markdown);
  return {
    catalog: offeringsFromProductDoc(markdown),
    catalogRows: parseMarkdownTable(sections["Offering Catalog"] || ""),
    profiles: parseProfiles(markdown),
    sections,
    openQuestions: numberedItems(sections["Open Questions"] || ""),
    conflicts: numberedItems(sections["Conflicts and Verification Needs"] || ""),
    credentialsRows: parseMarkdownTable(sections["Credentials, Standards, and Risk Controls"] || ""),
    proofRows: parseMarkdownTable(sections["Proof and Documented Claims"] || ""),
    sourceLedger: parseMarkdownTable(sections["Source Ledger"] || ""),
  };
}

function gapRecord(pdField, label, source, text, map) {
  return {
    pd_field: pdField,
    label,
    source,
    text,
    grid_row: gridRowForField(pdField, map),
  };
}

export function offeringPdGaps(parsed, scope, map = loadCoverageMap()) {
  const key = joinKey(scope);
  const profile = (parsed.profiles || []).find((p) => joinKey(p.offering) === key);
  if (!profile) return [];
  const gaps = [];
  for (const [field, text] of Object.entries(profile.fields)) {
    const label = labelField(text, map);
    if (!isGapLabel(label)) continue;
    gaps.push(gapRecord(field, label, "pd", text, map));
  }
  return gaps;
}

function tableRowGaps(rows, pdField, map) {
  const gaps = [];
  for (const row of rows || []) {
    const text = (row.raw || []).join(" | ");
    const label = labelField(text, map);
    if (!isGapLabel(label)) continue;
    gaps.push(gapRecord(pdField, label, "pd", text, map));
  }
  return gaps;
}

function listItemGaps(items, pdField, map, fallbackLabel) {
  return (items || []).map((text) => {
    let label = labelField(text, map);
    if (label === "cited" && /\bUnknown\b/.test(text)) label = "Unknown";
    if (label === "cited") label = fallbackLabel;
    return gapRecord(pdField, label, "pd", text, map);
  });
}

export function companyPdGaps(parsed, map = loadCoverageMap()) {
  const gaps = [];
  gaps.push(
    ...tableRowGaps(parsed.credentialsRows, "Credentials and Proof", map),
    ...tableRowGaps(parsed.proofRows, "Proof and Documented Claims", map),
    ...listItemGaps(parsed.conflicts, "Conflicts and Verification Needs", map, "Conflict —"),
    ...listItemGaps(parsed.openQuestions, "Open Questions", map, "Unknown"),
  );

  const proseSections = [
    ["Company Offering Summary", "Company Offering Summary"],
    ["Cross-Offering Capabilities", "Cross-Offering Capabilities"],
    ["Service Geography and Eligibility", "Geography and Eligibility"],
  ];
  for (const [sectionTitle, pdField] of proseSections) {
    const text = parsed.sections?.[sectionTitle];
    if (!text) continue;
    const label = labelField(text, map);
    if (!isGapLabel(label)) continue;
    gaps.push(gapRecord(pdField, label, "pd", text, map));
  }
  return gaps;
}
