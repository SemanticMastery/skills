#!/usr/bin/env node
/**
 * Copy 3.5-images helpers into `{pipeline}/scripts/`.
 *
 * Usage:
 *   node seed-helpers.mjs --campaign-dir "/abs/path/to/campaign"
 */
import { parseCampaignArgs, requireCampaignDir } from "./lib/campaign.mjs";
import { seedCampaignImageHelpers } from "./lib/library.mjs";

function main() {
  const args = parseCampaignArgs(process.argv);
  if (args.help) {
    console.log("Usage: node seed-helpers.mjs --campaign-dir <path>");
    process.exit(0);
  }
  let dirs;
  try {
    dirs = requireCampaignDir(args);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const result = seedCampaignImageHelpers(dirs.pipelineDir);
  console.log(
    JSON.stringify({ ok: true, campaign_dir: dirs.campaignDir, ...result }, null, 2),
  );
}

main();
