#!/usr/bin/env node
/**
 * Extract typed gaps from a campaign PD, brief omissions, crawl, and pasted claims.
 *
 * Usage:
 *   node interview-gaps.mjs --campaign-dir "..." --scope deep-root-fertilization
 *   node interview-gaps.mjs --campaign-dir "..." --scope company
 *   node interview-gaps.mjs --campaign-dir "..." --scope deep-root-fertilization --claims claims.txt
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fail, parseArgs } from "./lib/args.mjs";
import { canonicalPdPath, requireCampaign, resolveCampaignDir } from "./lib/paths.mjs";
import {
  companyPdGaps,
  findOffering,
  loadCoverageMap,
  offeringPdGaps,
  parseProductDoc,
} from "./lib/pd.mjs";
import { pastedGaps, resolveCatalogOffering, resolvePageSlug, sourceGaps } from "./lib/sources.mjs";

export function extractGaps({ campaignDir, scope, claims } = {}) {
  if (!campaignDir || !fs.existsSync(campaignDir)) {
    return { error: "campaign_dir_not_found", campaignDir };
  }
  if (!scope) return { error: "scope_required" };

  const pdPath = canonicalPdPath(campaignDir);
  if (!fs.existsSync(pdPath)) return { error: "product_doc_missing" };

  const parsed = parseProductDoc(fs.readFileSync(pdPath, "utf8"));
  const map = loadCoverageMap();
  const catalogScope =
    scope === "company" ? scope : resolveCatalogOffering(campaignDir, scope) || scope;

  if (scope !== "company") {
    const offering = findOffering(parsed.catalog, catalogScope);
    if (!offering) return { error: "offering_not_found", scope };
  }

  const gaps = [];
  if (scope === "company") {
    gaps.push(...companyPdGaps(parsed, map));
    gaps.push(...pastedGaps(claims, map));
  } else {
    gaps.push(...offeringPdGaps(parsed, catalogScope, map));
    const slug = resolvePageSlug(campaignDir, scope);
    gaps.push(...sourceGaps({ campaignDir, slug, claimsPath: claims, map }));
  }

  return { scope, gaps };
}

export function main(argv = process.argv) {
  const args = parseArgs(argv, { actions: ["claims"] });
  if (args.foreignFlag) fail("foreign_flag", { flag: args.foreignFlag });
  if (args.help) {
    console.log(
      "usage: interview-gaps.mjs --campaign-dir <abs> --scope <offering-slug|company> [--claims <file>]",
    );
    return;
  }
  if (args.unknown) fail("unknown_flag", { flag: args.unknown });
  const campaignDir = resolveCampaignDir(args);
  requireCampaign(campaignDir);
  if (!args.scope) fail("scope_required");
  const result = extractGaps({
    campaignDir,
    scope: args.scope,
    claims: args.claims,
  });
  if (result.error) {
    const extra = {};
    if (result.scope) extra.scope = result.scope;
    if (result.campaignDir) extra.campaignDir = result.campaignDir;
    fail(result.error, extra);
  }
  console.log(JSON.stringify(result, null, 2));
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
