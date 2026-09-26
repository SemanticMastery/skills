#!/usr/bin/env node
/**
 * Update runs[slug] on pipeline-pages-manifest.json.
 *
 * Usage:
 *   node advance-page.mjs --campaign-dir "..." --init --slug tree-removal --gate-mode review --copywriting-model inherit
 *   node advance-page.mjs --campaign-dir "..." --slug tree-removal --mark-complete brief --artifact "..."
 *   node advance-page.mjs --campaign-dir "..." --slug tree-removal --approve-stage draft
 *   node advance-page.mjs --campaign-dir "..." --slug tree-removal --set-next-action run:edit
 *   node advance-page.mjs --campaign-dir "..." --slug emergency-service --set-terms-file terms.txt
 *   node advance-page.mjs --campaign-dir "..." --slug emergency-service --authorize-default-terms
 */

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_MIN_COUNT, extractTermCounts, highImpactTerms, parseTermList } from "./lib/matrix-terms.mjs";
import { artifactPath, checkReady, readManifest, resolveDirs, writeManifest } from "./lib/ready.mjs";

const STAGES = ["brief", "draft", "edit", "polish"];
const NEXT = {
  brief: "run:draft",
  draft: "run:edit",
  edit: "run:polish",
  polish: "done:page",
};

function parseArgs(argv) {
  const out = {
    campaignDir: null,
    slug: null,
    init: false,
    gateMode: null,
    copywritingModel: null,
    markComplete: null,
    artifact: null,
    approveStage: null,
    nextAction: null,
    setTermsFile: null,
    setTerms: [],
    authorizeDefaultTerms: false,
    minCount: DEFAULT_MIN_COUNT,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--campaign-dir") out.campaignDir = argv[++i];
    else if (a === "--slug") out.slug = argv[++i];
    else if (a === "--init") out.init = true;
    else if (a === "--gate-mode") out.gateMode = argv[++i];
    else if (a === "--copywriting-model") out.copywritingModel = argv[++i];
    else if (a === "--mark-complete") out.markComplete = argv[++i];
    else if (a === "--artifact") out.artifact = argv[++i];
    else if (a === "--approve-stage") out.approveStage = argv[++i];
    else if (a === "--set-next-action") out.nextAction = argv[++i];
    else if (a === "--set-terms-file") out.setTermsFile = argv[++i];
    else if (a === "--set-term") out.setTerms.push(argv[++i]);
    else if (a === "--authorize-default-terms") out.authorizeDefaultTerms = true;
    else if (a === "--min-count") out.minCount = Number(argv[++i]);
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function emptyStages() {
  const stages = {};
  for (const s of STAGES) stages[s] = { status: "pending", artifact: null };
  return stages;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.campaignDir || !args.slug) {
    console.log(
      JSON.stringify(
        {
          usage:
            'node advance-page.mjs --campaign-dir "<abs>" --slug "<slug>" [--init --gate-mode review --copywriting-model inherit] [--mark-complete brief --artifact p] [--approve-stage draft] [--set-next-action run:edit]',
        },
        null,
        2,
      ),
    );
    process.exit(args.help ? 0 : 1);
  }
  const ready = checkReady(args);
  if (!ready.ready) {
    console.error(JSON.stringify(ready));
    process.exit(1);
  }
  const { pipelineDir } = resolveDirs(args);
  const man = readManifest(pipelineDir);
  if (!man.runs) man.runs = {};
  if (args.init || !man.runs[args.slug]) {
    const priorGate = man.runs[args.slug]?.evidence_gate;
    man.runs[args.slug] = {
      gate_mode: args.gateMode || "review",
      copywriting_model: args.copywritingModel || "inherit",
      copywriting_via: "session",
      stages: emptyStages(),
      next_action: "awaiting_matrix_terms",
      status: "awaiting_matrix_terms",
      matrix_terms: null,
    };
    if (priorGate) man.runs[args.slug].evidence_gate = priorGate;
  }
  const run = man.runs[args.slug];
  if (args.gateMode) run.gate_mode = args.gateMode;
  if (args.copywritingModel) run.copywriting_model = args.copywritingModel;
  run.copywriting_via = "session";
  if (args.setTermsFile || args.setTerms.length) {
    const fromFile = args.setTermsFile
      ? parseTermList(fs.readFileSync(path.resolve(args.setTermsFile), "utf8"))
      : [];
    run.matrix_terms = {
      source: "operator",
      min_count: args.minCount,
      terms: [...fromFile, ...args.setTerms],
    };
    if (!run.stages.brief.artifact) run.next_action = "run:brief";
    if (run.status === "awaiting_matrix_terms" || run.status === "ready") {
      run.status = "ready";
    }
  }
  if (args.authorizeDefaultTerms) {
    const page = (man.setup.pages || []).find((p) => p.slug === args.slug);
    if (!page?.matrix_path || !fs.existsSync(page.matrix_path)) {
      console.error(JSON.stringify({ error: "matrix_xlsx_not_found" }));
      process.exit(1);
    }
    const high = highImpactTerms(extractTermCounts(page.matrix_path), args.minCount);
    run.matrix_terms = {
      source: "high_impact_default",
      min_count: args.minCount,
      terms: high.map((r) => r.term),
    };
    if (!run.stages.brief.artifact) run.next_action = "run:brief";
    if (run.status === "awaiting_matrix_terms" || run.status === "ready") {
      run.status = "ready";
    }
  }
  if (args.markComplete) {
    if (!STAGES.includes(args.markComplete)) {
      console.error(JSON.stringify({ error: "invalid_stage", stage: args.markComplete }));
      process.exit(1);
    }
    const dest = args.artifact || artifactPath(pipelineDir, args.markComplete, args.slug);
    const forbidden = ["03-write", "04-publish", "05-archives"];
    if (forbidden.some((f) => dest.replace(/\\/g, "/").includes(`/${f}/`))) {
      console.error(JSON.stringify({ error: "forbidden_path", dest }));
      process.exit(1);
    }
    if (args.markComplete === "brief" && (!run.matrix_terms || !run.matrix_terms.terms?.length)) {
      console.error(
        JSON.stringify({
          error: "matrix_terms_required",
          hint: "Ask for specific terms or --authorize-default-terms before writing the brief.",
        }),
      );
      process.exit(1);
    }
    if (
      args.markComplete === "brief" &&
      (!run.evidence_gate || run.evidence_gate.result === "block")
    ) {
      console.error(
        JSON.stringify({
          error: "evidence_threshold_required",
          hint: "Run pd-coverage.mjs (add --waive --waived-by when the operator waived) before marking the brief complete.",
        }),
      );
      process.exit(1);
    }
    run.stages[args.markComplete] = { status: "complete", artifact: dest };
    run.next_action = NEXT[args.markComplete];
    run.status = args.markComplete === "polish" ? "complete" : "in_progress";
  }
  if (args.approveStage && run.stages[args.approveStage]) {
    run.stages[args.approveStage].status = "approved";
  }
  if (args.nextAction) run.next_action = args.nextAction;
  writeManifest(pipelineDir, man);
  console.log(JSON.stringify({ slug: args.slug, run: man.runs[args.slug] }, null, 2));
}

main();
