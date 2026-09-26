#!/usr/bin/env node
/**
 * U6 — isolation + campaign_dir hard-stop.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  PNG_1x1,
  makeTempCampaign,
  rmrf,
  test,
} from "./helpers.mjs";
import {
  emptyFlags,
  ensureLibraryTree,
  libraryDir,
  saveManifest,
} from "../lib/library.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const MATCH = path.join(DIR, "..", "match-library.mjs");
const INGEST = path.join(DIR, "..", "ingest.mjs");
const CLASSIFY = path.join(DIR, "..", "classify.mjs");
const APPLY = path.join(DIR, "..", "apply-review.mjs");

await test("happy: matcher on a second empty campaign does not read the first campaign's approved files", () => {
  const box = makeTempCampaign("u6-box");
  const other = makeTempCampaign("u6-other");
  try {
    const boxLib = libraryDir(box.pipelineDir);
    ensureLibraryTree(boxLib);
    fs.writeFileSync(path.join(boxLib, "approved", "ig_secret.png"), PNG_1x1);
    saveManifest(boxLib, {
      schema_version: 1,
      skill: "content-pipeline-photo-library",
      campaign_dir: box.campaignDir,
      pipeline_dir: box.pipelineDir,
      updated_at: "2026-08-13T00:00:00.000Z",
      items: [
        {
          id: "ig_secret",
          rel_path: "approved/ig_secret.png",
          source_url: "https://example.com/secret",
          source_platform: "instagram",
          scraper: "instagram-post-scraper",
          downloaded_at: "2026-08-13T00:00:00.000Z",
          sha256: "f".repeat(64),
          source_media_id: "secret",
          proposed_tags: ["Emergencies"],
          approved_tags: ["Emergencies"],
          confidence: 1,
          flags: emptyFlags(),
          status: "approved",
          caption: "storm",
          scene: "storm",
          rights_notes: "",
        },
      ],
    });
    const outDir = path.join(other.pipelineDir, "03-write", "3.5-images");
    fs.mkdirSync(outDir, { recursive: true });
    const scenes = path.join(other.root, "scenes.json");
    fs.writeFileSync(
      scenes,
      JSON.stringify([{ scene: "storm damage", alt: "x" }]),
      "utf8",
    );
    const r = spawnSync(
      process.execPath,
      [
        MATCH,
        "--campaign-dir",
        other.campaignDir,
        "--post-tags",
        "Emergencies",
        "--scenes-json",
        scenes,
        "--out-dir",
        outDir,
        "--post",
        "9",
      ],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.results[0].engine, "miss");
    assert.equal(fs.existsSync(path.join(outDir, "post-09-img-01.png")), false);
    assert.equal(parsed.campaign_dir, other.campaignDir);
    assert.notEqual(parsed.campaign_dir, box.campaignDir);
  } finally {
    rmrf(box.root);
    rmrf(other.root);
  }
});

await test("error: skill scripts without campaign_dir hard-stop", () => {
  for (const script of [INGEST, CLASSIFY, APPLY, MATCH]) {
    const r = spawnSync(process.execPath, [script], { encoding: "utf8" });
    assert.notEqual(r.status, 0, path.basename(script));
    const msg = `${r.stdout}\n${r.stderr}`;
    assert.match(msg, /campaign_dir/i, path.basename(script));
  }
});

if (process.exitCode) process.exit(process.exitCode);
