#!/usr/bin/env node
/**
 * Persist page-owned photos into the campaign image-library inbox.
 *
 * Usage:
 *   node ingest.mjs --campaign-dir "C:\\...\\Campaign" --payloads payloads.json
 *
 * Requires sources.md. Live scrape is the agent's job (Monid discover → payload).
 */
import fs from "node:fs";
import path from "node:path";
import { parseCampaignArgs, requireCampaignDir } from "./lib/campaign.mjs";
import {
  emptyFlags,
  ensureLibraryTree,
  existingSourceIds,
  isEphemeralCaption,
  libraryDir,
  loadManifest,
  rejectedSourceIds,
  saveManifest,
  seedCampaignClassifierTemplate,
  seedCampaignImageHelpers,
  sha256Buffer,
  uniqueBasename,
  upsertItem,
  imageExtFromBytes,
} from "./lib/library.mjs";

const SOURCES = "sources.md";

export function sourcesPath(libDir) {
  return path.join(libDir, SOURCES);
}

export function requireSources(libDir) {
  const p = sourcesPath(libDir);
  if (!fs.existsSync(p)) {
    const err = new Error(
      `Missing ${SOURCES} at ${p}. Add GBP / Facebook / Instagram URLs before ingest.`,
    );
    err.code = "MISSING_SOURCES";
    throw err;
  }
  return p;
}

