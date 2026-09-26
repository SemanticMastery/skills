#!/usr/bin/env node
/**
 * Update content-pipeline-run-manifest.json without hand-editing.
 *
 * Usage:
 *   node advance-run.mjs --campaign-dir "..." --init [--gate-mode review|auto] [--copywriting-model inherit|<id>] [--copywriting-via session|external] [--copywriting-host zed]
 *   node advance-run.mjs --campaign-dir "..." --set-gate-mode review|auto
 *   node advance-run.mjs --campaign-dir "..." --set-horizon 13|26
 *   node advance-run.mjs --campaign-dir "..." --set-siteswarm-taxonomy "..."
 *   node advance-run.mjs --campaign-dir "..." --mark-complete plan --artifact "..."
 *   node advance-run.mjs --campaign-dir "..." --await-approval draft --artifact "..."
 *   node advance-run.mjs --campaign-dir "..." --approve-stage draft
 *   node advance-run.mjs --campaign-dir "..." --set-slot --post 1 --week 1 --title "..." --trigger "..."
 *   node advance-run.mjs --campaign-dir "..." --clear-slot
 *   node advance-run.mjs --campaign-dir "..." --produce-complete
 *   node advance-run.mjs --campaign-dir "..." --set-status blocked --note "..."
 *   node advance-run.mjs --campaign-dir "..." --set-next-action "run:brief"
 *
 * Prints updated manifest JSON to stdout.
 */

import fs from "node:fs";
import path from "node:path";
import { resolveArtifact } from "./lib/artifacts.mjs";
import { planArtifactsReady } from "./lib/plan-artifacts.mjs";
import { attachStoryBank } from "./lib/story-bank.mjs";

const STAGE_ORDER = ["plan", "brief", "draft", "edit", "polish", "images"];

const NEXT_AFTER = {
  plan: "select_slot",
  brief: "run:draft",
  draft: "run:edit",
  edit: "run:polish",
  polish: "run:images",
  images: "done:slot",
};

