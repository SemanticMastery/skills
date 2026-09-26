#!/usr/bin/env node
/**
 * U2 — ingest dedup. Hash/source-id dedup and rejected skip.
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
  ensureLibraryTree,
  libraryDir,
  loadManifest,
  saveManifest,
} from "../lib/library.mjs";
import { skipReason } from "../ingest.mjs";

const INGEST = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "ingest.mjs",
);

function writeSources(pipelineDir, extra = "") {
  const p = path.join(pipelineDir, "01-resources", "image-library");
  fs.mkdirSync(p, { recursive: true });
  fs.writeFileSync(
    path.join(p, "sources.md"),
    `# Photo library sources\n\n| platform | url | notes |\n|----------|-----|-------|\n| instagram | https://www.instagram.com/example | fixture |\n${extra}`,
    "utf8",
  );
}

function runIngest(campaignDir, payloadsPath) {
  const args = [INGEST, "--campaign-dir", campaignDir];
  if (payloadsPath) args.push("--payloads", payloadsPath);
  return spawnSync(process.execPath, args, { encoding: "utf8" });
}

await test("happy: two records with the same sha256 produce one inbox file", () => {
  const { root, campaignDir, pipelineDir, publishDir } = makeTempCampaign("u2-hash");
  try {
    writeSources(pipelineDir);
    const mediaA = path.join(root, "a.png");
    const mediaB = path.join(root, "b.png");
    fs.writeFileSync(mediaA, PNG_1x1);
    fs.writeFileSync(mediaB, PNG_1x1);
    const payloads = path.join(root, "payloads.json");
    fs.writeFileSync(
      payloads,
      JSON.stringify({
        records: [
          {
            source_platform: "instagram",
            scraper: "instagram-post-scraper",
            source_url: "https://www.instagram.com/p/aaa/",
            source_media_id: "media-a",
            media_url: mediaA,
            caption: "one",
          },
          {
            source_platform: "instagram",
            scraper: "instagram-post-scraper",
            source_url: "https://www.instagram.com/p/bbb/",
            source_media_id: "media-b",
            media_url: mediaB,
            caption: "two",
          },
        ],
      }),
      "utf8",
    );
    const r = runIngest(campaignDir, payloads);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const libDir = libraryDir(pipelineDir);
    const inbox = fs.readdirSync(path.join(libDir, "inbox"));
    assert.equal(inbox.length, 1, `expected 1 inbox file, got ${inbox.join(",")}`);
    const manifest = loadManifest(libDir);
    const inboxItems = manifest.items.filter((i) => i.status === "inbox");
    assert.equal(inboxItems.length, 1);
  } finally {
    rmrf(root);
  }
});

await test("edge: rejected source_media_id on refresh does not re-enter review", () => {
  const { root, campaignDir, pipelineDir, publishDir } = makeTempCampaign("u2-rej");
  try {
    writeSources(pipelineDir);
    const libDir = libraryDir(pipelineDir);
    ensureLibraryTree(libDir);
    saveManifest(libDir, {
      schema_version: 1,
      skill: "content-pipeline-photo-library",
      campaign_dir: campaignDir,
      pipeline_dir: pipelineDir,
      updated_at: "2026-08-13T00:00:00.000Z",
      items: [
        {
          id: "ig_skip-me",
          rel_path: "rejected/ig_skip-me.png",
          source_url: "https://www.instagram.com/p/skip/",
          source_platform: "instagram",
          scraper: "instagram-post-scraper",
          downloaded_at: "2026-08-01T00:00:00.000Z",
          sha256: "b".repeat(64),
          source_media_id: "skip-me",
          proposed_tags: [],
          approved_tags: [],
          confidence: null,
          flags: {
            has_text: false,
            has_logo: false,
            likely_ugc: false,
            has_people: false,
          },
          status: "rejected",
          caption: "",
          scene: "",
          rights_notes: "rejected",
        },
      ],
    });
    fs.writeFileSync(path.join(libDir, "rejected", "ig_skip-me.png"), PNG_1x1);
    const media = path.join(root, "fresh.png");
    fs.writeFileSync(media, PNG_1x1);
    const payloads = path.join(root, "payloads.json");
    fs.writeFileSync(
      payloads,
      JSON.stringify({
        records: [
          {
            source_platform: "instagram",
            scraper: "instagram-post-scraper",
            source_url: "https://www.instagram.com/p/skip/",
            source_media_id: "skip-me",
            media_url: media,
            caption: "should not return",
          },
        ],
      }),
      "utf8",
    );
    const r = runIngest(campaignDir, payloads);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const manifest = loadManifest(libDir);
    const skip = manifest.items.find((i) => i.source_media_id === "skip-me");
    assert.equal(skip.status, "rejected");
    assert.equal(manifest.items.filter((i) => i.status === "review").length, 0);
    assert.equal(manifest.items.filter((i) => i.status === "inbox").length, 0);
  } finally {
    rmrf(root);
  }
});

await test("error: missing sources.md hard-stops with an operator-facing reason", () => {
  const { root, campaignDir } = makeTempCampaign("u2-nosrc");
  try {
    const r = runIngest(campaignDir, null);
    assert.notEqual(r.status, 0);
    const msg = `${r.stdout}\n${r.stderr}`;
    assert.match(msg, /sources\.md/i);
  } finally {
    rmrf(root);
  }
});

await test("skip: GBP posts and stock never enter inbox", () => {
  assert.equal(
    skipReason({
      source_platform: "gbp",
      scraper: "dataforseo-my-business-updates",
      source_url: "https://search.google.com/local/posts?q=Ridgeline",
      media_url: "https://lh3.googleusercontent.com/geougc/AF1QipX=s1600",
    }),
    "gbp_post",
  );
  assert.equal(
    skipReason({
      source_platform: "gbp",
      is_gbp_post: true,
      media_url: "https://lh3.googleusercontent.com/gps-cs/AH1=s1600",
    }),
    "gbp_post",
  );
  assert.equal(
    skipReason({
      source_platform: "gbp",
      is_stock: true,
      photo_category: "by_owner",
      media_url: "https://example.com/stock.jpg",
    }),
    "stock",
  );
  assert.equal(
    skipReason({
      source_platform: "gbp",
      photo_category: "by_customers",
      media_url: "https://lh3.googleusercontent.com/gps-cs/AH1=s1600",
    }),
    "gbp_not_owner",
  );
  assert.equal(
    skipReason({
      source_platform: "gbp",
      photo_category: "by_owner",
      media_url: "https://lh3.googleusercontent.com/gps-cs/AH1=s1600",
      source_url: "https://www.google.com/maps/contrib/123/photos",
    }),
    null,
  );
});

await test("skip: ingest CLI drops a GBP post payload without writing inbox", () => {
  const { root, campaignDir, pipelineDir, publishDir } = makeTempCampaign("u2-gbppost");
  try {
    writeSources(pipelineDir);
    const media = path.join(root, "post.png");
    fs.writeFileSync(media, PNG_1x1);
    const payloads = path.join(root, "payloads.json");
    fs.writeFileSync(
      payloads,
      JSON.stringify({
        records: [
          {
            source_platform: "gbp",
            scraper: "dataforseo-my-business-updates",
            source_url: "https://search.google.com/local/posts?q=Ridgeline",
            source_media_id: "post-1",
            media_url: media,
            caption: "Brookfield promo",
          },
          {
            source_platform: "gbp",
            scraper: "context.dev-web-scrape-images",
            source_url: "https://www.google.com/maps/contrib/123/photos",
            source_media_id: "owner-1",
            media_url: media,
            caption: "By owner still",
            photo_category: "by_owner",
          },
        ],
      }),
      "utf8",
    );
    const r = runIngest(campaignDir, payloads);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const summary = JSON.parse(r.stdout);
    assert.equal(summary.added, 1);
    assert.equal(summary.skipped_gbp_post, 1);
    const libDir = libraryDir(pipelineDir);
    const inbox = fs.readdirSync(path.join(libDir, "inbox"));
    assert.equal(inbox.length, 1);
    const manifest = loadManifest(libDir);
    assert.equal(manifest.items[0].source_media_id, "owner-1");
    assert.equal(manifest.items[0].photo_category, "by_owner");
  } finally {
    rmrf(root);
  }
});

await test("skip: fundraising captions and off-topic flags never enter inbox", () => {
  assert.equal(
    skipReason({
      source_platform: "facebook",
      caption:
        "Donate via Venmo @ridgelinetrees. All funds are allocated directly to the community.",
    }),
    "ephemeral_promo",
  );
  assert.equal(
    skipReason({
      source_platform: "facebook",
      is_ephemeral_promo: true,
      caption: "Community update",
    }),
    "ephemeral_promo",
  );
  assert.equal(
    skipReason({
      source_platform: "facebook",
      is_off_topic: true,
      caption: "Soccer Saturday",
    }),
    "off_topic",
  );
  assert.equal(
    skipReason({
      source_platform: "facebook",
      caption: "Storm damage oak removal in Brookfield",
    }),
    null,
  );
});

await test("skip: ingest CLI drops a fundraising caption without writing inbox", () => {
  const { root, campaignDir, pipelineDir, publishDir } = makeTempCampaign("u2-fund");
  try {
    writeSources(pipelineDir);
    const media = path.join(root, "flyer.png");
    fs.writeFileSync(media, PNG_1x1);
    const payloads = path.join(root, "payloads.json");
    fs.writeFileSync(
      payloads,
      JSON.stringify({
        records: [
          {
            source_platform: "facebook",
            scraper: "facebook-profile-posts-scraper",
            source_url: "https://www.facebook.com/photo/?fbid=1",
            source_media_id: "fund-1",
            media_url: media,
            caption: "Donate via Venmo @ridgelinetrees. All funds are allocated to Cedar Creek.",
          },
          {
            source_platform: "facebook",
            scraper: "facebook-profile-posts-scraper",
            source_url: "https://www.facebook.com/photo/?fbid=2",
            source_media_id: "job-1",
            media_url: media,
            caption: "Live oak pruning in Fairview",
          },
        ],
      }),
      "utf8",
    );
    const r = runIngest(campaignDir, payloads);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const summary = JSON.parse(r.stdout);
    assert.equal(summary.added, 1);
    assert.equal(summary.skipped_not_evergreen, 1);
    const libDir = libraryDir(pipelineDir);
    const inbox = fs.readdirSync(path.join(libDir, "inbox"));
    assert.equal(inbox.length, 1);
    const manifest = loadManifest(libDir);
    assert.equal(manifest.items[0].source_media_id, "job-1");
  } finally {
    rmrf(root);
  }
});

await test("integration: Instagram payload stores a local path, not the remote URL", () => {
  const { root, campaignDir, pipelineDir, publishDir } = makeTempCampaign("u2-ig");
  try {
    writeSources(pipelineDir);
    const media = path.join(root, "ig-post.png");
    fs.writeFileSync(media, PNG_1x1);
    const remoteLooking = "https://scontent.cdninstagram.com/v/t51.2885-15/expiring.jpg";
    const payloads = path.join(root, "payloads.json");
    fs.writeFileSync(
      payloads,
      JSON.stringify({
        records: [
          {
            source_platform: "instagram",
            scraper: "instagram-post-scraper",
            source_url: "https://www.instagram.com/p/SHORTCODE/",
            source_media_id: "17901234567890123",
            media_url: media,
            remote_media_url: remoteLooking,
            caption: "Oak pruning in Brookfield",
          },
        ],
      }),
      "utf8",
    );
    const r = runIngest(campaignDir, payloads);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const libDir = libraryDir(pipelineDir);
    const manifest = loadManifest(libDir);
    assert.equal(manifest.items.length, 1);
    const item = manifest.items[0];
    assert.ok(item.rel_path.startsWith("inbox/"));
    assert.equal(item.source_platform, "instagram");
    assert.notEqual(item.rel_path, remoteLooking);
    assert.ok(!/^https?:/i.test(item.rel_path));
    const abs = path.join(libDir, item.rel_path);
    assert.equal(fs.existsSync(abs), true);
    assert.ok(item.sha256);
    assert.ok(item.downloaded_at);
  } finally {
    rmrf(root);
  }
});

await test("skip: non-image bytes never write a .bin inbox file", () => {
  const { root, campaignDir, pipelineDir, publishDir } = makeTempCampaign("u2-bin");
  try {
    writeSources(pipelineDir);
    const html = path.join(root, "page.bin");
    const jpgNamedBin = path.join(root, "looks-like.bin");
    fs.writeFileSync(html, "<!DOCTYPE html><html><body>not a photo</body></html>");
    fs.writeFileSync(jpgNamedBin, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const payloads = path.join(root, "payloads.json");
    fs.writeFileSync(
      payloads,
      JSON.stringify({
        records: [
          {
            source_platform: "facebook",
            scraper: "facebook-profile-posts-scraper",
            source_url: "https://www.facebook.com/photo/?fbid=html",
            source_media_id: "html-1",
            media_url: html,
            caption: "Should not ingest",
          },
          {
            source_platform: "facebook",
            scraper: "facebook-profile-posts-scraper",
            source_url: "https://www.facebook.com/photo/?fbid=realjpg",
            source_media_id: "jpg-1",
            media_url: jpgNamedBin,
            caption: "JPEG magic still allowed",
          },
        ],
      }),
      "utf8",
    );
    const r = runIngest(campaignDir, payloads);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const summary = JSON.parse(r.stdout);
    assert.equal(summary.added, 1);
    assert.equal(summary.skipped_not_image, 1);
    const libDir = libraryDir(pipelineDir);
    const inbox = fs.readdirSync(path.join(libDir, "inbox"));
    assert.equal(inbox.length, 1);
    assert.equal(path.extname(inbox[0]), ".jpg");
    assert.equal(
      inbox.some((name) => path.extname(name) === ".bin"),
      false,
    );
    const manifest = loadManifest(libDir);
    const htmlItem = manifest.items.find((i) => i.source_media_id === "html-1");
    assert.equal(htmlItem.status, "rejected");
    assert.equal(htmlItem.rel_path, "");
    assert.equal(htmlItem.rights_notes, "not_image");
    const jpgItem = manifest.items.find((i) => i.source_media_id === "jpg-1");
    assert.equal(jpgItem.status, "inbox");
    assert.match(jpgItem.rel_path, /\.jpg$/);
  } finally {
    rmrf(root);
  }
});

if (process.exitCode) process.exit(process.exitCode);
