/**
 * Unique Cluster values from an editorial-roadmap markdown table.
 */
import fs from "node:fs";
import path from "node:path";

export function parsePipeRow(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed.startsWith("|")) return [];
  return trimmed
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

export function isSeparatorRow(line) {
  const cells = parsePipeRow(line);
  if (!cells.length) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

export function extractClustersFromMarkdown(markdown) {
  const lines = String(markdown ?? "")
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|"));

  if (!lines.length) {
    return { header: [], clusters: [], error: "no markdown table rows" };
  }

  const header = parsePipeRow(lines[0]);
  const clusterIdx = header.findIndex((h) => /^cluster$/i.test(h));
  if (clusterIdx < 0) {
    return { header, clusters: [], error: "no Cluster column" };
  }

  const counts = new Map();
  for (const line of lines.slice(1)) {
    if (isSeparatorRow(line)) continue;
    const cols = parsePipeRow(line);
    const name = cols[clusterIdx];
    if (!name || /^cluster$/i.test(name)) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  const clusters = [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));

  return { header, clusters };
}

export function planRoadmapPath(pipelineDir) {
  return path.join(pipelineDir, "02-plan", "editorial-roadmap.md");
}

export function planTaxonomyPath(pipelineDir) {
  return path.join(pipelineDir, "02-plan", "siteswarm-tag-taxonomy.md");
}

export function publishTaxonomyPath(pipelineDir) {
  return path.join(pipelineDir, "04-publish", "siteswarm-tag-taxonomy.md");
}

/** Existing file preferred: 02-plan, then 04-publish. Write target is always 02-plan. */
export function resolveSiteswarmTaxonomy(pipelineDir) {
  const plan = planTaxonomyPath(pipelineDir);
  const publish = publishTaxonomyPath(pipelineDir);
  if (fs.existsSync(plan)) return plan;
  if (fs.existsSync(publish)) return publish;
  return plan;
}

export function siteswarmTaxonomyExists(pipelineDir) {
  return (
    fs.existsSync(planTaxonomyPath(pipelineDir)) ||
    fs.existsSync(publishTaxonomyPath(pipelineDir))
  );
}

export function editorialRoadmapExists(pipelineDir) {
  const p = planRoadmapPath(pipelineDir);
  try {
    return fs.existsSync(p) && fs.statSync(p).size > 0;
  } catch {
    return false;
  }
}

export function planArtifactsReady(pipelineDir) {
  return editorialRoadmapExists(pipelineDir) && siteswarmTaxonomyExists(pipelineDir);
}