function normCategory(record) {
  return String(record.photo_category || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isGbpPostRecord(record) {
  if (record.is_gbp_post) return true;
  const category = normCategory(record);
  if (category === "gbp_post" || category === "google_post") return true;
  const scraper = String(record.scraper || "").toLowerCase();
  const sourceUrl = String(record.source_url || "").toLowerCase();
  const mediaUrl = String(record.media_url || "").toLowerCase();
  if (/my[-_]?business[-_]?updates/.test(scraper)) return true;
  if (sourceUrl.includes("/local/posts")) return true;
  if (mediaUrl.includes("/geougc/")) return true;
  return false;
}

function isStockRecord(record) {
  if (record.is_stock) return true;
  const category = normCategory(record);
  return category === "stock" || category === "stock_photo";
}

function isByOwnerRecord(record) {
  const category = normCategory(record);
  if (category === "by_owner" || category === "owner") return true;
  const sourceUrl = String(record.source_url || "").toLowerCase();
  return sourceUrl.includes("/maps/contrib/") && sourceUrl.includes("/photos");
}

function isGbpNotOwnerRecord(record) {
  const platform = String(record.source_platform || "").toLowerCase();
  if (platform !== "gbp") return false;
  const category = normCategory(record);
  if (!category) return false;
  if (category === "by_owner" || category === "owner") return false;
  return true;
}

export function skipReason(record) {
  if (record.login_wall) return "login_wall";
  if (record.is_tagged_in) return "tagged_in";
  if (record.is_review_author) return "review_author";
  if (record.is_ugc) return "ugc";
  if (isStockRecord(record)) return "stock";
  if (isGbpPostRecord(record)) return "gbp_post";
  if (isGbpNotOwnerRecord(record)) return "gbp_not_owner";
  if (record.is_off_topic) return "off_topic";
  if (record.is_ephemeral_promo || isEphemeralCaption(record.caption)) {
    return "ephemeral_promo";
  }
  const owner = String(record.owner_username || "").toLowerCase();
  const page = String(record.page_username || "").toLowerCase();
  if (owner && page && owner !== page) return "tagged_in";
  return null;
}

function isPostOrStockItem(item) {
  return (
    isGbpPostRecord(item) ||
    isStockRecord(item) ||
    /gbp_post|stock/i.test(String(item.rights_notes || ""))
  );
}

function hashSkipReason(manifest, hash, record) {
  const hits = (manifest.items || []).filter((i) => i.sha256 === hash);
  if (!hits.length) return null;
  const live = hits.filter((i) => i.status !== "rejected");
  if (live.length) return "hash";
  if (isByOwnerRecord(record) && hits.every(isPostOrStockItem)) return null;
  return "hash";
}

function safeId(platform, sourceMediaId) {
  const plat = String(platform || "src").replace(/[^a-z0-9]+/gi, "").slice(0, 12) || "src";
  const mid = String(sourceMediaId || "unknown").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  return `${plat}_${mid}`;
}

async function readMediaBytes(mediaUrl) {
  if (!mediaUrl) {
    const err = new Error("record missing media_url");
    err.code = "MISSING_MEDIA";
    throw err;
  }
  if (/^https?:\/\//i.test(mediaUrl)) {
    const res = await fetch(mediaUrl);
    if (!res.ok) {
      const err = new Error(`download failed ${res.status} for ${mediaUrl}`);
      err.code = "DOWNLOAD_FAILED";
      throw err;
    }
    return Buffer.from(await res.arrayBuffer());
  }
  let p = mediaUrl;
  if (mediaUrl.startsWith("file://")) {
    p = fileURLToPathCompat(mediaUrl);
  }
  if (!fs.existsSync(p)) {
    const err = new Error(`local media not found: ${p}`);
    err.code = "MISSING_MEDIA";
    throw err;
  }
  return fs.readFileSync(p);
}

function fileURLToPathCompat(url) {
  const u = new URL(url);
  let p = decodeURIComponent(u.pathname);
  if (process.platform === "win32" && p.startsWith("/")) p = p.slice(1);
  return p;
}

export async function ingestRecords({ campaignDir, pipelineDir, records }) {
  const libDir = libraryDir(pipelineDir);
  requireSources(libDir);
  ensureLibraryTree(libDir);
  seedCampaignClassifierTemplate(pipelineDir);
  seedCampaignImageHelpers(pipelineDir);
  const manifest = loadManifest(libDir);
  manifest.campaign_dir = campaignDir;
  manifest.pipeline_dir = pipelineDir;

  const hashes = new Set(
    (manifest.items || [])
      .filter((i) => i.status !== "rejected" && i.sha256)
      .map((i) => i.sha256),
  );
  const sourceIds = existingSourceIds(manifest);
  const rejected = rejectedSourceIds(manifest);

  const summary = {
    added: 0,
    skipped_hash: 0,
    skipped_source_id: 0,
    skipped_rejected: 0,
    skipped_rights: 0,
    skipped_stock: 0,
    skipped_gbp_post: 0,
    skipped_not_evergreen: 0,
    skipped_login: 0,
    skipped_not_image: 0,
    errors: [],
  };

  for (const record of records || []) {
    const rights = skipReason(record);
    if (rights === "login_wall") {
      summary.skipped_login += 1;
      summary.errors.push(
        `Stopped source ${record.source_url || record.source_platform}: login wall. Do not ask for passwords.`,
      );
      continue;
    }
    if (rights === "stock" || rights === "gbp_post" || rights === "gbp_not_owner") {
      if (rights === "stock") summary.skipped_stock += 1;
      if (rights === "gbp_post" || rights === "gbp_not_owner") summary.skipped_gbp_post += 1;
      continue;
    }
    if (rights === "off_topic" || rights === "ephemeral_promo") {
      summary.skipped_not_evergreen += 1;
      continue;
    }
    if (rights) {
      summary.skipped_rights += 1;
      continue;
    }
    const sid = record.source_media_id != null ? String(record.source_media_id) : "";
    if (sid && rejected.has(sid)) {
      summary.skipped_rejected += 1;
      continue;
    }
    if (sid && sourceIds.has(sid)) {
      summary.skipped_source_id += 1;
      continue;
    }

    let buf;
    try {
      buf = await readMediaBytes(record.media_url);
    } catch (err) {
      summary.errors.push(err.message);
      continue;
    }
    const hash = sha256Buffer(buf);
    if (hashes.has(hash) || hashSkipReason(manifest, hash, record)) {
      summary.skipped_hash += 1;
      continue;
    }

    const platform = record.source_platform || "unknown";
    const id = safeId(platform, sid || hash.slice(0, 12));
    const ext = imageExtFromBytes(buf);
    if (!ext) {
      summary.skipped_not_image += 1;
      upsertItem(manifest, {
        id,
        rel_path: "",
        source_url: record.source_url || "",
        source_platform: platform,
        scraper: record.scraper || "",
        photo_category: record.photo_category || (isByOwnerRecord(record) ? "by_owner" : ""),
        downloaded_at: new Date().toISOString(),
        sha256: hash,
        source_media_id: sid,
        proposed_tags: [],
        approved_tags: [],
        confidence: null,
        flags: emptyFlags(),
        status: "rejected",
        purged_at: new Date().toISOString(),
        caption: record.caption || "",
        scene: "",
        rights_notes: "not_image",
      });
      hashes.add(hash);
      if (sid) {
        sourceIds.add(sid);
        rejected.add(sid);
      }
      continue;
    }
    const inboxDir = path.join(libDir, "inbox");
    const filename = uniqueBasename(inboxDir, `${id}${ext}`);
    fs.writeFileSync(path.join(inboxDir, filename), buf);

    const item = {
      id,
      rel_path: `inbox/${filename}`.replace(/\\/g, "/"),
      source_url: record.source_url || "",
      source_platform: platform,
      scraper: record.scraper || "",
      photo_category: record.photo_category || (isByOwnerRecord(record) ? "by_owner" : ""),
      downloaded_at: new Date().toISOString(),
      sha256: hash,
      source_media_id: sid,
      proposed_tags: [],
      approved_tags: [],
      confidence: null,
      flags: emptyFlags(),
      status: "inbox",
      caption: record.caption || "",
      scene: "",
      rights_notes: "page-owned (ingest filter)",
    };
    upsertItem(manifest, item);
    hashes.add(hash);
    if (sid) sourceIds.add(sid);
    summary.added += 1;
  }

  saveManifest(libDir, manifest);
  return { libDir, summary, manifest };
}

function loadPayloads(payloadsPath) {
  if (!payloadsPath) return { records: [] };
  const abs = path.resolve(payloadsPath);
  if (!fs.existsSync(abs)) {
    const err = new Error(`Payloads file not found: ${abs}`);
    err.code = "MISSING_PAYLOADS";
    throw err;
  }
  const parsed = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (Array.isArray(parsed)) return { records: parsed };
  if (Array.isArray(parsed.records)) return parsed;
  const err = new Error("Payloads JSON must be { records: [...] }");
  err.code = "INVALID_PAYLOADS";
  throw err;
}

async function main() {
  const args = parseCampaignArgs(process.argv);
  if (args.help) {
    console.log(
      "Usage: node ingest.mjs --campaign-dir <path> [--payloads <json>]",
    );
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
  try {
    requireSources(libDir);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const payloadsPath = args.extra.payloads || null;
  if (!payloadsPath) {
    console.error(
      "No --payloads file. After Monid discover → inspect → run, write records JSON under the campaign and pass --payloads. See references/scraper-routing.md.",
    );
    process.exit(2);
  }
  const { records } = loadPayloads(payloadsPath);
  const result = await ingestRecords({
    campaignDir: dirs.campaignDir,
    pipelineDir: dirs.pipelineDir,
    records,
  });
  console.log(JSON.stringify({ ok: true, ...result.summary }, null, 2));
}

if (process.argv[1] && process.argv[1].endsWith("ingest.mjs")) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
