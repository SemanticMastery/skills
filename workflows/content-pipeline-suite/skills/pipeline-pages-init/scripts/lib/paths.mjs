import fs from "node:fs";
import path from "node:path";

export function resolveDirs(args) {
  let campaignDir = args.campaignDir ? path.resolve(args.campaignDir) : null;
  let pipelineDir = args.pipelineDir ? path.resolve(args.pipelineDir) : null;

  if (pipelineDir && !campaignDir) {
    campaignDir = path.basename(pipelineDir) === "06-content-pipeline"
      ? path.dirname(pipelineDir)
      : pipelineDir;
    if (path.basename(pipelineDir) !== "06-content-pipeline") {
      pipelineDir = path.join(pipelineDir, "06-content-pipeline");
    }
  }
  if (campaignDir && !pipelineDir) {
    pipelineDir = path.join(campaignDir, "06-content-pipeline");
  }
  return { campaignDir, pipelineDir };
}

export function manifestPath(pipelineDir) {
  return path.join(pipelineDir, "pipeline-pages-manifest.json");
}

export function pagesDir(pipelineDir) {
  return path.join(pipelineDir, "pages");
}

export function requireCampaign(campaignDir) {
  if (!campaignDir || !fs.existsSync(campaignDir)) {
    console.error(JSON.stringify({ error: "campaign_dir_not_found", campaignDir }));
    process.exit(2);
  }
}

export function emptyStage(status = "pending") {
  return { status, artifact: null };
}

export function starterManifest(campaignDir, pipelineDir) {
  return {
    schema_version: 1,
    skill: "pipeline-pages-init",
    campaign_dir: campaignDir,
    pipeline_dir: pipelineDir,
    setup: {
      status: "awaiting_reconcile",
      crawl_source: null,
      product_doc_source: null,
      pages: [],
    },
    runs: {},
  };
}

export function readManifest(pipelineDir) {
  const p = manifestPath(pipelineDir);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function writeManifest(pipelineDir, data) {
  const p = manifestPath(pipelineDir);
  fs.mkdirSync(pipelineDir, { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return p;
}
