#!/usr/bin/env node
/**
 * Copy skill-owned pages templates into {campaign}/06-content-pipeline/pages/
 * and write pipeline-pages-manifest.json if missing. Never overwrite existing
 * campaign files (same rule as scaffold-icm.mjs).
 *
 * Usage:
 *   node scaffold-pages.mjs --campaign-dir "/abs/path/to/campaign"
 *   node scaffold-pages.mjs --campaign-dir "..." --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib/args.mjs";
import {
  manifestPath,
  pagesDir,
  requireCampaign,
  resolveDirs,
  starterManifest,
  writeManifest,
} from "./lib/paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TEMPLATE = path.resolve(__dirname, "..", "templates", "pages");

function walkFiles(dir, base = dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkFiles(full, base, acc);
    else acc.push({ abs: full, rel: path.relative(base, full) });
  }
  return acc;
}

export function scaffoldPages(opts) {
  const campaignDir = path.resolve(opts.campaignDir);
  const template = path.resolve(opts.template || DEFAULT_TEMPLATE);
  const { pipelineDir } = resolveDirs({ campaignDir });
  const destPages = pagesDir(pipelineDir);
  const dryRun = Boolean(opts.dryRun);

  if (!fs.existsSync(campaignDir)) {
    return { error: "campaign_dir_not_found", campaignDir };
  }
  if (!fs.existsSync(template)) {
    return { error: "template_not_found", template };
  }

  const files = walkFiles(template);
  const created = [];
  const skipped = [];

  if (!dryRun) {
    fs.mkdirSync(destPages, { recursive: true });
    fs.mkdirSync(path.join(destPages, "matrix"), { recursive: true });
    for (const stage of ["p.1-brief", "p.2-draft", "p.3-edit", "p.4-polish"]) {
      fs.mkdirSync(path.join(destPages, stage), { recursive: true });
    }
  }

  for (const f of files) {
    const dest = path.join(destPages, f.rel);
    if (fs.existsSync(dest)) {
      skipped.push({ rel: f.rel.replace(/\\/g, "/"), action: "skipped_exists" });
      continue;
    }
    if (dryRun) {
      created.push({ rel: f.rel.replace(/\\/g, "/"), action: "would_create" });
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f.abs, dest);
    created.push({ rel: f.rel.replace(/\\/g, "/"), action: "created" });
  }

  const man = manifestPath(pipelineDir);
  let manifestAction = "skipped_exists";
  if (!fs.existsSync(man)) {
    if (dryRun) manifestAction = "would_create";
    else {
      writeManifest(pipelineDir, starterManifest(campaignDir, pipelineDir));
      manifestAction = "created";
    }
  }

  return {
    campaign_dir: campaignDir,
    template,
    dest: destPages,
    dry_run: dryRun,
    created,
    skipped,
    manifest: { path: man, action: manifestAction },
    forbidden_writes: [
      "03-write/",
      "04-publish/",
      "05-archives/",
      "Content-Pipeline-ICM",
    ],
  };
}

function main() {
  const args = parseArgs(process.argv, {
    campaignDir: null,
    dryRun: false,
    template: DEFAULT_TEMPLATE,
  });
  if (args.help || !args.campaignDir) {
    console.log(
      JSON.stringify(
        {
          usage:
            'node scaffold-pages.mjs --campaign-dir "<abs>" [--template "<abs>"] [--dry-run]',
        },
        null,
        2,
      ),
    );
    process.exit(args.help ? 0 : 1);
  }
  requireCampaign(path.resolve(args.campaignDir));
  const report = scaffoldPages(args);
  if (report.error) {
    console.error(JSON.stringify(report));
    process.exit(2);
  }
  console.log(JSON.stringify(report, null, 2));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
