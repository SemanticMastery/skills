import fs from "node:fs";

const ALLOWLIST_HEADER = /^##\s+Allowlist\b/i;
const CITY_HEADER = /City\s*→\s*county|City\s*->\s*county/i;
const CLUSTER_HEADER = /Cluster\s*→\s*tag|Cluster\s*->\s*tag/i;

function parsePipeRow(line) {
  if (!line.startsWith("|")) return null;
  const parts = line.split("|").slice(1, -1).map((c) => c.trim());
  if (parts.length < 2) return null;
  if (parts.every((c) => /^[-: ]+$/.test(c))) return null;
  return parts;
}

/**
 * Parse `{pipeline_dir}/02-plan/siteswarm-tag-taxonomy.md`
 * (fallback: existing `04-publish/` copy).
 * Missing file is the caller's hard-stop.
 */
export function parseTaxonomyMarkdown(md) {
  const lines = String(md).split(/\r?\n/);
  const allowlist = [];
  const cityToCounty = {};
  const clusterMap = [];

  let section = null;
  for (const line of lines) {
    if (ALLOWLIST_HEADER.test(line)) {
      section = "allowlist";
      continue;
    }
    if (/^##\s+/.test(line) && CLUSTER_HEADER.test(line)) {
      section = "cluster";
      continue;
    }
    if (/^###\s+/.test(line) && CITY_HEADER.test(line)) {
      section = "city";
      continue;
    }
    if (/^##\s+/.test(line) && !ALLOWLIST_HEADER.test(line) && !CLUSTER_HEADER.test(line)) {
      if (section === "allowlist") section = null;
      else if (section === "cluster" && !CITY_HEADER.test(line)) section = null;
    }
    if (/^###\s+/.test(line) && !CITY_HEADER.test(line) && section === "city") {
      section = null;
    }

    const row = parsePipeRow(line);
    if (!row) continue;
    const first = row[0];
    if (!first) continue;
    if (/^tag$/i.test(first) || /^roadmap cluster$/i.test(first) || /^city/i.test(first)) {
      continue;
    }

    if (section === "allowlist") {
      allowlist.push(first);
    } else if (section === "city") {
      const county = row[1];
      if (county) {
        first.split(/,/).forEach((city) => {
          const c = city.trim();
          if (c) cityToCounty[c.toLowerCase()] = county;
        });
      }
    } else if (section === "cluster") {
      clusterMap.push({
        cluster: first,
        primary_tag: row[1] || "",
        county_note: row[2] || "",
      });
    }
  }

  return { allowlist, cityToCounty, clusterMap };
}

export function loadTaxonomyFile(taxonomyPath) {
  if (!fs.existsSync(taxonomyPath)) {
    const err = new Error(
      `Missing siteswarm-tag-taxonomy.md at ${taxonomyPath}. Ingest/classify hard-stops — do not invent tags.`,
    );
    err.code = "MISSING_TAXONOMY";
    throw err;
  }
  return parseTaxonomyMarkdown(fs.readFileSync(taxonomyPath, "utf8"));
}

export function isCountyTag(tag) {
  return /county$/i.test(String(tag || "").trim());
}

export function dropInvalidTags(tags, allowlist) {
  const set = new Set(allowlist);
  const kept = [];
  const dropped = [];
  for (const t of tags || []) {
    if (set.has(t)) kept.push(t);
    else dropped.push(t);
  }
  return { kept, dropped };
}

export function countyTagsFromCaption(caption, cityToCounty) {
  if (!caption) return [];
  const lower = caption.toLowerCase();
  const found = new Set();
  for (const [city, county] of Object.entries(cityToCounty || {})) {
    if (city.length < 3) continue;
    const re = new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) found.add(county);
  }
  return [...found];
}

export function primaryTagFromCluster(cluster, clusterMap) {
  if (!cluster || !clusterMap?.length) return null;
  const exact = clusterMap.find(
    (r) => r.cluster.toLowerCase() === String(cluster).toLowerCase(),
  );
  return exact?.primary_tag || null;
}
