#!/usr/bin/env node
/**
 * U1 — library contract. Fixture manifest parses; missing library is empty;
 * tags outside the allowlist are invalid.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  BOX_ALLOWLIST,
  PNG_1x1,
  makeTempCampaign,
  rmrf,
  test,
} from "./helpers.mjs";
import {
  canonicalLibraryDir,
  labeledApprovedBasename,
  libraryDir,
  loadApprovedItems,
  loadManifest,
  taxonomyPath,
  uniqueFileStem,
  validateManifest,
} from "../lib/library.mjs";

const approvedRow = {
  id: "ig_123",
  rel_path: "approved/ig_123.png",
  source_url: "https://example.com/p/abc",
  source_platform: "instagram",
  scraper: "instagram-post-scraper",
  downloaded_at: "2026-08-13T15:00:00.000Z",
  sha256: "a".repeat(64),
  source_media_id: "123",
  proposed_tags: ["Tree Pruning"],
  approved_tags: ["Tree Pruning"],
  confidence: 0.9,
  flags: {
    has_text: false,
    has_logo: false,
    likely_ugc: false,
    has_people: true,
  },
  status: "approved",
  caption: "Crew pruning oaks in Fairview",
  scene: "crew pruning canopy",
  rights_notes: "page-owned Instagram post",
};

await test("happy: fixture approved row is readable by matcher helper", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("u1-happy");
  try {
    const libDir = path.join(pipelineDir, "01-resources", "image-library");
    const approvedDir = path.join(libDir, "approved");
    fs.mkdirSync(approvedDir, { recursive: true });
    fs.writeFileSync(path.join(approvedDir, "ig_123.png"), PNG_1x1);
    const manifest = {
      schema_version: 1,
      skill: "content-pipeline-photo-library",
      campaign_dir: campaignDir,
      pipeline_dir: pipelineDir,
      updated_at: "2026-08-13T15:00:00.000Z",
      items: [approvedRow],
    };
    fs.writeFileSync(
      path.join(libDir, "library-manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );
    const valid = validateManifest(manifest, { allowlist: BOX_ALLOWLIST });
    assert.equal(valid.ok, true, valid.errors?.join("; "));
    const approved = loadApprovedItems(libDir);
    assert.equal(approved.length, 1);
    assert.equal(approved[0].id, "ig_123");
    assert.equal(approved[0].status, "approved");
    assert.deepEqual(approved[0].approved_tags, ["Tree Pruning"]);
    assert.equal(approved[0].rel_path, "approved/ig_123.png");
  } finally {
    rmrf(root);
  }
});

await test("edge: missing image-library folder is empty, not a crash", () => {
  const { root, pipelineDir } = makeTempCampaign("u1-missing");
  try {
    const libDir = path.join(pipelineDir, "01-resources", "image-library");
    assert.equal(fs.existsSync(libDir), false);
    const approved = loadApprovedItems(libDir);
    assert.deepEqual(approved, []);
    const manifest = loadManifest(libDir);
    assert.equal(manifest.items.length, 0);
  } finally {
    rmrf(root);
  }
});

await test("error: tags outside fixture allowlist are invalid", () => {
  const bad = {
    schema_version: 1,
    skill: "content-pipeline-photo-library",
    campaign_dir: "/tmp/x",
    pipeline_dir: "/tmp/x/06-content-pipeline",
    updated_at: "2026-08-13T15:00:00.000Z",
    items: [
      {
        ...approvedRow,
        proposed_tags: ["Emergency"],
        approved_tags: ["Emergency"],
      },
    ],
  };
  const valid = validateManifest(bad, { allowlist: BOX_ALLOWLIST });
  assert.equal(valid.ok, false);
  assert.match(valid.errors.join("\n"), /Emergency/);
});

await test("happy: approved basename is topic-slug plus unique stem", () => {
  const facebook = labeledApprovedBasename(
    {
      source_platform: "facebook",
      source_media_id: "122120562308149608",
      approved_tags: ["Tree Pruning"],
    },
    ".jpg",
  );
  const gbp = labeledApprovedBasename(
    {
      source_platform: "gbp",
      source_media_id: "gbp_contrib_AH1DqX-qRzy4Lprf",
      approved_tags: ["Tree Care"],
    },
    ".jpg",
  );
  assert.equal(facebook, "tree-pruning_facebook_122120562308149608.jpg");
  assert.equal(gbp, "tree-care_gbp_contrib_AH1DqX-qRzy4Lprf.jpg");
  assert.equal(
    uniqueFileStem({ source_platform: "gbp", source_media_id: "gbp_contrib_AH1DqX-qRzy4Lprf" }),
    "gbp_contrib_AH1DqX-qRzy4Lprf",
  );
});

await test("edge: rejected item with empty rel_path is valid", () => {
  const purged = {
    ...approvedRow,
    status: "rejected",
    rel_path: "",
    approved_tags: [],
    proposed_tags: [],
  };
  const valid = validateManifest({ items: [purged] }, { allowlist: BOX_ALLOWLIST });
  assert.equal(valid.ok, true, valid.errors?.join("; "));
});

await test("edge: taxonomyPath prefers 02-plan then existing 04-publish", () => {
  const { root, pipelineDir, planDir, publishDir } = makeTempCampaign("u1-taxpath");
  try {
    const planTax = path.join(planDir, "siteswarm-tag-taxonomy.md");
    const pubTax = path.join(publishDir, "siteswarm-tag-taxonomy.md");
    assert.equal(taxonomyPath(pipelineDir), planTax);
    fs.unlinkSync(planTax);
    assert.equal(taxonomyPath(pipelineDir), planTax);
    fs.writeFileSync(pubTax, "# pub\n", "utf8");
    assert.equal(taxonomyPath(pipelineDir), pubTax);
    fs.writeFileSync(planTax, "# plan\n", "utf8");
    assert.equal(taxonomyPath(pipelineDir), planTax);
  } finally {
    rmrf(root);
  }
});

await test("edge: libraryDir prefers 01-resources and falls back to 04-publish", () => {
  const { root, pipelineDir } = makeTempCampaign("u1-libdir");
  try {
    assert.equal(libraryDir(pipelineDir), canonicalLibraryDir(pipelineDir));
    const legacy = path.join(pipelineDir, "04-publish", "image-library");
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, "sources.md"), "# legacy\n", "utf8");
    assert.equal(libraryDir(pipelineDir), legacy);
    const next = canonicalLibraryDir(pipelineDir);
    fs.mkdirSync(next, { recursive: true });
    fs.writeFileSync(path.join(next, "sources.md"), "# next\n", "utf8");
    assert.equal(libraryDir(pipelineDir), next);
  } finally {
    rmrf(root);
  }
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
