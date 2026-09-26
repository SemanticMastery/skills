#!/usr/bin/env node
/**
 * Dispatch only. Loads THIS campaign's image-library/classify.mjs prompt.
 * Hard-stops if that file is missing or still the unedited template.
 *
 * Usage:
 *   node classify.mjs --campaign-dir "C:\\...\\Campaign"
 *   node classify.mjs --campaign-dir "..." --classifications stub.json
 */
import fs from "node:fs";
import path from "node:path";
import { parseCampaignArgs, requireCampaignDir } from "./lib/campaign.mjs";
import { taxonomyPath as taxonomyFile } from "./lib/library.mjs";
import { loadTaxonomyFile } from "./lib/taxonomy.mjs";
import {
  classifyLibrary,
  loadCampaignClassifier,
} from "./lib/classify-engine.mjs";

function loadStub(file) {
  if (!file) return null;
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) {
    const err = new Error(`Classifications stub not found: ${abs}`);
    err.code = "MISSING_STUB";
    throw err;
  }
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

async function main() {
  const args = parseCampaignArgs(process.argv);
  if (args.help) {
    console.log(
      "Usage: node classify.mjs --campaign-dir <path> [--classifications <json>]",
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
  try {
    loadTaxonomyFile(taxonomyFile(dirs.pipelineDir));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  let campaignMod;
  try {
    campaignMod = await loadCampaignClassifier(dirs.pipelineDir);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  let stubMap = null;
  if (args.extra.classifications) {
    try {
      stubMap = loadStub(args.extra.classifications);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }
  try {
    const result = await classifyLibrary({
      campaignDir: dirs.campaignDir,
      pipelineDir: dirs.pipelineDir,
      stubMap,
      buildClassifyPrompt: campaignMod.buildClassifyPrompt,
    });
    console.log(JSON.stringify({ ok: true, ...result.summary }, null, 2));
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

if (process.argv[1] && path.basename(process.argv[1]) === "classify.mjs") {
  main();
}
