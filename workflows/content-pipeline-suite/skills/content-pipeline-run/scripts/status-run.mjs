#!/usr/bin/env node
/**
 * Print content-pipeline-run status: next_action, stages, missing artifacts.
 *
 * Usage:
 *   node status-run.mjs --campaign-dir "C:\\...\\Example-Campaign"
 *   node status-run.mjs --pipeline-dir "C:\\...\\06-content-pipeline"
 *
 * Prints JSON to stdout. Exit 0 always unless args invalid.
 */

import fs from "node:fs";
import path from "node:path";
import { resolveArtifact } from "./lib/artifacts.mjs";
import {
  editorialRoadmapExists,
  planArtifactsReady,
  resolveSiteswarmTaxonomy,
  siteswarmTaxonomyExists,
} from "./lib/plan-artifacts.mjs";

const STAGE_ORDER = ["plan", "brief", "draft", "edit", "polish", "images"];

const ANTHROPIC_COPYWRITING_RE = /anthropic|claude|sonnet|opus|haiku/i;

function isProhibitedAnthropicCopywritingModel(value) {
  const s = value == null ? "" : String(value).trim();
  if (!s || s.toLowerCase() === "inherit") return false;
  return ANTHROPIC_COPYWRITING_RE.test(s);
}

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

function expectedArtifact(pipelineDir, stageKey, post) {
  return resolveArtifact(pipelineDir, stageKey, post);
}

function emptyStages() {
  const stages = {};
  for (const k of STAGE_ORDER) {
    stages[k] = { status: "pending", artifact: null, updated_at: null };
  }
  return stages;
}

function deriveNextAction(manifest, pipelineDir) {
  if (manifest.status === "blocked") {
    return manifest.next_action?.startsWith("blocked")
      ? manifest.next_action
      : "blocked:see_errors";
  }

  const planPath = expectedArtifact(pipelineDir, "plan");
  const planExists = editorialRoadmapExists(pipelineDir) || Boolean(planPath && fs.existsSync(planPath));

  if (!planArtifactsReady(pipelineDir)) {
    return "blocked:need_init_plan";
  }

  if (manifest.stages?.plan?.status === "awaiting_approval") {
    return "await_approval:plan";
  }

  if (
    manifest.gate_mode === "review" &&
    manifest.plan?.status === "complete" &&
    manifest.plan?.approved !== true &&
    planExists
  ) {
    return "await_approval:plan";
  }

  const slot = manifest.active_slot;
  if (!slot?.post) return "select_slot";

  const external = manifest.copywriting_via === "external";
  if (external) {
    for (const key of ["brief", "draft", "edit", "polish"]) {
      const st = manifest.stages?.[key];
      if (st?.status === "awaiting_approval") return `await_approval:${key}`;
      if (st?.status === "blocked" || st?.status === "failed") {
        return `blocked:${key}`;
      }
    }
    const polish = manifest.stages?.polish;
    if (!polish || polish.status !== "complete") {
      return "await_external:write";
    }
  }

  for (const key of ["brief", "draft", "edit", "polish", "images"]) {
    if (external && key !== "images") continue;
    const st = manifest.stages?.[key];
    if (!st || st.status === "pending") return `run:${key}`;
    if (st.status === "in_progress") return `run:${key}`;
    if (st.status === "awaiting_approval") return `await_approval:${key}`;
    if (st.status === "blocked") return `blocked:${key}`;
    if (st.status === "failed") return `blocked:${key}`;
  }

  return "done:slot";
}

function filesystemHints(pipelineDir, manifest) {
  const missing = [];
  const present = [];
  const post = manifest.active_slot?.post;

  const planPath = expectedArtifact(pipelineDir, "plan");
  if (planPath) {
    if (fs.existsSync(planPath)) present.push(planPath);
    else missing.push(planPath);
  }

  const taxPath = resolveSiteswarmTaxonomy(pipelineDir);
  if (siteswarmTaxonomyExists(pipelineDir)) present.push(taxPath);
  else missing.push(taxPath);

  if (post) {
    for (const key of ["brief", "draft", "edit", "polish", "images"]) {
      const p = expectedArtifact(pipelineDir, key, post);
      if (!p) continue;
      if (fs.existsSync(p)) present.push(p);
      else missing.push(p);
    }
  }

  const externalReady = [];
  if (manifest.copywriting_via === "external" && post) {
    for (const key of ["brief", "draft", "edit", "polish"]) {
      const st = manifest.stages?.[key];
      const p = expectedArtifact(pipelineDir, key, post);
      if (
        p &&
        fs.existsSync(p) &&
        (!st || st.status === "pending" || st.status === "in_progress")
      ) {
        externalReady.push({ stage: key, artifact: p });
      }
    }
  }

  return {
    present_artifacts: present,
    missing_artifacts: missing,
    external_ready: externalReady,
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.campaignDir && !args.pipelineDir)) {
    console.error(
      "Usage: node status-run.mjs --campaign-dir <path> | --pipeline-dir <path>",
    );
    process.exit(args.help ? 0 : 1);
  }

  const { campaignDir, pipelineDir } = resolveDirs(args);
  const manifestPath = path.join(
    pipelineDir,
    "content-pipeline-run-manifest.json",
  );

  let manifest = null;
  let manifestExists = false;
  if (fs.existsSync(manifestPath)) {
    manifestExists = true;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (e) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            error: `manifest unreadable: ${e.message}`,
            manifest_path: manifestPath,
          },
          null,
          2,
        ),
      );
      process.exit(1);
    }
  } else {
    manifest = {
      schema_version: 1,
      skill: "content-pipeline-run",
      campaign_dir: campaignDir,
      pipeline_dir: pipelineDir,
      status: "in_progress",
      gate_mode: null,
      copywriting_model: null,
      copywriting_via: null,
      copywriting_host: null,
      plan: {
        horizon_weeks: null,
        artifact: null,
        status: "pending",
        approved: false,
      },
      active_slot: null,
      stages: emptyStages(),
      next_action: "check_ready",
      errors: [],
      notes: ["manifest not created yet"],
    };
  }

  const derived = deriveNextAction(manifest, pipelineDir);
  const hints = filesystemHints(pipelineDir, manifest);

  const out = {
    ok: true,
    manifest_exists: manifestExists,
    manifest_path: manifestPath,
    campaign_dir: campaignDir,
    pipeline_dir: pipelineDir,
    status: manifest.status,
    gate_mode: manifest.gate_mode ?? null,
    copywriting_model: manifest.copywriting_model ?? null,
    copywriting_via: manifest.copywriting_via ?? null,
    copywriting_host: manifest.copywriting_host ?? null,
    copywriting_model_prohibited: isProhibitedAnthropicCopywritingModel(
      manifest.copywriting_model,
    ),
    copywriting_model_warning: isProhibitedAnthropicCopywritingModel(
      manifest.copywriting_model,
    )
      ? "Anthropic/Claude is prohibited for copy stages. Switch this chat to Grok 4.6 or ChatGPT-5.6 Terra, or pin cursor-grok-4.6-high-fast / gpt-5.6-terra-medium."
      : null,
    plan: manifest.plan ?? null,
    active_slot: manifest.active_slot ?? null,
    stages: manifest.stages ?? emptyStages(),
    next_action: manifest.next_action || derived,
    derived_next_action: derived,
    ...hints,
    errors: manifest.errors ?? [],
    updated_at: manifest.updated_at ?? null,
  };

  console.log(JSON.stringify(out, null, 2));
}

main();
