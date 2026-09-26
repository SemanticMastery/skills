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

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseLastUpdated(markdown) {
  const bold = String(markdown).match(/\*\*Last updated:\*\*\s*(\S+)/);
  if (bold) return bold[1];
  const plain = String(markdown).match(/^Last updated:\s*(\S+)/m);
  return plain ? plain[1] : null;
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
    const cells = {};
    header.forEach((h, i) => {
      cells[h] = parts[i] || "";
    });
    const row = { raw: parts, cells };
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

export function findCatalogOffering(catalog, offering) {
  const key = joinKey(offering);
  return (catalog || []).find((name) => joinKey(name) === key) || null;
}

export function labelField(text, map = loadCoverageMap()) {
  const raw = String(text || "").trim();
  if (!raw) return "Unknown";
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

function stripInternalLines(text, map) {
  return String(text || "")
    .split(/\r?\n/)
    .filter((l) => !l.includes(map.internal_marker))
    .join("\n")
    .trim();
}

export function fieldUnknown(text, map = loadCoverageMap()) {
  return labelField(text, map) === "Unknown";
}

export function fieldInternalOnly(text, map = loadCoverageMap()) {
  const raw = String(text || "");
  if (!raw.includes(map.internal_marker)) return false;
  return !stripInternalLines(raw, map);
}

export function fieldCountsForScore(text, map = loadCoverageMap()) {
  if (fieldUnknown(text, map)) return false;
  if (fieldInternalOnly(text, map)) return false;
  return true;
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

export function parseProductDoc(markdown) {
  const sections = parseH2Sections(markdown);
  return {
    catalog: offeringsFromProductDoc(markdown),
    profiles: parseProfiles(markdown),
    sections,
    sourceLedger: parseMarkdownTable(sections["Source Ledger"] || ""),
  };
}

export function findProfile(parsed, offering) {
  const key = joinKey(offering);
  return (parsed.profiles || []).find((p) => joinKey(p.offering) === key) || null;
}

export function profileCites(profile, sourceId) {
  if (!profile || !sourceId) return false;
  const blob = Object.values(profile.fields || {}).join("\n");
  return blob.includes(sourceId);
}

export function ownerInterviewCovers(parsed, offering, slug, profile) {
  const offeringKey = joinKey(offering);
  const slugKey = joinKey(slug);
  for (const row of parsed.sourceLedger || []) {
    const type = row.cells?.Type || "";
    if (!/owner\s+interview/i.test(type)) continue;
    const blob = (row.raw || []).join(" ");
    const blobKey = joinKey(blob);
    if (slug && blob.toLowerCase().includes(String(slug).toLowerCase())) return true;
    if (offeringKey && blobKey.includes(offeringKey)) return true;
    if (slugKey && blobKey.includes(slugKey)) return true;
    const sourceId = row.cells?.["Source ID"];
    if (sourceId && profileCites(profile, sourceId)) return true;
  }
  return false;
}

export function paaFaqsCovered(campaignDir, slug, seed, map = loadCoverageMap()) {
  const paa = map.grid_rows?.find((r) => r.paa)?.paa;
  const rel = paa?.dir || "01-resources/paa";
  const paaDir = path.join(campaignDir, "06-content-pipeline", rel.replace(/^01-resources[\\/]/, "01-resources/"));
  if (!fs.existsSync(paaDir)) return false;
  const slugNeedle = String(slug || "").toLowerCase();
  const seedNeedle = slugify(seed);
  for (const name of fs.readdirSync(paaDir)) {
    if (!/^paa-/i.test(name)) continue;
    const base = name.toLowerCase();
    if (slugNeedle && base.includes(slugNeedle)) return true;
    if (seedNeedle && base.includes(seedNeedle)) return true;
  }
  return false;
}

export function scoreOffering({ parsed, profile, map, campaignDir, slug, seed }) {
  const covered_rows = [];
  for (const row of map.grid_rows || []) {
    if (row.paa) {
      if (paaFaqsCovered(campaignDir, slug, seed, map)) covered_rows.push(row.row);
      continue;
    }
    let covered = false;
    for (const field of row.fields || []) {
      const text = profile?.fields?.[field] || "";
      if (row.delivery_process_requires && field === "Delivery Process") {
        const re = new RegExp(map[row.delivery_process_requires], "i");
        if (!re.test(text)) continue;
      }
      if (fieldCountsForScore(text, map)) {
        covered = true;
        break;
      }
    }
    if (covered) covered_rows.push(row.row);
  }
  return covered_rows;
}

export const R20_FIELDS = [
  "Delivery Process",
  "Scope and Inclusions",
  "Pricing, Packaging, and CTA",
  "Constraints and Exclusions",
];

export function r20AllUnknown(profile, map = loadCoverageMap()) {
  return R20_FIELDS.every((field) => fieldUnknown(profile?.fields?.[field] || "", map));
}
