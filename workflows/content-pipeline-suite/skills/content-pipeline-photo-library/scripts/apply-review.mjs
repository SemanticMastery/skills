#!/usr/bin/env node
/**
 * Apply operator HITL decisions. The only path into approved/.
 *
 * Usage:
 *   node apply-review.mjs --campaign-dir "..." --approve ig_123
 *   node apply-review.mjs --campaign-dir "..." --reject ig_123
 *   node apply-review.mjs --campaign-dir "..." --retag ig_123 --tags "Tree Pruning, Summit County"
 *   node apply-review.mjs --campaign-dir "..." --requeue ig_123
 *   node apply-review.mjs --campaign-dir "..." --rewrite-queue
 *   node apply-review.mjs --campaign-dir "..." --relabel-approved
 *   node apply-review.mjs --campaign-dir "..." --purge-rejected
 */
import path from "node:path";
import { parseCampaignArgs, requireCampaignDir } from "./lib/campaign.mjs";
import {
  findItem,
  itemBinaryExists,
  libraryDir,
  loadManifest,
  moveItemBinary,
  purgeRejectedBinaries,
  relabelApprovedItem,
  relabelApprovedItems,
  saveManifest,
  seedCampaignImageHelpers,
  taxonomyPath,
} from "./lib/library.mjs";
import { dropInvalidTags, loadTaxonomyFile } from "./lib/taxonomy.mjs";
import { writeReviewQueue } from "./lib/classify-engine.mjs";

function parseTags(raw) {
  return String(raw || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function applyDecision(libDir, manifest, { action, id, tags, allowlist }) {
  const item = findItem(manifest, id);
  if (!item) {
    const err = new Error(`Unknown id: ${id}`);
    err.code = "UNKNOWN_ID";
    throw err;
  }

  if (action === "approve") {
    if (item.status !== "review") {
      const err = new Error(`approve requires status=review (got ${item.status}) for ${id}`);
      err.code = "BAD_STATUS";
      throw err;
    }
    item.approved_tags = [...(item.proposed_tags || [])];
    const { dropped } = dropInvalidTags(item.approved_tags, allowlist);
    if (dropped.length) {
      const err = new Error(`approved_tags outside allowlist: ${dropped.join(", ")}`);
      err.code = "INVALID_TAGS";
      throw err;
    }
    moveItemBinary(libDir, item, "approved");
    return item;
  }

  if (action === "retag") {
    const next = parseTags(tags);
    const { kept, dropped } = dropInvalidTags(next, allowlist);
    if (dropped.length || kept.length !== next.length) {
      const err = new Error(
        `retag tags must be in the campaign allowlist. Rejected: ${dropped.join(", ") || "(empty)"}`,
      );
      err.code = "INVALID_TAGS";
      throw err;
    }
    if (!kept.length) {
      const err = new Error("retag requires at least one allowlist tag");
      err.code = "INVALID_TAGS";
      throw err;
    }
    item.proposed_tags = kept;
    item.approved_tags = kept;
    if (item.status === "approved") {
      if (!itemBinaryExists(libDir, item)) {
        const err = new Error(
          `Cannot retag ${id}: approved binary is missing. Re-ingest first.`,
        );
        err.code = "MISSING_BINARY";
        throw err;
      }
      relabelApprovedItem(libDir, item);
      return item;
    }
    if (!itemBinaryExists(libDir, item)) {
      const err = new Error(
        `Cannot retag ${id}: file was deleted after reject. Re-ingest this source, then retag.`,
      );
      err.code = "MISSING_BINARY";
      throw err;
    }
    moveItemBinary(libDir, item, "approved");
    return item;
  }

  if (action === "reject") {
    if (item.status === "rejected" && !itemBinaryExists(libDir, item)) return item;
    moveItemBinary(libDir, item, "rejected");
    return item;
  }

  if (action === "requeue") {
    if (item.status !== "rejected") {
      const err = new Error(`requeue requires status=rejected (got ${item.status}) for ${id}`);
      err.code = "BAD_STATUS";
      throw err;
    }
    if (!itemBinaryExists(libDir, item)) {
      const idx = manifest.items.findIndex((it) => it.id === id);
      if (idx !== -1) manifest.items.splice(idx, 1);
      item.status = "forgotten";
      item.forgotten = true;
      return item;
    }
    moveItemBinary(libDir, item, "review");
    return item;
  }

  const err = new Error(`Unknown action: ${action}`);
  err.code = "UNKNOWN_ACTION";
  throw err;
}

function splitIds(raw) {
  return String(raw || "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function collectActions(extra) {
  const actions = [];
  for (const id of splitIds(extra.approve)) actions.push({ action: "approve", id });
  for (const id of splitIds(extra.reject)) actions.push({ action: "reject", id });
  if (extra.retag) actions.push({ action: "retag", id: extra.retag, tags: extra.tags });
  if (extra.requeue) actions.push({ action: "requeue", id: extra.requeue });
  return actions;
}

async function main() {
  const args = parseCampaignArgs(process.argv);
  if (args.help) {
    console.log(`Usage:
  node apply-review.mjs --campaign-dir <path> --approve <id>
  node apply-review.mjs --campaign-dir <path> --reject <id[,id2]>
  node apply-review.mjs --campaign-dir <path> --retag <id> --tags "Tag, Tag"
  node apply-review.mjs --campaign-dir <path> --requeue <id>
  node apply-review.mjs --campaign-dir <path> --rewrite-queue
  node apply-review.mjs --campaign-dir <path> --relabel-approved
  node apply-review.mjs --campaign-dir <path> --purge-rejected`);
    process.exit(0);
  }
  let dirs;
  try {
    dirs = requireCampaignDir(args);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const libDir = libraryDir(dirs.pipelineDir);
  let allowlist;
  try {
    allowlist = loadTaxonomyFile(taxonomyPath(dirs.pipelineDir)).allowlist;
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const manifest = loadManifest(libDir);
  manifest.campaign_dir = dirs.campaignDir;
  manifest.pipeline_dir = dirs.pipelineDir;

  const actions = collectActions(args.extra);
  const relabelApproved = args.extra["relabel-approved"] === true;
  const purgeRejected = args.extra["purge-rejected"] === true;
  const rewriteOnly = args.extra["rewrite-queue"] === true && actions.length === 0;
  if (!rewriteOnly && !actions.length && !relabelApproved && !purgeRejected) {
    console.error(
      "Pass --approve, --reject, --retag, --requeue, --rewrite-queue, --relabel-approved, or --purge-rejected.",
    );
    process.exit(1);
  }

  const result = { ok: true, applied: actions.map((a) => a.action) };
  try {
    for (const a of actions) {
      const item = applyDecision(libDir, manifest, { ...a, allowlist });
      if (item?.forgotten) result.forgotten = [...(result.forgotten || []), item.id];
    }
    if (relabelApproved) {
      result.relabeled = relabelApprovedItems(libDir, manifest);
    }
    if (purgeRejected) {
      result.purged = purgeRejectedBinaries(libDir, manifest);
    }
    saveManifest(libDir, manifest);
    writeReviewQueue(libDir, manifest);
    result.helpers = seedCampaignImageHelpers(dirs.pipelineDir);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && process.argv[1].endsWith("apply-review.mjs")) {
  main();
}
