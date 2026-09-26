#!/usr/bin/env node
/**
 * Inventory content-pipeline required resources under a campaign folder.
 *
 * Usage:
 *   node inventory-resources.mjs --campaign-dir "C:\\...\\Ridgeline-Tree-Care"
 *   node inventory-resources.mjs --campaign-dir "..." --dest-only
 *   node inventory-resources.mjs --campaign-dir "..." --write-manifest
 *
 * Prints JSON summary to stdout.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveInitManifestStatus } from "./lib/init-status.mjs";
import {
  editorialRoadmapExists,
  planRoadmapPath,
  planArtifactsReady,
  resolveSiteswarmTaxonomy,
  siteswarmTaxonomyExists,
} from "./lib/roadmap-clusters.mjs";

export const CLASS_DEFS = [
  {
    class_id: "matrix",
    companion_skill: "contentmaxima",
    wave: 2,
    test: (name) => /_matrix/i.test(name),
  },
  {
    class_id: "personas",
    companion_skill: "contentmaxima",
    wave: 2,
    test: (name) => /_personas/i.test(name),
  },
  {
    class_id: "paa",
    companion_skill: "dataforseo-paa-queries",
    wave: 2,
    test: (name) => /^paa-/i.test(name),
  },
  {
    class_id: "fanout",
    companion_skill: "dataforseo-fanout-queries",
    wave: 2,
    test: (name) => /^fanout-queries-/i.test(name),
  },
  {
    class_id: "dossier",
    companion_skill: "business-dossier",
    wave: 1,
    test: (name) =>
      /dossier/i.test(name) && /\.(md|docx)$/i.test(name),
  },
  {
    class_id: "onpage",
    companion_skill: "dataforseo-onpage-crawl",
    wave: 2,
    test: (name) =>
      /^onpage-crawl-/i.test(name) || /^on-page/i.test(name),
  },
  {
    class_id: "icp",
    companion_skill: "customer-research",
    wave: 3,
    test: (name) => /icp/i.test(name),
  },
  {
    class_id: "product_doc",
    companion_skill: "product-documentation",
    wave: 3,
    test: (name) =>
      /product-documentation/i.test(name) ||
      /^Product-Documentation\.md$/i.test(name),
  },
];

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  "_tmp",
  ".cursor",
]);

function parseArgs(argv) {
  const out = {
    campaignDir: null,
    destOnly: false,
    writeManifest: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--campaign-dir") out.campaignDir = argv[++i];
    else if (a === "--dest-only") out.destOnly = true;
    else if (a === "--write-manifest") out.writeManifest = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
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
    if (ent.name.startsWith(".") && ent.name !== ".cursor") {
      // skip hidden except we already skip .cursor via SKIP
    }
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIR_NAMES.has(ent.name)) continue;
      walkFiles(full, acc);
    } else if (ent.isFile()) {
      acc.push(full);
    }
  }
  return acc;
}

function preferRoots(campaignDir, filePath) {
  const rel = path.relative(campaignDir, filePath).replace(/\\/g, "/");
  if (rel.startsWith("01-intake/1.1-docs/")) return 0;
  if (rel.startsWith("01-intake/1.2-audit/")) return 1;
  if (rel.startsWith("outputs/")) return 2;
  if (rel.startsWith("06-content-pipeline/")) return 9;
  return 5;
}

function inventory(campaignDir, { destOnly }) {
  const pipelineDir = path.join(campaignDir, "06-content-pipeline");
  const resourcesDir = path.join(pipelineDir, "01-resources");

  let roots;
  if (destOnly) {
    roots = [resourcesDir];
  } else {
    roots = [
      path.join(campaignDir, "01-intake"),
      path.join(campaignDir, "outputs"),
      campaignDir,
    ];
  }

  const files = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    if (root === campaignDir) {
      // Only top-level files at campaign root (avoid double-walking everything)
      for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
        if (ent.isFile()) files.push(path.join(root, ent.name));
      }
      continue;
    }
    walkFiles(root, files);
  }

  // Deduplicate
  const unique = [...new Set(files)];

  const resources = {};
  const gaps = [];

  for (const def of CLASS_DEFS) {
    let matches = unique
      .filter((f) => def.test(path.basename(f)))
      .filter((f) => {
        try {
          return fs.statSync(f).size > 0;
        } catch {
          return false;
        }
      });

    if (!destOnly) {
      // Prefer intake/outputs over anything under 06-content-pipeline for source inventory
      matches = matches.filter(
        (f) => !f.replace(/\\/g, "/").includes("/06-content-pipeline/")
      );
    }

    matches.sort((a, b) => {
      const pr = preferRoots(campaignDir, a) - preferRoots(campaignDir, b);
      if (pr !== 0) return pr;
      return a.localeCompare(b);
    });

    const mapped = matches.map((p) => {
      const st = fs.statSync(p);
      return {
        path: p,
        bytes: st.size,
        mtime: st.mtime.toISOString(),
      };
    });

    const state = mapped.length > 0 ? "present" : "missing";
    if (state === "missing") gaps.push(def.class_id);

    resources[def.class_id] = {
      class_id: def.class_id,
      state,
      matches: mapped,
      companion_skill: def.companion_skill,
      wave: def.wave,
      companion_status: state === "present" ? "not_needed" : "pending",
      artifacts: [],
      errors: [],
    };
  }

  const aiIsms = path.join(resourcesDir, "ai-isms.md");
  const aiIsmsPresent = fs.existsSync(aiIsms);
  const roadmapPath = planRoadmapPath(pipelineDir);
  const taxonomyPath = resolveSiteswarmTaxonomy(pipelineDir);
  const roadmapExists = editorialRoadmapExists(pipelineDir);
  const taxonomyExists = siteswarmTaxonomyExists(pipelineDir);
  const planReady = planArtifactsReady(pipelineDir);
  const resourcesReady = gaps.length === 0 && aiIsmsPresent;

  let status = "inventory_gaps";
  if (resourcesReady && planReady) status = "inventory_ok";
  else if (resourcesReady && roadmapExists && !taxonomyExists) {
    status = "awaiting_taxonomy";
  } else if (resourcesReady && !roadmapExists) {
    status = "awaiting_plan";
  }

  return {
    schema_version: 1,
    skill: "content-pipeline-init",
    campaign_dir: path.resolve(campaignDir),
    pipeline_dir: path.resolve(pipelineDir),
    template_source:
      process.env.CONTENT_PIPELINE_ICM_TEMPLATE || "(set CONTENT_PIPELINE_ICM_TEMPLATE)",
    status,
    updated_at: new Date().toISOString(),
    dest_only: Boolean(destOnly),
    scaffold: {
      status: fs.existsSync(pipelineDir) ? "present" : "missing",
      ai_isms_present: aiIsmsPresent,
    },
    resources,
    plan: {
      horizon_weeks: null,
      roadmap: roadmapPath,
      siteswarm_taxonomy: taxonomyPath,
      roadmap_exists: roadmapExists,
      taxonomy_exists: taxonomyExists,
      ready: planReady,
      status: planReady ? "complete" : "pending",
    },
    gaps,
    summary: {
      present: CLASS_DEFS.length - gaps.length,
      missing: gaps.length,
      total: CLASS_DEFS.length,
      plan_ready: planReady,
    },
  };
}

function mergeManifest(existingPath, inventoryResult) {
  let existing = {};
  if (fs.existsSync(existingPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(existingPath, "utf8"));
    } catch {
      existing = {};
    }
  }

  const resources = { ...inventoryResult.resources };
  for (const id of Object.keys(resources)) {
    const prev = existing.resources?.[id];
    if (prev) {
      resources[id] = {
        ...resources[id],
        companion_status:
          resources[id].state === "present"
            ? prev.companion_status && prev.companion_status !== "pending"
              ? prev.companion_status
              : "not_needed"
            : prev.companion_status || "pending",
        artifacts: prev.artifacts || [],
        errors: prev.errors || [],
      };
      if (resources[id].state === "present" && resources[id].companion_status === "pending") {
        resources[id].companion_status = "not_needed";
      }
    }
  }

  const resourcesReady =
    inventoryResult.gaps.length === 0 &&
    inventoryResult.scaffold.ai_isms_present;
  const existingHorizon = existing.plan?.horizon_weeks ?? null;

  let status;
  if (
    existing.status === "awaiting_keywords" ||
    existing.status === "awaiting_approval"
  ) {
    status = existing.status;
  } else {
    status = resolveInitManifestStatus({
      resourcesReady,
      plan: inventoryResult.plan,
      existingHorizon,
    });
  }

  return {
    ...existing,
    ...inventoryResult,
    inputs: existing.inputs || {
      keywords: [],
      paa_location: null,
      paid_compose_approved: false,
      crawl_approved: false,
    },
    resources,
    plan: {
      ...(existing.plan || {}),
      ...(inventoryResult.plan || {}),
      horizon_weeks: existingHorizon,
    },
    sync: existing.sync || { status: "pending", copied: [], skipped: [], errors: [] },
    cost_notes: existing.cost_notes || [],
    status,
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.campaignDir) {
    console.log(
      JSON.stringify(
        {
          usage:
            'node inventory-resources.mjs --campaign-dir "<abs>" [--dest-only] [--write-manifest]',
        },
        null,
        2
      )
    );
    process.exit(args.help ? 0 : 1);
  }

  const campaignDir = path.resolve(args.campaignDir);
  if (!fs.existsSync(campaignDir)) {
    console.error(JSON.stringify({ error: "campaign_dir_not_found", campaignDir }));
    process.exit(2);
  }

  const result = inventory(campaignDir, { destOnly: args.destOnly });

  if (args.writeManifest) {
    const pipelineDir = path.join(campaignDir, "06-content-pipeline");
    fs.mkdirSync(pipelineDir, { recursive: true });
    const manifestPath = path.join(
      pipelineDir,
      "content-pipeline-init-manifest.json"
    );
    const merged = mergeManifest(manifestPath, result);
    fs.writeFileSync(manifestPath, JSON.stringify(merged, null, 2), "utf8");
    result.manifest_path = manifestPath;
    result.manifest_written = true;
  }

  console.log(JSON.stringify(result, null, 2));
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
