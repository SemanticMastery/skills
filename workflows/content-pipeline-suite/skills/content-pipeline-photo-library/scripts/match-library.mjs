#!/usr/bin/env node
/**
 * Match approved library photos to 3.5-images placeholders (KTD5).
 *
 * Usage:
 *   node match-library.mjs --campaign-dir "..." --post-tags "Emergencies, Summit County" \
 *     --scenes-json scenes.json --out-dir ".../3.5-images" --post 2
 *
 * Does not call Fal. Misses are engine=miss for the 3.5 agent to Fal-generate.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseCampaignArgs, requireCampaignDir } from "./lib/campaign.mjs";
import {
  libraryDir,
  loadApprovedItems,
} from "./lib/library.mjs";
import { isCountyTag } from "./lib/taxonomy.mjs";

const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "in", "on", "at", "to", "for", "with",
  "after", "before", "from", "into", "over", "under", "is", "are",
]);

export function parseTagList(raw) {
  return String(raw || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function primaryTopicTag(postTags) {
  return (postTags || []).find((t) => !isCountyTag(t)) || null;
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

export function scoreCandidate(item, scene, postCountyTags) {
  const hay = `${item.caption || ""} ${item.scene || ""}`.toLowerCase();
  const tokens = tokenize(scene);
  let overlap = 0;
  for (const t of tokens) {
    if (hay.includes(t)) overlap += 1;
  }
  const countyBonus = (postCountyTags || []).some((c) =>
    (item.approved_tags || []).includes(c),
  )
    ? 10
    : 0;
  return overlap + countyBonus;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isPng(buf) {
  return buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e;
}

export function copyAsPng(srcPath, destPath) {
  const buf = fs.readFileSync(srcPath);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  if (isPng(buf)) {
    fs.copyFileSync(srcPath, destPath);
    return destPath;
  }
  if (process.platform === "win32") {
    const ps = `
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile(${JSON.stringify(srcPath)})
try {
  $img.Save(${JSON.stringify(destPath)}, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $img.Dispose()
}
`;
    const r = spawnSync("powershell", ["-NoProfile", "-Command", ps], {
      encoding: "utf8",
    });
    if (r.status === 0 && fs.existsSync(destPath) && isPng(fs.readFileSync(destPath))) {
      return destPath;
    }
  }
  fs.copyFileSync(srcPath, destPath);
  return destPath;
}

export function matchPlaceholders({
  libDir,
  postTags,
  scenes,
  outDir,
  post,
}) {
  const approved = loadApprovedItems(libDir);
  const tags = Array.isArray(postTags) ? postTags : parseTagList(postTags);
  const primary = primaryTopicTag(tags);
  const countyTags = tags.filter(isCountyTag);
  const used = new Set();
  const results = [];
  const list = Array.isArray(scenes) ? scenes : [];

  for (let i = 0; i < list.length; i++) {
    const entry = typeof list[i] === "string" ? { scene: list[i], alt: "" } : list[i];
    const scene = entry.scene || entry.alt || "";
    const kk = pad2(i + 1);
    const nn = pad2(post);
    const filename = `post-${nn}-img-${kk}.png`;
    const index = kk;

    if (!primary) {
      results.push({ index, engine: "miss", filename, reason: "no_primary_topic" });
      continue;
    }

    const pool = approved.filter((it) => {
      if (used.has(it.id)) return false;
      return (it.approved_tags || []).includes(primary);
    });

    if (!pool.length) {
      results.push({
        index,
        engine: "miss",
        filename,
        reason: "no_topic_candidate",
      });
      continue;
    }

    pool.sort(
      (a, b) =>
        scoreCandidate(b, scene, countyTags) - scoreCandidate(a, scene, countyTags),
    );
    const pick = pool[0];
    used.add(pick.id);
    const outPath = path.join(outDir, filename);
    const src = path.join(libDir, pick.rel_path);
    copyAsPng(src, outPath);
    results.push({
      index,
      engine: "library",
      id: pick.id,
      filename,
      out_path: outPath,
      approved_tags: pick.approved_tags,
    });
  }

  return { primary_topic: primary, results };
}

function loadScenes(extra) {
  if (extra["scenes-json"]) {
    const p = path.resolve(extra["scenes-json"]);
    return JSON.parse(fs.readFileSync(p, "utf8"));
  }
  if (extra.scenes) return JSON.parse(extra.scenes);
  return [];
}

function main() {
  const args = parseCampaignArgs(process.argv);
  if (args.help) {
    console.log(
      "Usage: node match-library.mjs --campaign-dir <path> --post-tags \"A, B\" --scenes-json scenes.json --out-dir <3.5-images> --post N",
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
  const postTags = args.extra["post-tags"] || "";
  const outDir = args.extra["out-dir"];
  const post = Number(args.extra.post || 0);
  if (!outDir || !post) {
    console.error("Required: --post-tags, --scenes-json, --out-dir, --post");
    process.exit(1);
  }
  const scenes = loadScenes(args.extra);
  const libDir = libraryDir(dirs.pipelineDir);
  const result = matchPlaceholders({
    libDir,
    postTags,
    scenes,
    outDir: path.resolve(outDir),
    post,
  });
  console.log(JSON.stringify({ ok: true, campaign_dir: dirs.campaignDir, ...result }, null, 2));
}

if (process.argv[1] && process.argv[1].endsWith("match-library.mjs")) {
  main();
}
