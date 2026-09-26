/**
 * Manifest status after dest inventory. init_complete requires
 * 8 resource classes + ai-isms + editorial roadmap + SiteSwarm taxonomy.
 */

export function resolveInitManifestStatus({
  resourcesReady,
  plan,
  existingHorizon = null,
}) {
  const roadmapExists = Boolean(plan?.roadmap_exists);
  const taxonomyExists = Boolean(plan?.taxonomy_exists);
  const planReady =
    Boolean(plan?.ready) || (roadmapExists && taxonomyExists);

  if (resourcesReady && planReady) return "init_complete";
  if (resourcesReady && !planReady) {
    if (roadmapExists && !taxonomyExists) return "awaiting_taxonomy";
    if (existingHorizon) return "awaiting_plan";
    return "awaiting_horizon";
  }
  return "init_partial";
}

export function nextPlanSkill(status) {
  if (
    status === "awaiting_horizon" ||
    status === "awaiting_plan" ||
    status === "awaiting_taxonomy"
  ) {
    return "editorial-roadmap-taxonomy";
  }
  return null;
}
