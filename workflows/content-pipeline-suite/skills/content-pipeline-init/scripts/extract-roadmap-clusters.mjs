#!/usr/bin/env node
/**
 * Print unique Cluster values from 02-plan/editorial-roadmap.md.
 *
 * Usage:
 *   node extract-roadmap-clusters.mjs --campaign-dir "..."
 *   node extract-roadmap-clusters.mjs --pipeline-dir "..."
 *   node extract-roadmap-clusters.mjs --file "/abs/path/editorial-roadmap.md"
 */
import fs from "node:fs";
import path from "node:path";
import {
  extractClustersFromMarkdown,
  resolveSiteswarmTaxonomy,
  siteswarmTaxonomyExists,
} from "./lib/roadmap-clusters.mjs";

function parseArgs(argv) {
  const out = { campaignDir: null, pipelineDir: null, file: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--campaign-dir") out.campaignDir = argv[++i];
    else if (a === "--pipeline-dir") out.pipelineDir = argv[++i];
    else if (a === "--file") out.file = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function resolveDirs(args) {
  let campaignDir = args.campaignDir ? path.resolve(args.campaignDir) : null;
  let pipelineDir = args.pipelineDir ? path.resolve(args.pipelineDir) : null;

  if (pipelineDir && !campaignDir) {
    if (path.basename(pipelineDir) === "06-content-pipeline") {
      campaignDir = path.dirname(pipelineDir);
    } else {
      campaignDir = pipelineDir;
      pipelineDir = path.join(campaignDir, "06-content-pipeline");
    }
  }
  if (campaignDir && !pipelineDir) {
    if (path.basename(campaignDir) === "06-content-pipeline") {
      pipelineDir = campaignDir;
      campaignDir = path.dirname(pipelineDir);
    } else {
      pipelineDir = path.join(campaignDir, "06-content-pipeline");
    }
  }
  return { campaignDir, pipelineDir };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.campaignDir && !args.pipelineDir && !args.file)) {
    console.error(
      "Usage: node extract-roadmap-clusters.mjs --campaign-dir <path> | --pipeline-dir <path> | --file <roadmap.md>",
    );
    process.exit(args.help ? 0 : 1);
  }

  const { campaignDir, pipelineDir } = resolveDirs(args);
  const roadmapPath = args.file
    ? path.resolve(args.file)
    : path.join(pipelineDir, "02-plan", "editorial-roadmap.md");

  if (!fs.existsSync(roadmapPath)) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          error: "editorial-roadmap.md not found",
          roadmap: roadmapPath,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const parsed = extractClustersFromMarkdown(fs.readFileSync(roadmapPath, "utf8"));
  const taxonomyExists = pipelineDir
    ? siteswarmTaxonomyExists(pipelineDir)
    : false;

  console.log(
    JSON.stringify(
      {
        ok: !parsed.error,
        error: parsed.error || null,
        campaign_dir: campaignDir,
        pipeline_dir: pipelineDir,
        roadmap: roadmapPath,
        header: parsed.header,
        cluster_count: parsed.clusters.length,
        clusters: parsed.clusters,
        siteswarm_taxonomy_exists: taxonomyExists,
        siteswarm_taxonomy: pipelineDir
          ? resolveSiteswarmTaxonomy(pipelineDir)
          : null,
      },
      null,
      2,
    ),
  );
  if (parsed.error) process.exit(1);
}

main();
