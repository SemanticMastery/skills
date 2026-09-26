#!/usr/bin/env node
/**
 * Nest produce-chain files into post-{NN}-{stage}/ when a post has more
 * than one artifact (polish/images always nest).
 *
 * Usage:
 *   node nest-post-artifacts.mjs --campaign-dir "..."
 *   node nest-post-artifacts.mjs --campaign-dir "..." --execute
 */
import path from "node:path";
import { nestCampaignArtifacts } from "./lib/artifacts.mjs";

function parseArgs(argv) {
  const out = { campaignDir: null, pipelineDir: null, execute: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--campaign-dir") out.campaignDir = argv[++i];
    else if (a === "--pipeline-dir") out.pipelineDir = argv[++i];
    else if (a === "--execute") out.execute = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function resolvePipeline(args) {
  if (args.pipelineDir) return path.resolve(args.pipelineDir);
  if (!args.campaignDir) return null;
  const campaign = path.resolve(args.campaignDir);
  return path.basename(campaign) === "06-content-pipeline"
    ? campaign
    : path.join(campaign, "06-content-pipeline");
}

const args = parseArgs(process.argv);
if (args.help || (!args.campaignDir && !args.pipelineDir)) {
  console.log(`Usage:
  node nest-post-artifacts.mjs --campaign-dir <path> [--execute]`);
  process.exit(args.help ? 0 : 1);
}

const pipelineDir = resolvePipeline(args);
const ops = nestCampaignArtifacts(pipelineDir, { execute: args.execute });
console.log(
  JSON.stringify(
    {
      ok: true,
      execute: args.execute,
      moved: ops.length,
      ops: ops.map((o) => ({
        from: path.relative(pipelineDir, o.from),
        to: path.relative(pipelineDir, o.to),
      })),
    },
    null,
    2,
  ),
);
