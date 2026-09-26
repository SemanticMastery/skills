#!/usr/bin/env node
/**
 * Usage:
 *   node check-pages-ready.mjs --campaign-dir "<abs>" --slug tree-removal
 * Exit 0 when setup_complete + approved slug + Matrix. Exit 1 otherwise.
 */

import { checkReady } from "./lib/ready.mjs";

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
      {
        usage: 'node check-pages-ready.mjs --campaign-dir "<abs>" --slug "<slug>"',
      },
      null,
      2,
    ),
  );
  process.exit(args.help ? 0 : 1);
}

const result = checkReady(args);
console.log(JSON.stringify(result, null, 2));
process.exit(result.exit);
