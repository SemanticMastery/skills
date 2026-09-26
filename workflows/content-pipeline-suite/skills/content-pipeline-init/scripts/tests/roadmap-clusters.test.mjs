#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  nextPlanSkill,
  resolveInitManifestStatus,
} from "../lib/init-status.mjs";
import {
  extractClustersFromMarkdown,
  planArtifactsReady,
  resolveSiteswarmTaxonomy,
  siteswarmTaxonomyExists,
} from "../lib/roadmap-clusters.mjs";

function test(name, fn) {
  try {
    fn();
    console.log(`ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

const SAMPLE = `| Week | Post | Cluster | Working Title | Trigger Word | PAA/QFO Linkage | Target Persona | User Intent |
|------|------|---------|---------------|--------------|-----------------|----------------|-------------|
| 1 | 1 | Lessons and teachers | Find a teacher | lessons | q1 | Parent | Informational |
| 1 | 2 | Beginners and parents | First lesson | beginner | q2 | Parent | Informational |
| 2 | 3 | Lessons and teachers | Recital prep | recital | q3 | Student | Commercial |
| 2 | 4 | Hours, financing, and shipping | Shop hours | hours | q4 | Shopper | Navigational |
`;

test("extracts unique clusters with counts", () => {
  const { header, clusters, error } = extractClustersFromMarkdown(SAMPLE);
  assert.equal(error, undefined);
  assert.equal(header[2], "Cluster");
  assert.deepEqual(
    clusters.map((c) => c.name),
    [
      "Beginners and parents",
      "Hours, financing, and shipping",
      "Lessons and teachers",
    ],
  );
  assert.equal(clusters.find((c) => c.name === "Lessons and teachers").count, 2);
});

test("errors when Cluster column is missing", () => {
  const { error, clusters } = extractClustersFromMarkdown(
    "| Week | Post |\n|---|---|\n| 1 | 1 |\n",
  );
  assert.equal(error, "no Cluster column");
  assert.equal(clusters.length, 0);
});

test("taxonomy resolve prefers 02-plan then 04-publish", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tax-"));
  const pipe = path.join(root, "06-content-pipeline");
  const planDir = path.join(pipe, "02-plan");
  const pubDir = path.join(pipe, "04-publish");
  fs.mkdirSync(planDir, { recursive: true });
  fs.mkdirSync(pubDir, { recursive: true });

  assert.equal(siteswarmTaxonomyExists(pipe), false);
  assert.equal(planArtifactsReady(pipe), false);
  assert.equal(
    resolveSiteswarmTaxonomy(pipe),
    path.join(planDir, "siteswarm-tag-taxonomy.md"),
  );

  fs.writeFileSync(path.join(pubDir, "siteswarm-tag-taxonomy.md"), "pub");
  assert.equal(siteswarmTaxonomyExists(pipe), true);
  assert.equal(
    resolveSiteswarmTaxonomy(pipe),
    path.join(pubDir, "siteswarm-tag-taxonomy.md"),
  );

  fs.writeFileSync(path.join(planDir, "siteswarm-tag-taxonomy.md"), "plan");
  fs.writeFileSync(path.join(planDir, "editorial-roadmap.md"), SAMPLE);
  assert.equal(
    resolveSiteswarmTaxonomy(pipe),
    path.join(planDir, "siteswarm-tag-taxonomy.md"),
  );
  assert.equal(planArtifactsReady(pipe), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test("8/8 without plan cannot be init_complete", () => {
  const emptyPlan = {
    roadmap_exists: false,
    taxonomy_exists: false,
    ready: false,
  };
  assert.equal(
    resolveInitManifestStatus({
      resourcesReady: true,
      plan: emptyPlan,
      existingHorizon: null,
    }),
    "awaiting_horizon",
  );
  assert.equal(
    resolveInitManifestStatus({
      resourcesReady: true,
      plan: emptyPlan,
      existingHorizon: 13,
    }),
    "awaiting_plan",
  );
  assert.equal(
    resolveInitManifestStatus({
      resourcesReady: true,
      plan: { roadmap_exists: true, taxonomy_exists: false, ready: false },
    }),
    "awaiting_taxonomy",
  );
  assert.equal(
    resolveInitManifestStatus({
      resourcesReady: true,
      plan: { roadmap_exists: true, taxonomy_exists: true, ready: true },
    }),
    "init_complete",
  );
  assert.equal(
    resolveInitManifestStatus({
      resourcesReady: false,
      plan: { roadmap_exists: true, taxonomy_exists: true, ready: true },
    }),
    "init_partial",
  );
  assert.equal(nextPlanSkill("awaiting_horizon"), "editorial-roadmap-taxonomy");
  assert.equal(nextPlanSkill("awaiting_plan"), "editorial-roadmap-taxonomy");
  assert.equal(nextPlanSkill("awaiting_taxonomy"), "editorial-roadmap-taxonomy");
  assert.equal(nextPlanSkill("init_complete"), null);
});
