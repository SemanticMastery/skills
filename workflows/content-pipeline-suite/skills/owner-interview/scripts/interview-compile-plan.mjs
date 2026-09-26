#!/usr/bin/env node
/**
 * Emit a tagged product-documentation refresh diff from a captured interview record.
 *
 * Usage:
 *   node interview-compile-plan.mjs --campaign-dir "..." --scope deep-root-fertilization
 *   node interview-compile-plan.mjs --campaign-dir "..." --scope deep-root-fertilization --partial
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { fail, parseArgs } from "./lib/args.mjs";
import { compilePlan } from "./lib/compile.mjs";
import { requireCampaign, resolveCampaignDir } from "./lib/paths.mjs";

export function main(argv = process.argv) {
  const args = parseArgs(argv, { actions: ["partial", "write"] });
  if (args.foreignFlag) fail("foreign_flag", { flag: args.foreignFlag });
  if (args.help) {
    console.log(
      "usage: interview-compile-plan.mjs --campaign-dir <abs> --scope <offering-slug|company> [--partial]",
    );
    return;
  }
  if (args.unknown) fail("unknown_flag", { flag: args.unknown });
  const campaignDir = resolveCampaignDir(args);
  requireCampaign(campaignDir);
  if (!args.scope) fail("scope_required");

  const result = compilePlan({
    campaignDir,
    scope: args.scope,
    partial: Boolean(args.partial),
  });
  if (result?.error) fail(result.error, result.extra || {});
  console.log(JSON.stringify(result, null, 2));
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
