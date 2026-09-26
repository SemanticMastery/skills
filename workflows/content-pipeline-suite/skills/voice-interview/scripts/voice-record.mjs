#!/usr/bin/env node
/**
 * Create and inspect a voice-interview record.
 *
 * Usage:
 *   node voice-record.mjs --campaign-dir "..." --create --speaker "Jordan Hale"
 *   node voice-record.mjs --campaign-dir "..." --list --speaker "Jordan Hale"
 *   node voice-record.mjs --campaign-dir "..." --show --speaker "Jordan Hale"
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { fail, parseArgs } from "./lib/args.mjs";
import { requireCampaign, resolveCampaignDir } from "./lib/paths.mjs";
import { createRecord, listRecords, showRecord } from "./lib/record.mjs";

export { createRecord };

export function main(argv = process.argv) {
  const args = parseArgs(argv, {
    actions: ["create", "list", "show", "speaker"],
  });
  if (args.foreignFlag) fail("foreign_flag", { flag: args.foreignFlag });
  if (args.help) {
    console.log(
      "usage: voice-record.mjs --campaign-dir <abs> --speaker <name> (--create | --list | --show)",
    );
    return;
  }
  if (args.unknown) fail("unknown_flag", { flag: args.unknown });
  const campaignDir = resolveCampaignDir(args);
  requireCampaign(campaignDir);
  if (!args.speaker) fail("speaker_required");

  console.log(JSON.stringify({ campaign_dir: campaignDir }));

  let result;
  if (args.create) {
    result = createRecord({ campaignDir, speaker: args.speaker });
  } else if (args.list) {
    result = listRecords({ campaignDir, speaker: args.speaker });
  } else if (args.show) {
    result = showRecord({ campaignDir, speaker: args.speaker });
  } else {
    fail("action_required");
  }

  if (result?.error) fail(result.error, result.extra || {});
  console.log(JSON.stringify(result, null, 2));
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
