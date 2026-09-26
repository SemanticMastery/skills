#!/usr/bin/env node
/**
 * Resolve campaign_dir / pipeline_dir the same way content-pipeline-run does.
 */
import path from "node:path";

export function parseCampaignArgs(argv) {
  const out = {
    campaignDir: null,
    pipelineDir: null,
    help: false,
    extra: {},
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--campaign-dir") out.campaignDir = argv[++i];
    else if (a === "--pipeline-dir") out.pipelineDir = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        out.extra[key] = true;
      } else {
        out.extra[key] = argv[++i];
      }
    }
  }
  return out;
}

export function resolveDirs({ campaignDir, pipelineDir }) {
  let campaign = campaignDir ? path.resolve(campaignDir) : null;
  let pipeline = pipelineDir ? path.resolve(pipelineDir) : null;

  if (pipeline && !campaign) {
    if (path.basename(pipeline) === "06-content-pipeline") {
      campaign = path.dirname(pipeline);
    } else {
      campaign = pipeline;
      pipeline = path.join(campaign, "06-content-pipeline");
    }
  }
  if (campaign && !pipeline) {
    if (path.basename(campaign) === "06-content-pipeline") {
      pipeline = campaign;
      campaign = path.dirname(pipeline);
    } else {
      pipeline = path.join(campaign, "06-content-pipeline");
    }
  }
  return { campaignDir: campaign, pipelineDir: pipeline };
}

export function requireCampaignDir(args) {
  const dirs = resolveDirs(args);
  if (!dirs.campaignDir || !dirs.pipelineDir) {
    const err = new Error(
      "campaign_dir is required. Pass --campaign-dir (folder that contains 06-content-pipeline/) or --pipeline-dir.",
    );
    err.code = "MISSING_CAMPAIGN_DIR";
    throw err;
  }
  return dirs;
}
