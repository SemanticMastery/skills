#!/usr/bin/env node
/**
 * Validate that a campaign's content pipeline is ready for content-pipeline-run.
 *
 * Usage:
 *   node check-ready.mjs --campaign-dir "C:\\...\\Example-Campaign"
 *   node check-ready.mjs --pipeline-dir "C:\\...\\Example-Campaign\\06-content-pipeline"
 *
 * Exit 0 when ready; exit 1 when not. Prints JSON to stdout.
 */

import fs from "node:fs";
import path from "node:path";
import {
  editorialRoadmapExists,
  planArtifactsReady,
  planRoadmapPath,
  resolveSiteswarmTaxonomy,
  siteswarmTaxonomyExists,
} from "./lib/plan-artifacts.mjs";
import { attachStoryBank } from "./lib/story-bank.mjs";

const CLASS_DEFS = [
  {
    class_id: "matrix",
    test: (name) => /_matrix/i.test(name),
  },
  {
    class_id: "personas",
    test: (name) => /_personas/i.test(name),
  },
  {
    class_id: "paa",
    test: (name) => /^paa-/i.test(name),
  },
  {
    class_id: "fanout",
    test: (name) => /^fanout-queries-/i.test(name),
  },
  {
    class_id: "dossier",
    test: (name) => /dossier/i.test(name) && /\.md$/i.test(name),
  },
  {
    class_id: "onpage",
    test: (name) =>
      /^onpage-crawl-/i.test(name) || /^on-page/i.test(name),
  },
  {
    class_id: "icp",
    test: (name) => /icp/i.test(name),
  },
  {
    class_id: "product_doc",
    test: (name) =>
      /product-documentation/i.test(name) ||
      /^Product-Documentation\.md$/i.test(name),
  },
];

function parseArgs(argv) {
  const out = { campaignDir: null, pipelineDir: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--campaign-dir") out.campaignDir = argv[++i];
    else if (a === "--pipeline-dir") out.pipelineDir = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function resolveDirs(args) {
  let campaignDir = args.campaignDir ? path.resolve(args.campaignDir) : null;
  let pipelineDir = args.pipelineDir ? path.resolve(args.pipelineDir) : null;

  if (pipelineDir && !campaignDir) {
    const base = path.basename(pipelineDir);
    if (base === "06-content-pipeline") {
      campaignDir = path.dirname(pipelineDir);
    } else {
      campaignDir = pipelineDir;
      pipelineDir = path.join(campaignDir, "06-content-pipeline");
    }
  }
  if (campaignDir && !pipelineDir) {
    const base = path.basename(campaignDir);
    if (base === "06-content-pipeline") {
      pipelineDir = campaignDir;
      campaignDir = path.dirname(pipelineDir);
    } else {
      pipelineDir = path.join(campaignDir, "06-content-pipeline");
    }
  }
  return { campaignDir, pipelineDir };
}

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".git") continue;
      walkFiles(full, acc);
    } else if (ent.isFile()) {
      try {
        const st = fs.statSync(full);
        if (st.size > 0) acc.push(full);
      } catch {
        /* skip */
      }
    }
  }
  return acc;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.campaignDir && !args.pipelineDir)) {
    console.error(
      "Usage: node check-ready.mjs --campaign-dir <path> | --pipeline-dir <path>",
    );
    process.exit(args.help ? 0 : 1);
  }

  const { campaignDir, pipelineDir } = resolveDirs(args);
  const resourcesDir = path.join(pipelineDir, "01-resources");
  const initManifestPath = path.join(
    pipelineDir,
    "content-pipeline-init-manifest.json",
  );
  const aiIsmsPath = path.join(resourcesDir, "ai-isms.md");

  const gaps = [];
  const result = {
    ready: false,
    campaign_dir: campaignDir,
    pipeline_dir: pipelineDir,
    init_manifest: {
      path: initManifestPath,
      exists: false,
      status: null,
    },
    ai_isms_present: false,
    plan: {
      roadmap: null,
      roadmap_exists: false,
      siteswarm_taxonomy: null,
      taxonomy_exists: false,
      ready: false,
    },
    resources: {},
    gaps: gaps,
    hint: null,
  };

  if (!fs.existsSync(pipelineDir)) {
    gaps.push(`pipeline_dir missing: ${pipelineDir}`);
    result.hint = "Run content-pipeline-init to scaffold 06-content-pipeline/";
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  if (!fs.existsSync(resourcesDir)) {
    gaps.push(`01-resources missing: ${resourcesDir}`);
  }

  let initStatus = null;
  if (fs.existsSync(initManifestPath)) {
    result.init_manifest.exists = true;
    try {
      const init = JSON.parse(fs.readFileSync(initManifestPath, "utf8"));
      initStatus = init.status ?? null;
      result.init_manifest.status = initStatus;
    } catch (e) {
      gaps.push(`init manifest unreadable: ${e.message}`);
    }
  } else {
    gaps.push(`init manifest missing: ${initManifestPath}`);
  }

  if (initStatus !== "init_complete") {
    gaps.push(
      `init status is "${initStatus ?? "missing"}"; require init_complete`,
    );
  }

  result.ai_isms_present =
    fs.existsSync(aiIsmsPath) && fs.statSync(aiIsmsPath).size > 0;
  if (!result.ai_isms_present) {
    gaps.push("ai-isms.md missing or empty under 01-resources/");
  }

  const files = walkFiles(resourcesDir);
  for (const def of CLASS_DEFS) {
    const matches = files
      .filter((f) => def.test(path.basename(f)))
      .map((f) => ({
        path: f,
        bytes: fs.statSync(f).size,
      }));
    const present = matches.length > 0;
    result.resources[def.class_id] = {
      class_id: def.class_id,
      state: present ? "present" : "missing",
      matches,
    };
    if (!present) gaps.push(`resource class missing in 01-resources/: ${def.class_id}`);
  }

  result.plan.roadmap = planRoadmapPath(pipelineDir);
  result.plan.roadmap_exists = editorialRoadmapExists(pipelineDir);
  result.plan.siteswarm_taxonomy = resolveSiteswarmTaxonomy(pipelineDir);
  result.plan.taxonomy_exists = siteswarmTaxonomyExists(pipelineDir);
  result.plan.ready = planArtifactsReady(pipelineDir);
  if (!result.plan.roadmap_exists) {
    gaps.push("editorial-roadmap.md missing under 02-plan/");
  }
  if (!result.plan.taxonomy_exists) {
    gaps.push("siteswarm-tag-taxonomy.md missing (02-plan/ or existing 04-publish/)");
  }

  result.ready = gaps.length === 0;
  if (!result.ready) {
    result.hint =
      "Run content-pipeline-init until status is init_complete, resources are in 01-resources/, and 02-plan has the editorial roadmap plus SiteSwarm tag taxonomy";
  }

  attachStoryBank(result, campaignDir);

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ready ? 0 : 1);
}

main();
