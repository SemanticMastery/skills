#!/usr/bin/env node
/**
 * Mutate pipeline-pages-manifest.json and project service-pages.md.
 *
 * Usage:
 *   node pages-manifest.mjs --campaign-dir "..." --decide retired-service skip
 *   node pages-manifest.mjs --campaign-dir "..." --approve-list
 *   node pages-manifest.mjs --campaign-dir "..." --apply-seeds
 *   node pages-manifest.mjs --campaign-dir "..." --set-seed tree-removal "tree removal service"
 *   node pages-manifest.mjs --campaign-dir "..." --record-matrix tree-removal --matrix-path "..." --matrix-status recorded
 *   node pages-manifest.mjs --campaign-dir "..." --setup-complete
 *   node pages-manifest.mjs --campaign-dir "..." --next-matrix
 *   node pages-manifest.mjs --campaign-dir "..." --write-projection
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib/args.mjs";
import { pagesDir, readManifest, requireCampaign, resolveDirs, writeManifest } from "./lib/paths.mjs";
import { commercialSeed } from "./lib/seed.mjs";

const DECISIONS = new Set(["include", "skip", "defer", "pending"]);

function pageBySlug(manifest, slug) {
  return (manifest.setup.pages || []).find((p) => p.slug === slug);
}

function approvedPages(manifest) {
  return (manifest.setup.pages || []).filter((p) => {
    if (p.source === "both" && (p.decision === "include" || p.decision === "pending" && manifest.setup.status !== "awaiting_reconcile")) {
      return p.decision !== "skip" && p.decision !== "defer";
    }
    return p.decision === "include";
  });
}

function existingMatrix(pipelineDir, slug) {
  const dir = path.join(pagesDir(pipelineDir), "matrix", slug);
  if (!fs.existsSync(dir)) return null;
  const hit = fs.readdirSync(dir).find((n) => /_matrix/i.test(n));
  return hit ? path.join(dir, hit) : null;
}

export function writeProjection(pipelineDir, manifest) {
  const dest = path.join(pagesDir(pipelineDir), "service-pages.md");
  const pages = manifest.setup.pages || [];
  const lines = [
    "# Service pages",
    "",
    `Setup status: \`${manifest.setup.status}\``,
    "",
    "## Approved / proposed",
    "",
    "| Slug | Source | Decision | Offering | Seed | Matrix |",
    "|------|--------|----------|----------|------|--------|",
  ];
  for (const p of pages) {
    lines.push(
      `| ${p.slug} | ${p.source} | ${p.decision} | ${p.offering || ""} | ${p.seed || ""} | ${p.matrix_status || ""} |`,
    );
  }
  lines.push("", "## Leftovers", "");
  const leftovers = pages.filter((p) => p.source !== "both");
  if (!leftovers.length) lines.push("_None._");
  else {
    for (const p of leftovers) {
      lines.push(`- \`${p.slug}\` (${p.source}) — ${p.decision}${p.offering ? ` — ${p.offering}` : ""}`);
    }
  }
  lines.push("");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, lines.join("\n"), "utf8");
  return dest;
}

export function applyManifestAction(manifest, pipelineDir, args) {
  if (args.decideSlug) {
    const page = pageBySlug(manifest, args.decideSlug);
    if (!page) return { error: "page_not_found", slug: args.decideSlug };
    if (!DECISIONS.has(args.decideValue)) {
      return { error: "invalid_decision", value: args.decideValue };
    }
    page.decision = args.decideValue;
  }
  if (args.approveList) {
    for (const p of manifest.setup.pages || []) {
      if (p.source === "both" && p.decision === "pending") p.decision = "include";
    }
    manifest.setup.status = "awaiting_seed_confirm";
  }
  if (args.applySeeds) {
    for (const p of manifest.setup.pages || []) {
      if (p.decision === "include" || (p.source === "both" && p.decision === "pending")) {
        p.seed = commercialSeed(p);
      }
    }
    if (manifest.setup.status === "awaiting_reconcile") {
      manifest.setup.status = "awaiting_seed_confirm";
    }
  }
  if (args.setSeedSlug) {
    const page = pageBySlug(manifest, args.setSeedSlug);
    if (!page) return { error: "page_not_found", slug: args.setSeedSlug };
    page.seed = args.setSeedValue;
  }
  if (args.recordMatrixSlug) {
    const page = pageBySlug(manifest, args.recordMatrixSlug);
    if (!page) return { error: "page_not_found", slug: args.recordMatrixSlug };
    const existing = existingMatrix(pipelineDir, args.recordMatrixSlug);
    page.matrix_path = args.matrixPath || existing;
    page.matrix_status = args.matrixStatus || (existing ? "skipped_existing" : "recorded");
    manifest.setup.status = "matrix_in_progress";
  }
  if (args.setupComplete) {
    const needed = (manifest.setup.pages || []).filter((p) => p.decision === "include");
    const missing = needed.filter((p) => !p.matrix_path && !existingMatrix(pipelineDir, p.slug));
    if (missing.length) {
      return {
        error: "matrices_incomplete",
        missing: missing.map((p) => p.slug),
      };
    }
    for (const p of needed) {
      if (!p.matrix_path) {
        p.matrix_path = existingMatrix(pipelineDir, p.slug);
        p.matrix_status = p.matrix_status || "skipped_existing";
      }
    }
    manifest.setup.status = "setup_complete";
  }
  return { manifest };
}

function nextMatrixPage(manifest, pipelineDir) {
  const pages = (manifest.setup.pages || []).filter((p) => p.decision === "include");
  for (const p of pages) {
    if (p.matrix_path || existingMatrix(pipelineDir, p.slug)) continue;
    return {
      slug: p.slug,
      seed: p.seed,
      output: path.join(pagesDir(pipelineDir), "matrix", p.slug),
    };
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv, { campaignDir: null });
  if (args.help || !args.campaignDir) {
    console.log(
      JSON.stringify(
        {
          usage:
            'node pages-manifest.mjs --campaign-dir "<abs>" [--decide slug include|skip|defer] [--approve-list] [--apply-seeds] [--set-seed slug "seed"] [--record-matrix slug --matrix-path p --matrix-status recorded] [--setup-complete] [--next-matrix] [--write-projection]',
        },
        null,
        2,
      ),
    );
    process.exit(args.help ? 0 : 1);
  }
  const campaignDir = path.resolve(args.campaignDir);
  requireCampaign(campaignDir);
  const { pipelineDir } = resolveDirs({ campaignDir });
  const manifest = readManifest(pipelineDir);
  if (!manifest) {
    console.error(JSON.stringify({ error: "manifest_missing", hint: "run scaffold-pages.mjs" }));
    process.exit(2);
  }
  if (args.nextMatrix) {
    console.log(JSON.stringify({ next: nextMatrixPage(manifest, pipelineDir) }, null, 2));
    return;
  }
  const result = applyManifestAction(manifest, pipelineDir, args);
  if (result.error) {
    console.error(JSON.stringify(result));
    process.exit(1);
  }
  writeManifest(pipelineDir, result.manifest);
  let projection = null;
  if (args.writeProjection || args.approveList || args.applySeeds || args.setupComplete) {
    projection = writeProjection(pipelineDir, result.manifest);
  }
  console.log(
    JSON.stringify(
      {
        setup: result.manifest.setup,
        projection,
        next_matrix: nextMatrixPage(result.manifest, pipelineDir),
      },
      null,
      2,
    ),
  );
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
