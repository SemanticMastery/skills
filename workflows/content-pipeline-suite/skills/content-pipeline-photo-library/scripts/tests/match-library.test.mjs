#!/usr/bin/env node
/**
 * U5 — executable 3.5 matching. AE4/AE5, no intra-post reuse.
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

const MATCH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "match-library.mjs",
);

function seedApproved(campaignDir, pipelineDir, photos) {
  const libDir = libraryDir(pipelineDir);
  ensureLibraryTree(libDir);
  const items = photos.map((p) => {
    fs.writeFileSync(path.join(libDir, "approved", `${p.id}.png`), PNG_1x1);
    return {
      id: p.id,
      rel_path: `approved/${p.id}.png`,
      source_url: "https://example.com/" + p.id,
      source_platform: "instagram",
      scraper: "instagram-post-scraper",
      downloaded_at: "2026-08-13T00:00:00.000Z",
      sha256: (p.hash || p.id).padEnd(64, "0").slice(0, 64),
      source_media_id: p.id,
      proposed_tags: p.tags,
      approved_tags: p.tags,
      confidence: 0.9,
      flags: emptyFlags(),
      status: "approved",
      caption: p.caption || "",
      scene: p.scene || "",
      rights_notes: "page-owned",
    };
  });
  saveManifest(libDir, {
    schema_version: 1,
    skill: "content-pipeline-photo-library",
    campaign_dir: campaignDir,
    pipeline_dir: pipelineDir,
    updated_at: "2026-08-13T00:00:00.000Z",
    items,
  });
  return libDir;
}

function runMatch(campaignDir, { postTags, scenes, outDir, post }) {
  const scenesFile = path.join(path.dirname(outDir), "scenes.json");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(scenesFile, JSON.stringify(scenes), "utf8");
  const r = spawnSync(
    process.execPath,
    [
      MATCH,
      "--campaign-dir",
      campaignDir,
      "--post-tags",
      postTags,
      "--scenes-json",
      scenesFile,
      "--out-dir",
      outDir,
      "--post",
      String(post),
    ],
    { encoding: "utf8" },
  );
  let parsed = null;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    parsed = { raw: r.stdout };
  }
  return { r, parsed };
}

await test("AE4: Emergencies + Summit County copies the Emergencies photo for placeholder 01", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u5-ae4");
  try {
    seedApproved(campaignDir, pipelineDir, [
      {
        id: "ig_em",
        tags: ["Emergencies", "Summit County"],
        caption: "storm damage cleanup",
        scene: "hazardous limb after storm",
      },
    ]);
    const outDir = path.join(pipelineDir, "03-write", "3.5-images");
    const { r, parsed } = runMatch(campaignDir, {
      postTags: "Emergencies, Summit County",
      scenes: [
        { scene: "hazardous limb after a storm", alt: "storm" },
        { scene: "quiet lot after work", alt: "after" },
      ],
      outDir,
      post: 2,
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.equal(parsed.results[0].engine, "library");
    assert.equal(parsed.results[0].id, "ig_em");
    assert.equal(parsed.results[0].filename, "post-02-img-01.png");
    assert.ok(fs.existsSync(path.join(outDir, "post-02-img-01.png")));
  } finally {
    rmrf(root);
  }
});

await test("AE5: Land Clearing library vs Tree Diseases post misses every placeholder", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u5-ae5");
  try {
    seedApproved(campaignDir, pipelineDir, [
      { id: "ig_lc", tags: ["Land Clearing"], caption: "lot clearing", scene: "cleared lot" },
    ]);
    const outDir = path.join(pipelineDir, "03-write", "3.5-images");
    const { r, parsed } = runMatch(campaignDir, {
      postTags: "Tree Diseases",
      scenes: [
        { scene: "oak wilt canopy", alt: "oak" },
        { scene: "healthy yard after treatment", alt: "yard" },
      ],
      outDir,
      post: 3,
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.equal(parsed.results.length, 2);
    assert.ok(parsed.results.every((x) => x.engine === "miss"));
    assert.equal(fs.existsSync(path.join(outDir, "post-03-img-01.png")), false);
  } finally {
    rmrf(root);
  }
});

await test("edge: two placeholders do not receive the same library file", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u5-reuse");
  try {
    seedApproved(campaignDir, pipelineDir, [
      { id: "ig_only", tags: ["Emergencies"], caption: "storm", scene: "storm crew" },
    ]);
    const outDir = path.join(pipelineDir, "03-write", "3.5-images");
    const { r, parsed } = runMatch(campaignDir, {
      postTags: "Emergencies",
      scenes: [
        { scene: "storm crew", alt: "a" },
        { scene: "storm crew driveway", alt: "b" },
      ],
      outDir,
      post: 4,
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const libs = parsed.results.filter((x) => x.engine === "library");
    assert.equal(libs.length, 1);
    assert.equal(parsed.results.filter((x) => x.engine === "miss").length, 1);
    const ids = libs.map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length);
  } finally {
    rmrf(root);
  }
});

await test("edge: county-only approved photo does not satisfy a topic-tagged post", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u5-county");
  try {
    seedApproved(campaignDir, pipelineDir, [
      { id: "ig_geo", tags: ["Summit County"], caption: "Fairview street", scene: "street" },
    ]);
    const outDir = path.join(pipelineDir, "03-write", "3.5-images");
    const { r, parsed } = runMatch(campaignDir, {
      postTags: "Tree Pruning, Summit County",
      scenes: [{ scene: "pruning in Fairview", alt: "prune" }],
      outDir,
      post: 5,
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.equal(parsed.results[0].engine, "miss");
  } finally {
    rmrf(root);
  }
});

await test("integration: copy output is 3.5-images/post-NN-img-KK.png", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u5-path");
  try {
    seedApproved(campaignDir, pipelineDir, [
      { id: "ig_path", tags: ["Tree Care"], caption: "inspection", scene: "inspection" },
    ]);
    const outDir = path.join(pipelineDir, "03-write", "3.5-images");
    const { r, parsed } = runMatch(campaignDir, {
      postTags: "Tree Care",
      scenes: [{ scene: "inspection walkthrough", alt: "inspect" }],
      outDir,
      post: 6,
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.equal(parsed.results[0].filename, "post-06-img-01.png");
    const expected = path.join(outDir, "post-06-img-01.png");
    assert.equal(parsed.results[0].out_path, expected);
    assert.ok(fs.existsSync(expected));
    assert.ok(!String(parsed.results[0].out_path).includes("image-library"));
  } finally {
    rmrf(root);
  }
});

if (process.exitCode) process.exit(process.exitCode);
