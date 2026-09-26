#!/usr/bin/env node
/**
 * Confirm campaign-local 3.5-images helpers and the approved library count.
 * When this file lives under `{pipeline}/scripts/`, --campaign-dir is optional.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCampaignArgs, requireCampaignDir } from "./lib/campaign.mjs";
import { libraryDir, loadApprovedItems } from "./lib/library.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

function main() {
  const args = parseCampaignArgs(process.argv);
  if (args.help) {
    console.log("Usage: node check-helpers.mjs [--campaign-dir <path>]");
    process.exit(0);
  }
  if (!args.campaignDir && !args.pipelineDir) {
    const parent = path.resolve(here, "..");
    if (path.basename(parent) === "06-content-pipeline") {
      args.pipelineDir = parent;
    }
  }
  const dirs = requireCampaignDir(args);
  const matchLibrary = path.join(here, "match-library.mjs");
  const falGenerate = path.join(here, "fal-generate.mjs");
  const libDir = libraryDir(dirs.pipelineDir);
  const approved = loadApprovedItems(libDir);
  const missing = [matchLibrary, falGenerate].filter((p) => !fs.existsSync(p));
  const ok = missing.length === 0;
  console.log(
    JSON.stringify(
      {
        ok,
        campaign_dir: dirs.campaignDir,
        pipeline_dir: dirs.pipelineDir,
        helpers: {
          match_library: matchLibrary,
          fal_generate: falGenerate,
        },
        library_dir: libDir,
        approved_count: approved.length,
        missing,
      },
      null,
      2,
    ),
  );
  if (!ok) process.exit(1);
}

main();
