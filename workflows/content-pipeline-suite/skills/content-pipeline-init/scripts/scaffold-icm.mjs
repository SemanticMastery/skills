#!/usr/bin/env node
/**
 * Ensure {campaign}/06-content-pipeline mirrors Content-Pipeline-ICM template.
 * Copies missing files only — does not overwrite existing campaign files.
 *
 * Usage:
 *   node scaffold-icm.mjs --campaign-dir "C:\\...\\Ridgeline-Tree-Care"
 *   node scaffold-icm.mjs --campaign-dir "..." --dry-run
 */

import fs from "node:fs";
import path from "node:path";

function resolveDefaultTemplate(explicit) {
  if (explicit) return explicit;
  if (process.env.CONTENT_PIPELINE_ICM_TEMPLATE) {
    return process.env.CONTENT_PIPELINE_ICM_TEMPLATE;
  }
  return null;
}


function parseArgs(argv) {
  const out = {
    campaignDir: null,
    template: null,
    dryRun: false,
    refreshContext: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--campaign-dir") out.campaignDir = argv[++i];
    else if (a === "--template") out.template = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--refresh-context") out.refreshContext = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function walkFiles(dir, base = dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(full, base, acc);
    else if (ent.isFile()) {
      acc.push({
        abs: full,
        rel: path.relative(base, full),
      });
    }
  }
  return acc;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.campaignDir) {
    console.log(
      JSON.stringify(
        {
          usage:
            'node scaffold-icm.mjs --campaign-dir "<abs>" [--template "<abs>"] [--dry-run] [--refresh-context "03-write/3.1-brief/CONTEXT.md"]',
        },
        null,
        2
      )
    );
    process.exit(args.help ? 0 : 1);
  }

  const campaignDir = path.resolve(args.campaignDir);
  const templateRaw = resolveDefaultTemplate(args.template);
  if (!templateRaw) {
    console.error(JSON.stringify({
      error: "template_required",
      hint: "Pass --template <Content-Pipeline-ICM dir> or set CONTENT_PIPELINE_ICM_TEMPLATE",
    }));
    process.exit(2);
  }
  const template = path.resolve(templateRaw);
  const destRoot = path.join(campaignDir, "06-content-pipeline");

  if (!fs.existsSync(campaignDir)) {
    console.error(JSON.stringify({ error: "campaign_dir_not_found", campaignDir }));
    process.exit(2);
  }
  if (!fs.existsSync(template)) {
    console.error(JSON.stringify({ error: "template_not_found", template }));
    process.exit(2);
  }

  if (args.refreshContext) {
    const rels = String(args.refreshContext)
      .split(",")
      .map((s) => s.trim().replace(/\\/g, "/"))
      .filter(Boolean);
    const refreshed = [];
    const missing = [];
    for (const rel of rels) {
      const src = path.join(template, rel);
      const dest = path.join(destRoot, rel);
      if (!fs.existsSync(src)) {
        missing.push({ rel, reason: "template_missing" });
        continue;
      }
      const before = fs.existsSync(dest) ? fs.readFileSync(dest, "utf8") : "";
      const after = fs.readFileSync(src, "utf8");
      const changed = before !== after;
      if (!args.dryRun && changed) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
      refreshed.push({ rel, action: changed ? (args.dryRun ? "would_overwrite" : "overwritten") : "unchanged" });
    }
    console.log(JSON.stringify({ campaign_dir: campaignDir, refresh_context: refreshed, missing }, null, 2));
    return;
  }

  const files = walkFiles(template);
  const created = [];
  const skipped = [];

  if (!args.dryRun) fs.mkdirSync(destRoot, { recursive: true });

  for (const f of files) {
    const dest = path.join(destRoot, f.rel);
    if (fs.existsSync(dest)) {
      skipped.push({ rel: f.rel, reason: "exists" });
      continue;
    }
    if (args.dryRun) {
      created.push({ rel: f.rel, action: "would_create" });
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f.abs, dest);
    created.push({ rel: f.rel, action: "created" });
  }

  const aiIsms = path.join(destRoot, "01-resources", "ai-isms.md");
  const report = {
    campaign_dir: campaignDir,
    template,
    dest: destRoot,
    dry_run: Boolean(args.dryRun),
    created,
    skipped,
    ai_isms_present: fs.existsSync(aiIsms) || created.some((c) => c.rel.replace(/\\/g, "/") === "01-resources/ai-isms.md"),
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
