#!/usr/bin/env node
/**
 * Campaign classifier isolation: no shared business prompt.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  makeTempCampaign,
  rmrf,
  test,
  writeCampaignClassifier,
} from "./helpers.mjs";
import { campaignClassifierPath } from "../lib/library.mjs";
import { loadCampaignClassifier } from "../lib/classify-engine.mjs";
import { ingestRecords } from "../ingest.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CLASSIFY = path.join(DIR, "..", "classify.mjs");
const ENGINE = path.join(DIR, "..", "lib", "classify-engine.mjs");
const DISPATCH = CLASSIFY;

await test("error: missing campaign classify.mjs hard-stops", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("clf-missing");
  try {
    assert.equal(fs.existsSync(campaignClassifierPath(pipelineDir)), false);
    const r = spawnSync(process.execPath, [CLASSIFY, "--campaign-dir", campaignDir], {
      encoding: "utf8",
    });
    assert.notEqual(r.status, 0);
    const msg = `${r.stdout}\n${r.stderr}`;
    assert.match(msg, /Missing campaign classifier/i);
    assert.match(msg, /image-library/i);
  } finally {
    rmrf(root);
  }
});

await test("error: unedited template CLASSIFIER_READY=false hard-stops", () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("clf-template");
  try {
    writeCampaignClassifier(pipelineDir, { ready: false });
    const r = spawnSync(process.execPath, [CLASSIFY, "--campaign-dir", campaignDir], {
      encoding: "utf8",
    });
    assert.notEqual(r.status, 0);
    assert.match(`${r.stdout}\n${r.stderr}`, /unedited template/i);
  } finally {
    rmrf(root);
  }
});

await test("happy: two campaigns keep separate KEEP prompts", async () => {
  const a = makeTempCampaign("clf-a");
  const b = makeTempCampaign("clf-b");
  try {
    writeCampaignClassifier(a.pipelineDir, {
      keep: "crew pruning and job-site stills",
      offTopic: "anything not tree-care",
    });
    writeCampaignClassifier(b.pipelineDir, {
      keep: "showroom guitars and repair-bench stills",
      offTopic: "anything not guitar-shop",
    });
    const modA = await loadCampaignClassifier(a.pipelineDir);
    const modB = await loadCampaignClassifier(b.pipelineDir);
    const promptA = modA.buildClassifyPrompt({
      allowlist: ["Tree Pruning"],
      caption: "x",
    });
    const promptB = modB.buildClassifyPrompt({
      allowlist: ["Guitar Store"],
      caption: "x",
    });
    assert.match(promptA, /crew pruning/);
    assert.doesNotMatch(promptA, /showroom guitars/);
    assert.match(promptB, /showroom guitars/);
    assert.doesNotMatch(promptB, /crew pruning/);
    assert.notEqual(modA.KEEP, modB.KEEP);
  } finally {
    rmrf(a.root);
    rmrf(b.root);
  }
});

await test("happy: ingest seeds an unedited campaign classifier once", async () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("clf-seed");
  try {
    const lib = path.join(pipelineDir, "01-resources", "image-library");
    fs.mkdirSync(lib, { recursive: true });
    fs.writeFileSync(path.join(lib, "sources.md"), "# s\n", "utf8");
    await ingestRecords({ campaignDir, pipelineDir, records: [] });
    const dest = campaignClassifierPath(pipelineDir);
    assert.equal(fs.existsSync(dest), true);
    const src = fs.readFileSync(dest, "utf8");
    assert.match(src, /CLASSIFIER_READY = false/);
    assert.match(src, /\(edit\)/);
  } finally {
    rmrf(root);
  }
});

await test("happy: ingest does not overwrite an edited campaign classifier", async () => {
  const { root, campaignDir, pipelineDir } = makeTempCampaign("clf-keep");
  try {
    const lib = path.join(pipelineDir, "01-resources", "image-library");
    fs.mkdirSync(lib, { recursive: true });
    fs.writeFileSync(path.join(lib, "sources.md"), "# s\n", "utf8");
    writeCampaignClassifier(pipelineDir, {
      keep: "UNIQUE_KEEP_MARKER_XYZ",
    });
    await ingestRecords({ campaignDir, pipelineDir, records: [] });
    const src = fs.readFileSync(campaignClassifierPath(pipelineDir), "utf8");
    assert.match(src, /UNIQUE_KEEP_MARKER_XYZ/);
    assert.match(src, /CLASSIFIER_READY = true/);
  } finally {
    rmrf(root);
  }
});

await test("error: shared skill scripts contain no business KEEP prompt", () => {
  const dispatch = fs.readFileSync(DISPATCH, "utf8");
  const engine = fs.readFileSync(ENGINE, "utf8");
  for (const [label, src] of [
    ["classify.mjs", dispatch],
    ["classify-engine.mjs", engine],
  ]) {
    assert.doesNotMatch(src, /tree-care job or site still/i, label);
    assert.doesNotMatch(src, /Example Client Brand/i, label);
    assert.doesNotMatch(src, /showroom inventory/i, label);
    assert.doesNotMatch(src, /KEEP: crew at work/i, label);
  }
});

if (process.exitCode) process.exit(process.exitCode);
