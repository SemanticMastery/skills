/**
 * Consume-only path helpers for init-owned plan artifacts.
 * Cluster extraction lives in content-pipeline-init.
 */
import fs from "node:fs";
import path from "node:path";

export function planRoadmapPath(pipelineDir) {
  return path.join(pipelineDir, "02-plan", "editorial-roadmap.md");
}

export function planTaxonomyPath(pipelineDir) {
  return path.join(pipelineDir, "02-plan", "siteswarm-tag-taxonomy.md");
}

export function publishTaxonomyPath(pipelineDir) {
  return path.join(pipelineDir, "04-publish", "siteswarm-tag-taxonomy.md");
}

/** Existing file preferred: 02-plan, then 04-publish. */
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
