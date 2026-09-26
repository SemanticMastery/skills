#!/usr/bin/env node
/**
 * U4 — HITL apply-review. Approve/reject/retag; matcher ignores unapproved.
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
  writeCampaignClassifier,
} from "./helpers.mjs";
import {
  emptyFlags,
  ensureLibraryTree,
  libraryDir,
  loadApprovedItems,
  loadManifest,
  saveManifest,
} from "../lib/library.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPLY = path.join(DIR, "..", "apply-review.mjs");
const CLASSIFY = path.join(DIR, "..", "classify.mjs");
const INGEST = path.join(DIR, "..", "ingest.mjs");

function seedReview(campaignDir, pipelineDir, { id, flags, caption } = {}) {
  const libDir = libraryDir(pipelineDir);
  ensureLibraryTree(libDir);
  fs.writeFileSync(
    path.join(libDir, "sources.md"),
    "| platform | url |\n|----------|-----|\n| instagram | https://www.instagram.com/example |\n",
    "utf8",
  );
  const itemId = id || "ig_hitl1";
  fs.writeFileSync(path.join(libDir, "review", `${itemId}.png`), PNG_1x1);
  const item = {
    id: itemId,
    rel_path: `review/${itemId}.png`,
    source_url: "https://www.instagram.com/p/hitl/",
    source_platform: "instagram",
    scraper: "instagram-post-scraper",
    downloaded_at: "2026-08-13T00:00:00.000Z",
    sha256: "d".repeat(64),
    source_media_id: "hitl1",
    proposed_tags: ["Tree Pruning"],
    approved_tags: [],
    confidence: 0.8,
    flags: { ...emptyFlags(), ...(flags || {}) },
    status: "review",
    caption: caption || "pruning",
    scene: "pruning",
    rights_notes: "page-owned",
  };
  saveManifest(libDir, {
    schema_version: 1,
    skill: "content-pipeline-photo-library",
    campaign_dir: campaignDir,
    pipeline_dir: pipelineDir,
    updated_at: "2026-08-13T00:00:00.000Z",
    items: [item],
  });
  return { libDir, id: itemId };
}

function runApply(campaignDir, extraArgs) {
  return spawnSync(
    process.execPath,
    [APPLY, "--campaign-dir", campaignDir, ...extraArgs],
    { encoding: "utf8" },
  );
}

await test("happy: approve copies file to approved/ and sets status", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u4-ap");
  try {
    const { libDir, id } = seedReview(campaignDir, pipelineDir);
    const r = runApply(campaignDir, ["--approve", id]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const item = loadManifest(libDir).items[0];
    assert.equal(item.status, "approved");
    assert.deepEqual(item.approved_tags, ["Tree Pruning"]);
    assert.ok(fs.existsSync(path.join(libDir, "approved", "tree-pruning_instagram_hitl1.png")));
    assert.equal(item.rel_path, "approved/tree-pruning_instagram_hitl1.png");
    assert.equal(fs.existsSync(path.join(libDir, "review", `${id}.png`)), false);
  } finally {
    rmrf(root);
  }
});

await test("AE3: matcher helper with only review rows returns no candidates", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u4-ae3");
  try {
    const { libDir } = seedReview(campaignDir, pipelineDir, { id: "ig_pending" });
    const approved = loadApprovedItems(libDir);
    assert.deepEqual(approved, []);
  } finally {
    rmrf(root);
  }
});

await test("edge: retag to a non-allowlist string is rejected", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u4-badtag");
  try {
    const { libDir, id } = seedReview(campaignDir, pipelineDir, { id: "ig_bad" });
    const r = runApply(campaignDir, ["--retag", id, "--tags", "Emergency"]);
    assert.notEqual(r.status, 0);
    assert.match(`${r.stdout}\n${r.stderr}`, /allowlist|Emergency/i);
    const item = loadManifest(libDir).items[0];
    assert.equal(item.status, "review");
  } finally {
    rmrf(root);
  }
});

await test("happy: retag with allowlist tags yields approved file", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u4-retag");
  try {
    const { libDir, id } = seedReview(campaignDir, pipelineDir, { id: "ig_rt" });
    const r = runApply(campaignDir, [
      "--retag",
      id,
      "--tags",
      "Emergencies, Summit County",
    ]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const item = loadManifest(libDir).items[0];
    assert.equal(item.status, "approved");
    assert.deepEqual(item.approved_tags, ["Emergencies", "Summit County"]);
    assert.ok(fs.existsSync(path.join(libDir, "approved", "emergencies_instagram_hitl1.png")));
    assert.equal(item.rel_path, "approved/emergencies_instagram_hitl1.png");
  } finally {
    rmrf(root);
  }
});

await test("happy: requeue of purged reject forgets the hold so ingest can refetch", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u4-requeue");
  try {
    const { libDir, id } = seedReview(campaignDir, pipelineDir, { id: "ig_rq" });
    let r = runApply(campaignDir, ["--reject", id]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const rejected = loadManifest(libDir).items[0];
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.rel_path, "");
    assert.equal(fs.existsSync(path.join(libDir, "rejected", `${id}.png`)), false);
    assert.equal(fs.existsSync(path.join(libDir, "review", `${id}.png`)), false);

    r = runApply(campaignDir, ["--requeue", id]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.equal(loadManifest(libDir).items.length, 0);

    const media = path.join(root, "again.png");
    fs.writeFileSync(media, PNG_1x1);
    const payloads = path.join(root, "payloads.json");
    fs.writeFileSync(
      payloads,
      JSON.stringify({
        records: [
          {
            source_platform: "instagram",
            scraper: "instagram-post-scraper",
            source_url: "https://www.instagram.com/p/hitl/",
            source_media_id: "hitl1",
            media_url: media,
          },
        ],
      }),
      "utf8",
    );
    r = spawnSync(
      process.execPath,
      [INGEST, "--campaign-dir", campaignDir, "--payloads", payloads],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const items = loadManifest(libDir).items;
    assert.equal(items.filter((i) => i.source_media_id === "hitl1").length, 1);
    assert.equal(items[0].status, "inbox");
  } finally {
    rmrf(root);
  }
});

await test("error: classify.mjs never writes approved/", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u4-cl");
  try {
    const libDir = libraryDir(pipelineDir);
    ensureLibraryTree(libDir);
    writeCampaignClassifier(pipelineDir);
    fs.writeFileSync(path.join(libDir, "sources.md"), "# s\n", "utf8");
    const id = "ig_cl";
    fs.writeFileSync(path.join(libDir, "inbox", `${id}.png`), PNG_1x1);
    saveManifest(libDir, {
      schema_version: 1,
      skill: "content-pipeline-photo-library",
      campaign_dir: campaignDir,
      pipeline_dir: pipelineDir,
      updated_at: "2026-08-13T00:00:00.000Z",
      items: [
        {
          id,
          rel_path: `inbox/${id}.png`,
          source_url: "",
          source_platform: "instagram",
          scraper: "x",
          downloaded_at: "2026-08-13T00:00:00.000Z",
          sha256: "e".repeat(64),
          source_media_id: "cl1",
          proposed_tags: [],
          approved_tags: [],
          confidence: null,
          flags: emptyFlags(),
          status: "inbox",
          caption: "",
          scene: "",
          rights_notes: "",
        },
      ],
    });
    const stub = path.join(root, "c.json");
    fs.writeFileSync(
      stub,
      JSON.stringify({ [id]: { tags: ["Tree Care"], confidence: 1, scene: "x" } }),
      "utf8",
    );
    const r = spawnSync(
      process.execPath,
      [CLASSIFY, "--campaign-dir", campaignDir, "--classifications", stub],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const item = loadManifest(libDir).items[0];
    assert.equal(item.status, "review");
    assert.equal(fs.existsSync(path.join(libDir, "approved", `${id}.png`)), false);
    const src = fs.readFileSync(CLASSIFY, "utf8");
    assert.ok(!/status\s*=\s*["']approved["']/.test(src));
  } finally {
    rmrf(root);
  }
});

await test("AE6: has_text/has_logo composite can be rejected in one apply call", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u4-ae6");
  try {
    const { libDir, id } = seedReview(campaignDir, pipelineDir, {
      id: "ig_composite",
      flags: { has_text: true, has_logo: true },
      caption: "Call now promo collage",
    });
    const r = runApply(campaignDir, ["--reject", id]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const item = loadManifest(libDir).items[0];
    assert.equal(item.status, "rejected");
    assert.equal(item.rel_path, "");
    assert.equal(fs.existsSync(path.join(libDir, "rejected", `${id}.png`)), false);
    assert.equal(fs.existsSync(path.join(libDir, "review", `${id}.png`)), false);
  } finally {
    rmrf(root);
  }
});

await test("happy: comma-separated --reject applies to multiple ids", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u4-multirej");
  try {
    const { libDir } = seedReview(campaignDir, pipelineDir, { id: "ig_a" });
    fs.writeFileSync(path.join(libDir, "review", "ig_b.png"), PNG_1x1);
    const manifest = loadManifest(libDir);
    manifest.items.push({
      ...manifest.items[0],
      id: "ig_b",
      rel_path: "review/ig_b.png",
      source_media_id: "b",
      sha256: "e".repeat(64),
    });
    saveManifest(libDir, manifest);
    const r = runApply(campaignDir, ["--reject", "ig_a,ig_b"]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const after = loadManifest(libDir);
    assert.equal(after.items.every((i) => i.status === "rejected"), true);
    assert.equal(fs.existsSync(path.join(libDir, "rejected", "ig_a.png")), false);
    assert.equal(fs.existsSync(path.join(libDir, "rejected", "ig_b.png")), false);
    assert.equal(fs.existsSync(path.join(libDir, "review", "ig_a.png")), false);
    assert.equal(fs.existsSync(path.join(libDir, "review", "ig_b.png")), false);
  } finally {
    rmrf(root);
  }
});

await test("resume: review-queue.md still lists pending ids (manifest checkpoint)", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u4-resume");
  try {
    const { libDir, id } = seedReview(campaignDir, pipelineDir, { id: "ig_resume" });
    const r = spawnSync(
      process.execPath,
      [APPLY, "--campaign-dir", campaignDir, "--rewrite-queue"],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const queue = fs.readFileSync(path.join(libDir, "review-queue.md"), "utf8");
    assert.match(queue, /ig_resume/);
    const item = loadManifest(libDir).items.find((i) => i.id === id);
    assert.equal(item.status, "review");
  } finally {
    rmrf(root);
  }
});

await test("happy: approve labels Facebook and GBP files from the first topic tag", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u4-labels");
  try {
    const { libDir } = seedReview(campaignDir, pipelineDir, { id: "facebook_122120562308149608" });
    const manifest = loadManifest(libDir);
    manifest.items[0].source_platform = "facebook";
    manifest.items[0].source_media_id = "122120562308149608";
    manifest.items[0].proposed_tags = ["Tree Pruning"];
    const gbpId = "gbp_gbp_contrib_AH1DqX-qRzy4Lprf";
    fs.writeFileSync(path.join(libDir, "review", `${gbpId}.png`), PNG_1x1);
    manifest.items.push({
      ...manifest.items[0],
      id: gbpId,
      rel_path: `review/${gbpId}.png`,
      source_platform: "gbp",
      source_media_id: "gbp_contrib_AH1DqX-qRzy4Lprf",
      proposed_tags: ["Tree Care"],
      sha256: "f".repeat(64),
    });
    saveManifest(libDir, manifest);
    const r = runApply(campaignDir, [
      "--approve",
      "facebook_122120562308149608,gbp_gbp_contrib_AH1DqX-qRzy4Lprf",
    ]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const after = loadManifest(libDir);
    const fb = after.items.find((i) => i.source_platform === "facebook");
    const gbp = after.items.find((i) => i.source_platform === "gbp");
    assert.equal(fb.rel_path, "approved/tree-pruning_facebook_122120562308149608.png");
    assert.equal(gbp.rel_path, "approved/tree-care_gbp_contrib_AH1DqX-qRzy4Lprf.png");
    assert.ok(fs.existsSync(path.join(libDir, fb.rel_path)));
    assert.ok(fs.existsSync(path.join(libDir, gbp.rel_path)));
  } finally {
    rmrf(root);
  }
});

await test("happy: --relabel-approved and --purge-rejected backfill an existing library", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u4-backfill");
  try {
    const { libDir } = seedReview(campaignDir, pipelineDir, { id: "facebook_122120562308149608" });
    const rApprove = runApply(campaignDir, ["--approve", "facebook_122120562308149608"]);
    assert.equal(rApprove.status, 0, rApprove.stderr || rApprove.stdout);
    const manifest = loadManifest(libDir);
    const item = manifest.items[0];
    const oldName = "facebook_122120562308149608.png";
    fs.renameSync(path.join(libDir, item.rel_path), path.join(libDir, "approved", oldName));
    item.rel_path = `approved/${oldName}`;
    item.source_platform = "facebook";
    item.source_media_id = "122120562308149608";
    item.approved_tags = ["Tree Pruning"];
    const leftover = path.join(libDir, "rejected", "junk.jpg");
    fs.writeFileSync(leftover, PNG_1x1);
    saveManifest(libDir, manifest);

    const r = runApply(campaignDir, ["--relabel-approved", "--purge-rejected"]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const out = JSON.parse(r.stdout);
    assert.equal(out.relabeled, 1);
    assert.ok(out.purged >= 1);
    const after = loadManifest(libDir).items[0];
    assert.equal(after.rel_path, "approved/tree-pruning_facebook_122120562308149608.png");
    assert.ok(fs.existsSync(path.join(libDir, after.rel_path)));
    assert.equal(fs.existsSync(path.join(libDir, "approved", oldName)), false);
    assert.equal(fs.existsSync(leftover), false);
  } finally {
    rmrf(root);
  }
});

if (process.exitCode) process.exit(process.exitCode);
