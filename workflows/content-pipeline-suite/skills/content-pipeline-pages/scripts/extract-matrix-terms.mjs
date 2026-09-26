#!/usr/bin/env node
/**
 * Read Algorithm Trigger Words (Term + Count) from a page Matrix xlsx.
 *
 * Usage:
 *   node extract-matrix-terms.mjs --campaign-dir "<abs>" --slug emergency-service
 *   node extract-matrix-terms.mjs --xlsx "<abs.xlsx>" [--min-count 40]
 */

import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_MIN_COUNT,
  extractTermCounts,
  highImpactTerms,
} from "./lib/matrix-terms.mjs";
import { readManifest, resolveDirs } from "./lib/ready.mjs";

function parseArgs(argv) {
  const out = {
    campaignDir: null,
    slug: null,
    xlsx: null,
    minCount: DEFAULT_MIN_COUNT,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--campaign-dir") out.campaignDir = argv[++i];
    else if (a === "--slug") out.slug = argv[++i];
    else if (a === "--xlsx") out.xlsx = argv[++i];
    else if (a === "--min-count") out.minCount = Number(argv[++i]);
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function resolveXlsx(args) {
  if (args.xlsx) return path.resolve(args.xlsx);
  const { pipelineDir } = resolveDirs(args);
  const man = readManifest(pipelineDir);
  const page = (man?.setup?.pages || []).find((p) => p.slug === args.slug);
  if (page?.matrix_path && fs.existsSync(page.matrix_path)) return page.matrix_path;
  throw new Error("matrix_xlsx_not_found");
}

const args = parseArgs(process.argv);
if (args.help || (!args.xlsx && !(args.campaignDir && args.slug))) {
  console.log(
    JSON.stringify(
      {
        usage:
          'node extract-matrix-terms.mjs --campaign-dir "<abs>" --slug "<slug>" [--min-count 40]',
      },
      null,
      2,
    ),
  );
  process.exit(args.help ? 0 : 1);
}

try {
  const xlsx = resolveXlsx(args);
  const rows = extractTermCounts(xlsx);
  const high = highImpactTerms(rows, args.minCount);
  console.log(
    JSON.stringify(
      {
        xlsx,
        min_count: args.minCount,
        total_terms: rows.length,
        high_impact: high,
        ask: "Provide specific terms for this page, or authorize the default high-impact list (Count 40+).",
      },
      null,
      2,
    ),
  );
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
