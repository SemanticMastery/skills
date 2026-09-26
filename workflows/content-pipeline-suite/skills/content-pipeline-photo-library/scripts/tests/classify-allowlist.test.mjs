#!/usr/bin/env node
/**
 * U3 — allowlist classification. Subset of campaign tags; missing taxonomy exits.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  BOX_ALLOWLIST,
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
  loadManifest,
  saveManifest,
} from "../lib/library.mjs";

const CLASSIFY = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "classify.mjs",
);

function seedInbox(campaignDir, pipelineDir, itemOverrides = {}) {
  const libDir = libraryDir(pipelineDir);
  ensureLibraryTree(libDir);
  writeCampaignClassifier(pipelineDir);
  fs.writeFileSync(path.join(libDir, "sources.md"), "# sources\n", "utf8");
  const id = itemOverrides.id || "ig_prune1";
  fs.writeFileSync(path.join(libDir, "inbox", `${id}.png`), PNG_1x1);
  const item = {
    id,
    rel_path: `inbox/${id}.png`,
    source_url: "https://www.instagram.com/p/prune/",
    source_platform: "instagram",
    scraper: "instagram-post-scraper",
    downloaded_at: "2026-08-13T00:00:00.000Z",
    sha256: "c".repeat(64),
    source_media_id: "prune1",
    proposed_tags: [],
    approved_tags: [],
    confidence: null,
    flags: emptyFlags(),
    status: "inbox",
    caption: itemOverrides.caption ?? "Pruning oaks",
    scene: "",
    rights_notes: "page-owned",
    ...itemOverrides,
    id,
    rel_path: `inbox/${id}.png`,
    status: "inbox",
  };
  saveManifest(libDir, {
    schema_version: 1,
    skill: "content-pipeline-photo-library",
    campaign_dir: campaignDir,
    pipeline_dir: pipelineDir,
    updated_at: "2026-08-13T00:00:00.000Z",
    items: [item],
  });
  return { libDir, id };
}

function runClassify(campaignDir, classificationsPath) {
  const args = [CLASSIFY, "--campaign-dir", campaignDir];
  if (classificationsPath) args.push("--classifications", classificationsPath);
  return spawnSync(process.execPath, args, { encoding: "utf8" });
}

await test("happy: Tree Pruning from model stays Tree Pruning", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u3-happy");
  try {
    const { libDir, id } = seedInbox(campaignDir, pipelineDir);
    const stub = path.join(root, "classifications.json");
    fs.writeFileSync(
      stub,
      JSON.stringify({
        [id]: {
          tags: ["Tree Pruning"],
          confidence: 0.92,
          flags: { has_text: false, has_logo: false, likely_ugc: false, has_people: true },
          scene: "crew pruning canopy",
        },
      }),
      "utf8",
    );
    const r = runClassify(campaignDir, stub);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const manifest = loadManifest(libDir);
    const item = manifest.items[0];
    assert.equal(item.status, "review");
    assert.deepEqual(item.proposed_tags, ["Tree Pruning"]);
    assert.ok(item.proposed_tags.every((t) => BOX_ALLOWLIST.includes(t)));
    assert.ok(fs.existsSync(path.join(libDir, "review", `${id}.png`)));
    assert.equal(fs.existsSync(path.join(libDir, "inbox", `${id}.png`)), false);
    const queue = fs.readFileSync(path.join(libDir, "review-queue.md"), "utf8");
    assert.match(queue, new RegExp(id));
    assert.match(queue, /review\//);
  } finally {
    rmrf(root);
  }
});

await test("edge: singular Emergency is dropped, not coerced to Emergencies", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u3-drop");
  try {
    const { libDir, id } = seedInbox(campaignDir, pipelineDir, { id: "ig_em1" });
    const stub = path.join(root, "classifications.json");
    fs.writeFileSync(
      stub,
      JSON.stringify({
        [id]: { tags: ["Emergency", "Tree Care"], confidence: 0.5, scene: "storm" },
      }),
      "utf8",
    );
    const r = runClassify(campaignDir, stub);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const item = loadManifest(libDir).items[0];
    assert.ok(!item.proposed_tags.includes("Emergency"));
    assert.ok(!item.proposed_tags.includes("Emergencies"));
    assert.deepEqual(item.proposed_tags, ["Tree Care"]);
  } finally {
    rmrf(root);
  }
});

await test("edge: empty county when caption has no city is valid", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u3-nogeo");
  try {
    const { libDir, id } = seedInbox(campaignDir, pipelineDir, {
      id: "ig_nogeo",
      caption: "A clean pruning cut on a live oak",
    });
    const stub = path.join(root, "classifications.json");
    fs.writeFileSync(
      stub,
      JSON.stringify({
        [id]: { tags: ["Tree Pruning"], confidence: 0.8, scene: "pruning cut" },
      }),
      "utf8",
    );
    const r = runClassify(campaignDir, stub);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const item = loadManifest(libDir).items[0];
    assert.ok(!item.proposed_tags.includes("Summit County"));
    assert.ok(!item.proposed_tags.includes("Valley County"));
    assert.deepEqual(item.proposed_tags, ["Tree Pruning"]);
  } finally {
    rmrf(root);
  }
});

await test("edge: model county tags are dropped unless caption city maps", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u3-nogeo-model");
  try {
    const { libDir, id } = seedInbox(campaignDir, pipelineDir, {
      id: "ig_geoguess",
      caption: "A clean pruning cut on a live oak",
    });
    const stub = path.join(root, "classifications.json");
    fs.writeFileSync(
      stub,
      JSON.stringify({
        [id]: {
          tags: ["Tree Pruning", "Valley County"],
          confidence: 0.8,
          scene: "pruning cut",
        },
      }),
      "utf8",
    );
    const r = runClassify(campaignDir, stub);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const item = loadManifest(libDir).items[0];
    assert.ok(!item.proposed_tags.includes("Valley County"));
    assert.deepEqual(item.proposed_tags, ["Tree Pruning"]);
  } finally {
    rmrf(root);
  }
});

await test("error: missing taxonomy file exits non-zero", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u3-notax");
  try {
    seedInbox(campaignDir, pipelineDir, { id: "ig_x" });
    fs.unlinkSync(
      path.join(pipelineDir, "02-plan", "siteswarm-tag-taxonomy.md"),
    );
    const r = runClassify(campaignDir, path.join(root, "missing.json"));
    assert.notEqual(r.status, 0);
    const msg = `${r.stdout}\n${r.stderr}`;
    assert.match(msg, /taxonomy/i);
  } finally {
    rmrf(root);
  }
});

await test("AE2: pruning fixture proposes Tree Pruning and only allowlist strings", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u3-ae2");
  try {
    const { libDir, id } = seedInbox(campaignDir, pipelineDir, {
      id: "ig_ae2",
      caption: "Crown reduction pruning in Fairview",
    });
    const stub = path.join(root, "classifications.json");
    fs.writeFileSync(
      stub,
      JSON.stringify({
        [id]: {
          tags: ["Tree Pruning", "Made Up Tag"],
          confidence: 0.88,
          scene: "crown reduction",
        },
      }),
      "utf8",
    );
    const r = runClassify(campaignDir, stub);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const item = loadManifest(libDir).items[0];
    assert.ok(item.proposed_tags.includes("Tree Pruning"));
    assert.ok(item.proposed_tags.includes("Summit County"));
    assert.ok(item.proposed_tags.every((t) => BOX_ALLOWLIST.includes(t)));
  } finally {
    rmrf(root);
  }
});

await test("omit: off_topic flag goes to rejected, not review", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u3-offtopic");
  try {
    const { libDir, id } = seedInbox(campaignDir, pipelineDir, {
      id: "fb_soccer",
      caption: "",
    });
    const stub = path.join(root, "classifications.json");
    fs.writeFileSync(
      stub,
      JSON.stringify({
        [id]: {
          tags: ["Tree Care"],
          confidence: 0.4,
          flags: { off_topic: true, has_people: true },
          scene: "soccer team",
        },
      }),
      "utf8",
    );
    const r = runClassify(campaignDir, stub);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const summary = JSON.parse(r.stdout);
    assert.equal(summary.omitted, 1);
    assert.equal(summary.classified, 0);
    const item = loadManifest(libDir).items[0];
    assert.equal(item.status, "rejected");
    assert.equal(item.rights_notes, "off_topic");
    assert.deepEqual(item.proposed_tags, []);
    assert.equal(item.rel_path, "");
    assert.equal(fs.existsSync(path.join(libDir, "rejected", `${id}.png`)), false);
    assert.equal(fs.existsSync(path.join(libDir, "review", `${id}.png`)), false);
    assert.equal(fs.existsSync(path.join(libDir, "inbox", `${id}.png`)), false);
    const queue = fs.readFileSync(path.join(libDir, "review-queue.md"), "utf8");
    assert.doesNotMatch(queue, new RegExp(id));
  } finally {
    rmrf(root);
  }
});

await test("omit: donate caption is ephemeral even if the model misses the flag", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u3-ephemeral");
  try {
    const { libDir, id } = seedInbox(campaignDir, pipelineDir, {
      id: "fb_venmo",
      caption: "Donate via Venmo @ridgelinetrees. All funds are allocated to the community.",
    });
    const stub = path.join(root, "classifications.json");
    fs.writeFileSync(
      stub,
      JSON.stringify({
        [id]: {
          tags: ["Emergencies", "Tree Care"],
          confidence: 0.7,
          flags: { has_text: true, has_logo: true },
          scene: "fundraising overlay",
        },
      }),
      "utf8",
    );
    const r = runClassify(campaignDir, stub);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const item = loadManifest(libDir).items[0];
    assert.equal(item.status, "rejected");
    assert.equal(item.rights_notes, "ephemeral_promo");
    assert.equal(item.rel_path, "");
    assert.equal(fs.existsSync(path.join(libDir, "rejected", `${id}.png`)), false);
    assert.equal(fs.existsSync(path.join(libDir, "inbox", `${id}.png`)), false);
  } finally {
    rmrf(root);
  }
});

await test("omit: leftover .bin inbox files are rejected, not classified", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u3-bin");
  try {
    const libDir = libraryDir(pipelineDir);
    ensureLibraryTree(libDir);
    writeCampaignClassifier(pipelineDir);
    fs.writeFileSync(path.join(libDir, "sources.md"), "# sources\n", "utf8");
    const id = "facebook_leftover";
    fs.writeFileSync(path.join(libDir, "inbox", `${id}.bin`), "<html>not an image</html>");
    saveManifest(libDir, {
      schema_version: 1,
      skill: "content-pipeline-photo-library",
      campaign_dir: campaignDir,
      pipeline_dir: pipelineDir,
      updated_at: "2026-08-13T00:00:00.000Z",
      items: [
        {
          id,
          rel_path: `inbox/${id}.bin`,
          source_url: "https://www.facebook.com/photo/?fbid=1",
          source_platform: "facebook",
          scraper: "facebook-profile-posts-scraper",
          downloaded_at: "2026-08-13T00:00:00.000Z",
          sha256: "d".repeat(64),
          source_media_id: "leftover-1",
          proposed_tags: [],
          approved_tags: [],
          confidence: null,
          flags: emptyFlags(),
          status: "inbox",
          caption: "Storm work",
          scene: "",
          rights_notes: "page-owned",
        },
      ],
    });
    const stub = path.join(root, "classifications.json");
    fs.writeFileSync(
      stub,
      JSON.stringify({
        [id]: {
          tags: ["Tree Care"],
          confidence: 0.9,
          flags: {},
          scene: "should never run",
        },
      }),
      "utf8",
    );
    const r = runClassify(campaignDir, stub);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const summary = JSON.parse(r.stdout);
    assert.equal(summary.omitted, 1);
    assert.equal(summary.classified, 0);
    const item = loadManifest(libDir).items[0];
    assert.equal(item.status, "rejected");
    assert.equal(item.rights_notes, "not_image");
    assert.equal(item.rel_path, "");
    assert.equal(fs.existsSync(path.join(libDir, "inbox", `${id}.bin`)), false);
    assert.equal(fs.existsSync(path.join(libDir, "review", `${id}.bin`)), false);
  } finally {
    rmrf(root);
  }
});

if (process.exitCode) process.exit(process.exitCode);
