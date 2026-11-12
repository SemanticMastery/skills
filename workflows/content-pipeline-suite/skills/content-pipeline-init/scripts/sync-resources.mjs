#!/usr/bin/env node
/**
 * Copy inventoried campaign resources into 06-content-pipeline/01-resources/.
 *
 * Usage:
 *   node sync-resources.mjs --campaign-dir "C:\\...\\Campaign"
 *   node sync-resources.mjs --campaign-dir "..." --dry-run
 *   node sync-resources.mjs --campaign-dir "..." --classes product_doc
 */

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  nextPlanSkill,
  resolveInitManifestStatus,
} from "./lib/init-status.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { campaignDir: null, dryRun: false, classes: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--campaign-dir") out.campaignDir = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--classes") {
      const raw = argv[++i];
      out.classes = new Set(
        String(raw || "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      );
    } else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function runInventory(campaignDir, extraArgs = []) {
  const inventoryScript = path.join(__dirname, "inventory-resources.mjs");
  const r = spawnSync(
    process.execPath,
    [inventoryScript, "--campaign-dir", campaignDir, ...extraArgs],
    { encoding: "utf8" }
  );
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || "inventory failed");
  }
  return JSON.parse(r.stdout);
}

function ensureDir(dir, dryRun) {
  if (!dryRun) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest, dryRun) {
  if (dryRun) return { action: "would_copy", src, dest };
  ensureDir(path.dirname(dest), false);
  fs.copyFileSync(src, dest);
  return { action: "copied", src, dest };
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** The ISO date from a Product-Documentation `**Last updated:**` line, or null. */
function lastUpdated(file) {
  const text = fs.readFileSync(file, "utf8");
  const hit =
    text.match(/\*\*Last updated:\*\*\s*(\d{4}-\d{2}-\d{2})/) ||
    text.match(/^Last updated:\s*(\d{4}-\d{2}-\d{2})/m);
  return hit ? hit[1] : null;
}

/**
 * One canonical Product-Documentation: `01-intake/1.1-docs/Product-Documentation.md` (`src`).
 * The `01-resources` file (`dest`) is a mirror the content pipeline reads, refreshed from the
 * canonical when the content differs (sha256).
 *
 *   already_at_dest              src is dest (a campaign that only has the resources copy)
 *   copy                         dest is missing or differs: the canonical wins
 *   identical_dest               same bytes: nothing to do
 *   mirror_newer_than_canonical  the mirror's `Last updated` is later than the canonical's.
 *                                Left alone so newer content is not overwritten silently.
 *                                A missing date, or the same day, is the canonical's call.
 */
export function productDocCopyDecision(src, dest) {
  if (path.resolve(src) === path.resolve(dest)) return "already_at_dest";
  if (!fs.existsSync(dest)) return "copy";
  if (sha256(src) === sha256(dest)) return "identical_dest";
  const canonicalDate = lastUpdated(src);
  const mirrorDate = lastUpdated(dest);
  if (canonicalDate && mirrorDate && mirrorDate > canonicalDate) return "mirror_newer_than_canonical";
  return "copy";
}

/** Extra report fields for a non-copy decision: the dates behind `mirror_newer_than_canonical`. */
function productDocDecisionDetail(decision, src, dest) {
  if (decision !== "mirror_newer_than_canonical") return {};
  return { canonical_last_updated: lastUpdated(src), mirror_last_updated: lastUpdated(dest) };
}

function destFor(resourcesDir, classId, basename) {
  const SUBFOLDER_CLASSES = new Set([
    "matrix",
    "personas",
    "paa",
    "fanout",
    "dossier",
    "onpage",
  ]);
  if (SUBFOLDER_CLASSES.has(classId)) {
    return path.join(resourcesDir, classId, basename);
  }
  return path.join(resourcesDir, basename);
}

const SUBFOLDER_CLASSES = new Set([
  "matrix",
  "personas",
  "paa",
  "fanout",
  "dossier",
  "onpage",
]);

const ROOT_ONLY_CLASSES = new Set(["icp", "product_doc"]);

/** Match basename → class_id (same rules as inventory-resources.mjs). */
export function classForBasename(basename) {
  if (/_matrix/i.test(basename)) return "matrix";
  if (/_personas/i.test(basename)) return "personas";
  if (/^paa-/i.test(basename)) return "paa";
  if (/^fanout-queries-/i.test(basename)) return "fanout";
  if (/dossier/i.test(basename) && /\.(md|docx)$/i.test(basename)) return "dossier";
  if (/^onpage-crawl-/i.test(basename) || /^on-page/i.test(basename)) return "onpage";
  if (/icp/i.test(basename)) return "icp";
  if (/product-documentation/i.test(basename) || /^Product-Documentation\.md$/i.test(basename)) {
    return "product_doc";
  }
  return null;
}

const PROTECTED_ROOT = new Set(["ai-isms.md", "CONTEXT.md"]);

/**
 * After sync, remove legacy flat duplicates and wrong nested copies.
 * Subfolder classes: canonical path is {class_id}/{basename}; delete root stale.
 * Root-only classes: canonical path is root; delete {class_id}/{basename} stale.
 */
function removeStaleDuplicates(resourcesDir, dryRun) {
  const removed = [];
  const moved = [];
  if (!fs.existsSync(resourcesDir)) return { removed, moved };

  // 1) Root files that belong in a class subfolder
  for (const ent of fs.readdirSync(resourcesDir, { withFileTypes: true })) {
    if (!ent.isFile() || PROTECTED_ROOT.has(ent.name)) continue;
    const classId = classForBasename(ent.name);
    if (!classId || !SUBFOLDER_CLASSES.has(classId)) continue;
    const subPath = path.join(resourcesDir, classId, ent.name);
    if (!fs.existsSync(subPath)) continue;
    const rootPath = path.join(resourcesDir, ent.name);
    if (dryRun) {
      removed.push({ action: "would_remove", path: rootPath, reason: "stale_root_duplicate", class_id: classId });
    } else {
      fs.unlinkSync(rootPath);
      removed.push({ action: "removed", path: rootPath, reason: "stale_root_duplicate", class_id: classId });
    }
  }

  // 2) Root-only classes wrongly nested under icp/ or product_doc/
  for (const classId of ROOT_ONLY_CLASSES) {
    const classDir = path.join(resourcesDir, classId);
    if (!fs.existsSync(classDir)) continue;
    for (const ent of fs.readdirSync(classDir, { withFileTypes: true })) {
      if (!ent.isFile()) continue;
      if (classForBasename(ent.name) !== classId) continue;
      const nested = path.join(classDir, ent.name);
      const rootPath = path.join(resourcesDir, ent.name);
      if (fs.existsSync(rootPath)) {
        if (dryRun) {
          removed.push({ action: "would_remove", path: nested, reason: "stale_nested_duplicate", class_id: classId });
        } else {
          fs.unlinkSync(nested);
          removed.push({ action: "removed", path: nested, reason: "stale_nested_duplicate", class_id: classId });
        }
      } else {
        if (dryRun) {
          moved.push({ action: "would_move", from: nested, to: rootPath, class_id: classId });
        } else {
          fs.renameSync(nested, rootPath);
          moved.push({ action: "moved", from: nested, to: rootPath, class_id: classId });
        }
      }
    }
    // Remove empty mistaken class dirs
    if (!dryRun && fs.existsSync(classDir)) {
      const left = fs.readdirSync(classDir);
      if (left.length === 0) fs.rmdirSync(classDir);
    }
  }

  return { removed, moved };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.campaignDir) {
    console.log(
      JSON.stringify(
        {
          usage:
            'node sync-resources.mjs --campaign-dir "<abs>" [--dry-run] [--classes product_doc,paa]',
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

  let inv;
  try {
    inv = runInventory(campaignDir);
  } catch (e) {
    console.error(JSON.stringify({ error: String(e?.message || e) }));
    process.exit(2);
  }

  const resourcesDir = path.join(
    campaignDir,
    "06-content-pipeline",
    "01-resources"
  );
  ensureDir(resourcesDir, args.dryRun);

  const copied = [];
  const skipped = [];
  const errors = [];

  if (args.classes) {
    for (const id of args.classes) {
      if (!Object.prototype.hasOwnProperty.call(inv.resources || {}, id)) {
        errors.push({ error: `unknown_class: ${id}` });
      }
    }
  }

  for (const [classId, meta] of Object.entries(inv.resources || {})) {
    if (args.classes && !args.classes.has(classId)) continue;
    if (meta.state !== "present") {
      skipped.push({ class_id: classId, reason: "missing_source" });
      continue;
    }
    for (const m of meta.matches || []) {
      const src = m.path;
      const basename = path.basename(src);
      // Agent pack: dossier .docx is for humans in 01-intake only — skip sync
      if (classId === "dossier" && /\.docx$/i.test(basename)) {
        skipped.push({
          class_id: classId,
          reason: "docx_not_for_agent_resources",
          src,
        });
        continue;
      }
      try {
        const dest = destFor(resourcesDir, classId, basename);
        if (classId === "product_doc") {
          const decision = productDocCopyDecision(src, dest);
          if (decision !== "copy") {
            skipped.push({
              class_id: classId,
              reason: decision,
              src,
              dest,
              ...productDocDecisionDetail(decision, src, dest),
            });
            continue;
          }
          // The hash already says the content differs, so the size+mtime shortcut below
          // must not skip it.
          const replacedExisting = fs.existsSync(dest);
          const result = copyFile(src, dest, args.dryRun);
          copied.push({ class_id: classId, ...result, replaced_existing: replacedExisting });
          continue;
        }
        if (fs.existsSync(dest)) {
          const s = fs.statSync(src);
          const d = fs.statSync(dest);
          if (s.size === d.size && s.mtimeMs === d.mtimeMs) {
            skipped.push({
              class_id: classId,
              reason: "identical_dest",
              src,
              dest,
            });
            continue;
          }
        }
        const result = copyFile(src, dest, args.dryRun);
        copied.push({ class_id: classId, ...result });
      } catch (e) {
        errors.push({
          class_id: classId,
          src,
          error: String(e?.message || e),
        });
      }
    }
  }

  const aiIsmsDest = path.join(resourcesDir, "ai-isms.md");
  const templateRoot = process.env.CONTENT_PIPELINE_ICM_TEMPLATE;
  const templateAi = templateRoot
    ? path.join(templateRoot, "01-resources", "ai-isms.md")
    : "";
  if (!args.classes && !fs.existsSync(aiIsmsDest) && fs.existsSync(templateAi)) {
    copied.push(copyFile(templateAi, aiIsmsDest, args.dryRun));
  }

  const { removed: removedStale, moved: movedToRoot } = args.classes
    ? { removed: [], moved: [] }
    : removeStaleDuplicates(resourcesDir, args.dryRun);

  const report = {
    campaign_dir: campaignDir,
    dest: resourcesDir,
    dry_run: Boolean(args.dryRun),
    classes: args.classes ? [...args.classes] : null,
    copied,
    skipped,
    removed_stale: removedStale,
    moved_to_root: movedToRoot,
    errors,
    gaps: inv.gaps,
  };

  const manifestPath = path.join(
    campaignDir,
    "06-content-pipeline",
    "content-pipeline-init-manifest.json"
  );

  if (!args.dryRun && !args.classes) {
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    let manifest = inv;
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = {
          ...JSON.parse(fs.readFileSync(manifestPath, "utf8")),
          ...inv,
          inputs: JSON.parse(fs.readFileSync(manifestPath, "utf8")).inputs,
        };
      } catch {
        /* keep inv */
      }
    }

    let destInv;
    try {
      destInv = runInventory(campaignDir, ["--dest-only"]);
    } catch (e) {
      destInv = { gaps: inv.gaps, scaffold: { ai_isms_present: false } };
      errors.push({ error: `dest_inventory: ${e.message}` });
    }

    manifest.sync = {
      status: errors.length ? "partial" : "complete",
      copied,
      skipped,
      removed_stale: removedStale,
      moved_to_root: movedToRoot,
      errors,
      updated_at: new Date().toISOString(),
    };
    manifest.updated_at = new Date().toISOString();
    manifest.destination_gaps = destInv.gaps || [];
    manifest.resources = inv.resources;

    const resourcesReady =
      (destInv.gaps || []).length === 0 &&
      (destInv.scaffold?.ai_isms_present || fs.existsSync(aiIsmsDest));
    const plan = destInv.plan || inv.plan || {};
    const existingHorizon = manifest.plan?.horizon_weeks ?? null;
    manifest.plan = {
      ...(manifest.plan || {}),
      ...plan,
      horizon_weeks: existingHorizon,
    };
    manifest.status = resolveInitManifestStatus({
      resourcesReady,
      plan: manifest.plan,
      existingHorizon,
    });
    if (manifest.status === "init_complete") {
      manifest.gaps = [];
    } else {
      manifest.gaps = destInv.gaps || inv.gaps;
    }

    // Preserve inputs if we overwrote poorly
    if (!manifest.inputs) {
      manifest.inputs = {
        keywords: [],
        paa_location: null,
        paid_compose_approved: false,
        crawl_approved: false,
      };
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    report.manifest_path = manifestPath;
    report.status = manifest.status;
    report.destination_gaps = destInv.gaps;
    report.plan = manifest.plan;
    report.next_skill = nextPlanSkill(manifest.status);
  }

  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exit(3);
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