function parseArgs(argv) {
  const out = {
    campaignDir: null,
    pipelineDir: null,
    init: false,
    gateMode: null,
    setGateMode: null,
    copywritingModel: null,
    copywritingModelProvided: false,
    setCopywritingModel: null,
    setCopywritingModelProvided: false,
    copywritingVia: null,
    copywritingViaProvided: false,
    setCopywritingVia: null,
    setCopywritingViaProvided: false,
    copywritingHost: null,
    copywritingHostProvided: false,
    setCopywritingHost: null,
    setCopywritingHostProvided: false,
    awaitExternal: null,
    setHorizon: null,
    setSiteswarmTaxonomy: null,
    markComplete: null,
    awaitApproval: null,
    approveStage: null,
    artifact: null,
    setSlot: false,
    clearSlot: false,
    post: null,
    week: null,
    title: null,
    trigger: null,
    cluster: null,
    persona: null,
    produceComplete: false,
    ingestExternalWrite: false,
    setStatus: null,
    setNextAction: null,
    note: null,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--campaign-dir") out.campaignDir = argv[++i];
    else if (a === "--pipeline-dir") out.pipelineDir = argv[++i];
    else if (a === "--init") out.init = true;
    else if (a === "--gate-mode") out.gateMode = argv[++i];
    else if (a === "--set-gate-mode") out.setGateMode = argv[++i];
    else if (a === "--copywriting-model") {
      out.copywritingModel = argv[++i];
      out.copywritingModelProvided = true;
    } else if (a === "--set-copywriting-model") {
      out.setCopywritingModel = argv[++i];
      out.setCopywritingModelProvided = true;
    } else if (a === "--copywriting-via") {
      out.copywritingVia = argv[++i];
      out.copywritingViaProvided = true;
    } else if (a === "--set-copywriting-via") {
      out.setCopywritingVia = argv[++i];
      out.setCopywritingViaProvided = true;
    } else if (a === "--copywriting-host") {
      out.copywritingHost = argv[++i];
      out.copywritingHostProvided = true;
    } else if (a === "--set-copywriting-host") {
      out.setCopywritingHost = argv[++i];
      out.setCopywritingHostProvided = true;
    } else if (a === "--await-external") {
      out.awaitExternal = argv[++i];
    }
    else if (a === "--set-horizon") out.setHorizon = Number(argv[++i]);
    else if (a === "--set-siteswarm-taxonomy") out.setSiteswarmTaxonomy = argv[++i];
    else if (a === "--mark-complete") out.markComplete = argv[++i];
    else if (a === "--await-approval") out.awaitApproval = argv[++i];
    else if (a === "--approve-stage") out.approveStage = argv[++i];
    else if (a === "--artifact") out.artifact = argv[++i];
    else if (a === "--set-slot") out.setSlot = true;
    else if (a === "--clear-slot") out.clearSlot = true;
    else if (a === "--post") out.post = Number(argv[++i]);
    else if (a === "--week") out.week = Number(argv[++i]);
    else if (a === "--title") out.title = argv[++i];
    else if (a === "--trigger") out.trigger = argv[++i];
    else if (a === "--cluster") out.cluster = argv[++i];
    else if (a === "--persona") out.persona = argv[++i];
    else if (a === "--produce-complete") out.produceComplete = true;
    else if (a === "--ingest-external-write") out.ingestExternalWrite = true;
    else if (a === "--set-status") out.setStatus = argv[++i];
    else if (a === "--set-next-action") out.setNextAction = argv[++i];
    else if (a === "--note") out.note = argv[++i];
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

function nowIso() {
  return new Date().toISOString();
}

function defaultArtifact(pipelineDir, stageKey, post) {
  return resolveArtifact(pipelineDir, stageKey, post);
}

function nextAfterPlan(pipelineDir) {
  return planArtifactsReady(pipelineDir)
    ? "select_slot"
    : "blocked:need_init_plan";
}

function emptyStages() {
  const stages = {};
  for (const k of STAGE_ORDER) {
    stages[k] = { status: "pending", artifact: null, updated_at: null };
  }
  return stages;
}

const ANTHROPIC_COPYWRITING_RE = /anthropic|claude|sonnet|opus|haiku/i;

const COPYWRITING_ANTHROPIC_ERROR =
  "copywriting_model cannot be an Anthropic/Claude model (watermarking). Use inherit on Grok 4.6 or ChatGPT-5.6 Terra, pin cursor-grok-4.6-high-fast or gpt-5.6-terra-medium, or route external/local.";

function isProhibitedAnthropicCopywritingModel(value) {
  const s = value == null ? "" : String(value).trim();
  if (!s || s.toLowerCase() === "inherit") return false;
  return ANTHROPIC_COPYWRITING_RE.test(s);
}

function normalizeCopywritingModel(value) {
  const trimmed = value == null ? "" : String(value).trim();
  if (!trimmed) {
    throw new Error("copywriting_model must be inherit or a non-empty model id");
  }
  if (trimmed.toLowerCase() === "inherit") return "inherit";
  if (isProhibitedAnthropicCopywritingModel(trimmed)) {
    throw new Error(COPYWRITING_ANTHROPIC_ERROR);
  }
  return trimmed;
}

const EXTERNAL_COPY_STAGES = ["brief", "draft", "edit", "polish"];

function normalizeCopywritingVia(value) {
  const trimmed = value == null ? "" : String(value).trim().toLowerCase();
  if (trimmed !== "session" && trimmed !== "external") {
    throw new Error("copywriting_via must be session|external");
  }
  return trimmed;
}

function normalizeCopywritingHost(value) {
  const trimmed = value == null ? "" : String(value).trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "zed") return "zed";
  return trimmed;
}

function isExternalVia(manifest) {
  return manifest.copywriting_via === "external";
}

function nextProduceAction(manifest, stageKey) {
  const next = NEXT_AFTER[stageKey];
  if (isExternalVia(manifest) && next?.startsWith("run:")) {
    const k = next.slice(4);
    if (EXTERNAL_COPY_STAGES.includes(k)) return "await_external:write";
  }
  return next;
}

function createManifest(campaignDir, pipelineDir, gateMode, copywritingModel) {
  return {
    schema_version: 1,
    skill: "content-pipeline-run",
    campaign_dir: campaignDir,
    pipeline_dir: pipelineDir,
    status: "in_progress",
    gate_mode: gateMode || null,
    copywriting_model: copywritingModel || null,
    copywriting_via: "session",
    copywriting_host: null,
    updated_at: nowIso(),
    plan: {
      horizon_weeks: null,
      artifact: null,
      siteswarm_taxonomy: null,
      status: "pending",
      approved: false,
    },
    active_slot: null,
    stages: emptyStages(),
    next_action: gateMode ? "check_ready" : "check_ready",
    errors: [],
    notes: [],
  };
}

function loadOrCreate(manifestPath, campaignDir, pipelineDir, gateMode, copywritingModel, forceInit) {
  if (fs.existsSync(manifestPath) && !forceInit) {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  }
  return createManifest(campaignDir, pipelineDir, gateMode, copywritingModel);
}

function ensureStage(manifest, key) {
  if (!manifest.stages) manifest.stages = emptyStages();
  if (!manifest.stages[key]) {
    manifest.stages[key] = { status: "pending", artifact: null, updated_at: null };
  }
  return manifest.stages[key];
}

function resetProduceStages(manifest) {
  for (const k of ["brief", "draft", "edit", "polish", "images"]) {
    manifest.stages[k] = { status: "pending", artifact: null, updated_at: null };
  }
}

function validateGateMode(mode) {
  if (mode !== "review" && mode !== "auto") {
    throw new Error(`gate_mode must be review|auto, got: ${mode}`);
  }
}

function validateStage(key) {
  if (!STAGE_ORDER.includes(key)) {
    throw new Error(`unknown stage: ${key}; expected ${STAGE_ORDER.join("|")}`);
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.campaignDir && !args.pipelineDir)) {
    console.error(`Usage: node advance-run.mjs --campaign-dir <path> [actions]

Actions:
  --init [--gate-mode review|auto] [--copywriting-model inherit|<id>] [--copywriting-via session|external] [--copywriting-host zed]
  --set-gate-mode review|auto
  --set-copywriting-model inherit|<id>
  --set-copywriting-via session|external
  --set-copywriting-host zed
  --await-external write
  --ingest-external-write
  --set-horizon 13|26
  --mark-complete <stage> [--artifact path]
  --await-approval <stage> [--artifact path]
  --approve-stage <stage>
  --set-slot --post N --week N --title "..." --trigger "..." [--cluster ...] [--persona ...]
  --clear-slot
  --produce-complete
  --set-status <status> [--note "..."]
  --set-next-action <action>
`);
    process.exit(args.help ? 0 : 1);
  }

  const { campaignDir, pipelineDir } = resolveDirs(args);
  const manifestPath = path.join(
    pipelineDir,
    "content-pipeline-run-manifest.json",
  );

  let manifest;
  try {
    manifest = loadOrCreate(
      manifestPath,
      campaignDir,
      pipelineDir,
      args.gateMode || args.setGateMode,
      args.copywritingModel || args.setCopywritingModel,
      args.init,
    );
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: e.message }));
    process.exit(1);
  }

  manifest.campaign_dir = campaignDir;
  manifest.pipeline_dir = pipelineDir;
  manifest.skill = "content-pipeline-run";
  manifest.schema_version = 1;

  try {
    if (args.init && args.gateMode) {
      validateGateMode(args.gateMode);
      manifest.gate_mode = args.gateMode;
    }

    if (args.init && args.copywritingModelProvided) {
      manifest.copywriting_model = normalizeCopywritingModel(args.copywritingModel);
    }

    if (args.setGateMode) {
      validateGateMode(args.setGateMode);
      manifest.gate_mode = args.setGateMode;
      if (args.note) manifest.notes.push(args.note);
    }

    if (args.setCopywritingModelProvided) {
      manifest.copywriting_model = normalizeCopywritingModel(args.setCopywritingModel);
    }

    if (args.init && args.copywritingViaProvided) {
      manifest.copywriting_via = normalizeCopywritingVia(args.copywritingVia);
    }
    if (args.setCopywritingViaProvided) {
      manifest.copywriting_via = normalizeCopywritingVia(args.setCopywritingVia);
    }
    if (args.init && args.copywritingHostProvided) {
      manifest.copywriting_host = normalizeCopywritingHost(args.copywritingHost);
    }
    if (args.setCopywritingHostProvided) {
      manifest.copywriting_host = normalizeCopywritingHost(args.setCopywritingHost);
    }
    const hostJustSet =
      (args.init && args.copywritingHostProvided) ||
      args.setCopywritingHostProvided;
    const viaWasSet =
      (args.init && args.copywritingViaProvided) ||
      args.setCopywritingViaProvided;
    if (hostJustSet && manifest.copywriting_host && !viaWasSet) {
      manifest.copywriting_via = "external";
    }

    if (args.awaitExternal) {
      const token = String(args.awaitExternal).trim().toLowerCase();
      if (token !== "write" && !EXTERNAL_COPY_STAGES.includes(token)) {
        throw new Error("--await-external must be write (or brief|draft|edit|polish alias)");
      }
      const brief = ensureStage(manifest, "brief");
      if (brief.status === "pending") brief.status = "in_progress";
      brief.updated_at = nowIso();
      manifest.status = "in_progress";
      manifest.next_action = "await_external:write";
      manifest.copywriting_via = "external";
    }

    if (args.ingestExternalWrite) {
      const post = manifest.active_slot?.post;
      if (!post) {
        throw new Error("--ingest-external-write requires an active slot");
      }
      const missing = [];
      for (const key of EXTERNAL_COPY_STAGES) {
        const artifact = defaultArtifact(pipelineDir, key, post);
        if (!artifact || !fs.existsSync(artifact)) {
          missing.push(key);
          continue;
        }
        const st = ensureStage(manifest, key);
        st.artifact = artifact;
        st.updated_at = nowIso();
        st.status = "complete";
      }
      if (missing.length) {
        throw new Error(
          `external write incomplete; missing: ${missing.join(",")}`,
        );
      }
      manifest.copywriting_via = "external";
      if (manifest.gate_mode === "review") {
        const st = ensureStage(manifest, "polish");
        st.status = "awaiting_approval";
        manifest.status = "awaiting_approval";
        manifest.next_action = "await_approval:polish";
      } else {
        manifest.status = "in_progress";
        manifest.next_action = "run:images";
      }
    }

    if (args.setHorizon != null) {
      if (args.setHorizon !== 13 && args.setHorizon !== 26) {
        throw new Error("horizon must be 13 or 26");
      }
      if (!manifest.plan) {
        manifest.plan = {
          horizon_weeks: null,
          artifact: null,
          status: "pending",
          approved: false,
        };
      }
      manifest.plan.horizon_weeks = args.setHorizon;
      if (planArtifactsReady(pipelineDir)) {
        manifest.status = "awaiting_slot";
        manifest.next_action = "select_slot";
      } else {
        manifest.status = "blocked";
        manifest.next_action = "blocked:need_init_plan";
      }
    }

    if (args.markComplete) {
      validateStage(args.markComplete);
      const st = ensureStage(manifest, args.markComplete);
      const artifact =
        args.artifact ||
        defaultArtifact(
          pipelineDir,
          args.markComplete,
          manifest.active_slot?.post,
        );
      st.status = "complete";
      st.artifact = artifact;
      st.updated_at = nowIso();
      if (args.markComplete === "plan") {
        manifest.plan = manifest.plan || {};
        manifest.plan.artifact = artifact;
        manifest.plan.status = "complete";
        manifest.plan.approved = true;
        manifest.next_action = nextAfterPlan(pipelineDir);
        if (manifest.next_action === "select_slot") {
          manifest.status = "awaiting_slot";
        }
      } else {
        manifest.next_action = nextProduceAction(manifest, args.markComplete);
        if (args.markComplete === "images") {
          manifest.status = "produce_complete";
          if (manifest.active_slot) {
            manifest.active_slot.status = "produce_complete";
          }
          manifest.next_action = "done:slot";
        }
      }
      if (args.markComplete === "images") {
        manifest.status = "produce_complete";
      } else if (
        args.markComplete === "plan" &&
        manifest.next_action === "select_slot"
      ) {
        manifest.status = "awaiting_slot";
      } else {
        manifest.status = "in_progress";
      }
    }

    if (args.awaitApproval) {
      validateStage(args.awaitApproval);
      const st = ensureStage(manifest, args.awaitApproval);
      const artifact =
        args.artifact ||
        defaultArtifact(
          pipelineDir,
          args.awaitApproval,
          manifest.active_slot?.post,
        );
      st.status = "awaiting_approval";
      st.artifact = artifact;
      st.updated_at = nowIso();
      if (args.awaitApproval === "plan") {
        manifest.plan = manifest.plan || {};
        manifest.plan.artifact = artifact;
        manifest.plan.status = "awaiting_approval";
        manifest.plan.approved = false;
      }
      manifest.status = "awaiting_approval";
      manifest.next_action = `await_approval:${args.awaitApproval}`;
    }

    if (args.approveStage) {
      validateStage(args.approveStage);
      const st = ensureStage(manifest, args.approveStage);
      if (st.status !== "awaiting_approval" && st.status !== "complete") {
        // allow approve from awaiting_approval or force-complete
      }
      st.status = "complete";
      st.updated_at = nowIso();
      if (!st.artifact) {
        st.artifact = defaultArtifact(
          pipelineDir,
          args.approveStage,
          manifest.active_slot?.post,
        );
      }
      if (args.approveStage === "plan") {
        manifest.plan = manifest.plan || {};
        manifest.plan.status = "complete";
        manifest.plan.approved = true;
        if (st.artifact) manifest.plan.artifact = st.artifact;
        manifest.next_action = nextAfterPlan(pipelineDir);
        manifest.status =
          manifest.next_action === "select_slot"
            ? "awaiting_slot"
            : "in_progress";
      } else {
        manifest.next_action = nextProduceAction(manifest, args.approveStage);
        manifest.status = "in_progress";
        if (args.approveStage === "images") {
          manifest.status = "produce_complete";
          manifest.next_action = "done:slot";
          if (manifest.active_slot) {
            manifest.active_slot.status = "produce_complete";
          }
        }
      }
    }

    if (args.setSlot) {
      if (!args.post || !Number.isFinite(args.post)) {
        throw new Error("--set-slot requires --post <n>");
      }
      manifest.active_slot = {
        post: Math.trunc(args.post),
        week: args.week != null ? Math.trunc(args.week) : null,
        working_title: args.title ?? null,
        trigger_word: args.trigger ?? null,
        cluster: args.cluster ?? null,
        target_persona: args.persona ?? null,
        status: "selected",
      };
      resetProduceStages(manifest);
      manifest.status = "in_progress";
      manifest.next_action = isExternalVia(manifest)
        ? "await_external:write"
        : "run:brief";
      // ensure plan marked usable if roadmap exists
      const planPath = defaultArtifact(pipelineDir, "plan");
      if (fs.existsSync(planPath)) {
        const pst = ensureStage(manifest, "plan");
        if (pst.status === "pending") {
          pst.status = "complete";
          pst.artifact = planPath;
          pst.updated_at = nowIso();
        }
        manifest.plan = manifest.plan || {};
        if (!manifest.plan.artifact) manifest.plan.artifact = planPath;
        if (manifest.plan.status !== "complete") {
          manifest.plan.status = "complete";
          manifest.plan.approved = true;
        }
      }
    }

    if (args.clearSlot) {
      manifest.active_slot = null;
      resetProduceStages(manifest);
      manifest.status = "awaiting_slot";
      manifest.next_action = "select_slot";
    }

    if (args.produceComplete) {
      const st = ensureStage(manifest, "images");
      st.status = "complete";
      st.updated_at = nowIso();
      if (!st.artifact) {
        st.artifact = defaultArtifact(
          pipelineDir,
          "images",
          manifest.active_slot?.post,
        );
      }
      manifest.status = "produce_complete";
      manifest.next_action = "done:slot";
      if (manifest.active_slot) {
        manifest.active_slot.status = "produce_complete";
      }
    }

    if (args.setSiteswarmTaxonomy) {
      const taxPath = path.resolve(args.setSiteswarmTaxonomy);
      manifest.plan = manifest.plan || {};
      manifest.plan.siteswarm_taxonomy = taxPath;
      if (!manifest.active_slot?.post) {
        const awaitingPlan =
          manifest.plan.status === "awaiting_approval" ||
          (manifest.gate_mode === "review" &&
            manifest.plan.approved !== true &&
            manifest.plan.status !== "complete");
        if (awaitingPlan) {
          manifest.next_action = "await_approval:plan";
          manifest.status = "awaiting_approval";
        } else {
          manifest.next_action = "select_slot";
          manifest.status = "awaiting_slot";
        }
      }
    }

    if (args.setStatus) {
      manifest.status = args.setStatus;
    }

    if (args.setNextAction) {
      manifest.next_action = args.setNextAction;
    }

    if (args.note) {
      if (!Array.isArray(manifest.notes)) manifest.notes = [];
      manifest.notes.push({ at: nowIso(), text: args.note });
    }

    // If only --init with no other mutation beyond create
    if (args.init && !manifest.gate_mode && args.gateMode) {
      manifest.gate_mode = args.gateMode;
    }
    if (args.init && !args.setHorizon && manifest.next_action === "check_ready") {
      // leave next_action as check_ready
    }
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: e.message }, null, 2));
    process.exit(1);
  }

  manifest.updated_at = nowIso();

  fs.mkdirSync(pipelineDir, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  const payload = { ok: true, manifest_path: manifestPath, manifest };
  if (args.setSlot) attachStoryBank(payload, campaignDir);
  console.log(JSON.stringify(payload, null, 2));
}

main();
