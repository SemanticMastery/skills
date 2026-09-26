#!/usr/bin/env node
/**
 * Usage:
 *   node status-page.mjs --campaign-dir "<abs>" --slug tree-removal
 */

import { artifactPath, readManifest, resolveDirs } from "./lib/ready.mjs";

function parseArgs(argv) {
  const out = { campaignDir: null, slug: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--campaign-dir") out.campaignDir = argv[++i];
    else if (a === "--slug") out.slug = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

const args = parseArgs(process.argv);
if (args.help || !args.campaignDir) {
  console.log(
    JSON.stringify(
      { usage: 'node status-page.mjs --campaign-dir "<abs>" --slug "<slug>"' },
      null,
      2,
    ),
  );
  process.exit(args.help ? 0 : 1);
}

const { pipelineDir } = resolveDirs(args);
const man = readManifest(pipelineDir);
if (!man) {
  console.error(JSON.stringify({ error: "run pipeline-pages-init" }));
  process.exit(1);
}
const slug = args.slug;
const page = (man.setup.pages || []).find((p) => p.slug === slug);
const run = slug ? man.runs?.[slug] || null : man.runs || {};
const artifacts = {};
if (slug) {
  for (const stage of ["brief", "draft", "edit", "polish"]) {
    artifacts[stage] = artifactPath(pipelineDir, stage, slug);
  }
}
console.log(
  JSON.stringify(
    {
      setup_status: man.setup.status,
      slug,
      page: page || null,
      run,
      artifacts,
    },
    null,
    2,
  ),
);
