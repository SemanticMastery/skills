import fs from "node:fs";
import path from "node:path";

export const STAGE_FOLDERS = {
  brief: "p.1-brief",
  draft: "p.2-draft",
  edit: "p.3-edit",
  polish: "p.4-polish",
};

export function resolveDirs(args) {
  let campaignDir = args.campaignDir ? path.resolve(args.campaignDir) : null;
  let pipelineDir = args.pipelineDir ? path.resolve(args.pipelineDir) : null;
  if (pipelineDir && path.basename(pipelineDir) !== "06-content-pipeline") {
    pipelineDir = path.join(pipelineDir, "06-content-pipeline");
  }
  if (campaignDir && !pipelineDir) {
    pipelineDir = path.join(campaignDir, "06-content-pipeline");
  }
  if (pipelineDir && !campaignDir) {
    campaignDir = path.dirname(pipelineDir);
  }
  return { campaignDir, pipelineDir };
}

export function manifestPath(pipelineDir) {
  return path.join(pipelineDir, "pipeline-pages-manifest.json");
}

export function readManifest(pipelineDir) {
  const p = manifestPath(pipelineDir);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function writeManifest(pipelineDir, data) {
  fs.writeFileSync(manifestPath(pipelineDir), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function artifactPath(pipelineDir, stage, slug) {
  const folder = STAGE_FOLDERS[stage];
  const pages = path.join(pipelineDir, "pages");
  if (stage === "polish") {
    return path.join(pages, folder, `page-${slug}-polish`, `page-${slug}-polish.md`);
  }
  return path.join(pages, folder, `page-${slug}-${stage}.md`);
}

export function pageHasMatrix(page, pipelineDir) {
  if (page?.matrix_path && fs.existsSync(page.matrix_path)) return true;
  const dir = path.join(pipelineDir, "pages", "matrix", page?.slug || "");
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).some((n) => /_matrix/i.test(n));
}

export function checkReady({ campaignDir, pipelineDir, slug }) {
  const dirs = resolveDirs({ campaignDir, pipelineDir });
  const man = readManifest(dirs.pipelineDir);
  if (!man || man.setup?.status !== "setup_complete") {
    return {
      ready: false,
      exit: 1,
      error: "run pipeline-pages-init",
      setup_status: man?.setup?.status || null,
    };
  }
  if (!slug) {
    return { ready: false, exit: 1, error: "slug_required" };
  }
  const page = (man.setup.pages || []).find((p) => p.slug === slug);
  if (!page || page.decision !== "include") {
    return { ready: false, exit: 1, error: "slug_not_approved", slug };
  }
  if (!pageHasMatrix(page, dirs.pipelineDir)) {
    return { ready: false, exit: 1, error: "matrix_missing", slug };
  }
  return {
    ready: true,
    exit: 0,
    slug,
    setup_status: man.setup.status,
    matrix_path: page.matrix_path,
    campaign_dir: dirs.campaignDir,
    pipeline_dir: dirs.pipelineDir,
  };
}
