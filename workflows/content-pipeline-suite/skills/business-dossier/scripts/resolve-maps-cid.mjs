#!/usr/bin/env node
/**
 * CLI: resolve a Maps / GBP share / maps.app / place URL to
 * https://www.google.com/maps?cid={CID}
 *
 * Exit 0 when CID is resolved. Exit 1 when unresolved (do not ship the input as hasMap).
 */

import { resolveMapsCid } from './lib/resolve-maps-cid.mjs';

function parseArgs(argv) {
  const out = { url: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url' && argv[i + 1]) out.url = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
    else if (!a.startsWith('-') && !out.url) out.url = a;
  }
  return out;
}

function usage() {
  return `Usage:
  node resolve-maps-cid.mjs --url "https://maps.app.goo.gl/..."
  node resolve-maps-cid.mjs --url "https://share.google/..."
  node resolve-maps-cid.mjs --url "https://www.google.com/maps/place/..."
  node resolve-maps-cid.mjs --url "14463678168851604553"

Output JSON: { ok, cid, cid_url, input, final_url, redirect_chain, parse_notes }
Exit 1 if CID cannot be resolved — do not use maps.app / share.google as hasMap.`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.url) {
    console.log(usage());
    process.exit(args.help ? 0 : 1);
  }

  const resolved = await resolveMapsCid(args.url);
  console.log(JSON.stringify(resolved, null, 2));
  process.exit(resolved.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
