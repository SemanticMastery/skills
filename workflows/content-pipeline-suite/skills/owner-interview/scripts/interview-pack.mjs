#!/usr/bin/env node
/**
 * Validate an agent-written draft pack, cap, order, and render .json + .md.
 *
 * Usage:
 *   node interview-pack.mjs --campaign-dir "..." --scope deep-root-fertilization --draft draft.json
 *   node interview-pack.mjs --campaign-dir "..." --scope company --draft draft.json
 *   node interview-pack.mjs --campaign-dir "..." --scope deep-root-fertilization --draft draft.json --delta
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fail, parseArgs } from "./lib/args.mjs";
import { interviewPair, requireCampaign, resolveCampaignDir } from "./lib/paths.mjs";
import { extractGaps } from "./interview-gaps.mjs";
import { buildPack, publishBeforeParent } from "./lib/pack.mjs";

export { publishBeforeParent };
import { renderPackMarkdown } from "./lib/render-md.mjs";

export function main(argv = process.argv) {
  const args = parseArgs(argv, { actions: ["draft", "delta", "claims"] });
  if (args.foreignFlag) fail("foreign_flag", { flag: args.foreignFlag });
  if (args.help) {
    console.log(
      "usage: interview-pack.mjs --campaign-dir <abs> --scope <offering-slug|company> --draft <file> [--claims <file>] [--delta]",
    );
    return;
  }
  if (args.unknown) fail("unknown_flag", { flag: args.unknown });
  const campaignDir = resolveCampaignDir(args);
  requireCampaign(campaignDir);
  const scope = args.scope;
  if (!scope) fail("scope_required");
  if (!args.draft) fail("draft_required");
  if (!fs.existsSync(args.draft)) fail("draft_not_found", { draft: args.draft });

  let draft;
  try {
    draft = JSON.parse(fs.readFileSync(args.draft, "utf8"));
  } catch (err) {
    fail("draft_invalid", { message: String(err?.message || err) });
  }

  const gapResult = extractGaps({
    campaignDir,
    scope,
    claims: args.claims,
  });
  if (gapResult.error) {
    const extra = {};
    if (gapResult.scope) extra.scope = gapResult.scope;
    if (gapResult.campaignDir) extra.campaignDir = gapResult.campaignDir;
    fail(gapResult.error, extra);
  }

  const result = buildPack({
    draft,
    gaps: gapResult.gaps,
    campaignDir,
    scope,
    delta: Boolean(args.delta),
  });
  if (result.error) fail(result.error, result.extra || {});

  const pair = interviewPair(campaignDir, scope);
  if (fs.existsSync(pair.json)) {
    let existing = null;
    try {
      existing = JSON.parse(fs.readFileSync(pair.json, "utf8"));
    } catch {
      existing = null;
    }
    if (existing && (existing.state || Array.isArray(existing.answers))) {
      fail("record_exists", { path: pair.json });
    }
  }
  fs.mkdirSync(path.dirname(pair.json), { recursive: true });
  fs.writeFileSync(pair.json, JSON.stringify(result.pack, null, 2));
  fs.writeFileSync(pair.md, renderPackMarkdown(result.pack));

  console.log(
    JSON.stringify(
      {
        json: pair.json,
        md: pair.md,
        count: result.pack.questions.length,
        ids: result.pack.questions.map((question) => question.id),
      },
      null,
      2,
    ),
  );
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
