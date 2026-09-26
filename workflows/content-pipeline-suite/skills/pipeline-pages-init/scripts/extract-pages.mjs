#!/usr/bin/env node
/**
 * Extract crawl vs catalog service pages. Does not run Content Maxima.
 *
 * Usage:
 *   node extract-pages.mjs --campaign-dir "/abs/path/to/campaign"
 *   node extract-pages.mjs --campaign-dir "..." --write
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib/args.mjs";
import { findProductDoc, loadOfferings } from "./lib/catalog.mjs";
import {
  findNewestCrawl,
  loadCrawlRows,
  servicePagesFromCrawl,
} from "./lib/csv.mjs";
import { matchPages } from "./lib/match.mjs";
import {
  readManifest,
  requireCampaign,
  resolveDirs,
  starterManifest,
  writeManifest,
} from "./lib/paths.mjs";

export function extractPages(campaignDir) {
  const { pipelineDir } = resolveDirs({ campaignDir });
  const resources = path.join(pipelineDir, "01-resources");
  const onpageDir = path.join(resources, "onpage");
  const crawl = findNewestCrawl(onpageDir);
  const productDoc = findProductDoc(resources);
  if (!crawl) {
    return { error: "crawl_not_found", onpageDir };
  }
  if (!productDoc) {
    return { error: "product_doc_not_found", resources };
  }
  const { records } = loadCrawlRows(crawl.abs);
  const crawlPages = servicePagesFromCrawl(records);
  const offerings = loadOfferings(productDoc);
  const matched = matchPages(crawlPages, offerings);
  const pages = [
    ...matched.both,
    ...matched.crawlOnly,
    ...matched.catalogOnly,
  ].map((p) => ({
    slug: p.slug,
    url: p.url || null,
    offering: p.offering,
    source: p.source,
    decision: "pending",
    seed: null,
    matrix_path: null,
    matrix_status: null,
  }));
  return {
    campaign_dir: path.resolve(campaignDir),
    crawl_source: crawl.abs,
    product_doc_source: productDoc,
    counts: {
      both: matched.both.length,
      crawl_only: matched.crawlOnly.length,
      catalog_only: matched.catalogOnly.length,
    },
    both: matched.both.map((p) => p.slug),
    crawl_only: matched.crawlOnly.map((p) => ({
      slug: p.slug,
      url: p.url,
    })),
    catalog_only: matched.catalogOnly.map((p) => ({
      slug: p.slug,
      offering: p.offering,
    })),
    pages,
    next: "awaiting_reconcile",
    matrix_started: false,
  };
}

function applyWrite(report) {
  const { pipelineDir } = resolveDirs({ campaignDir: report.campaign_dir });
  const existing = readManifest(pipelineDir) || starterManifest(report.campaign_dir, pipelineDir);
  existing.setup.status = "awaiting_reconcile";
  existing.setup.crawl_source = report.crawl_source;
  existing.setup.product_doc_source = report.product_doc_source;
  existing.setup.pages = report.pages;
  writeManifest(pipelineDir, existing);
  return existing;
}

function main() {
  const args = parseArgs(process.argv, { campaignDir: null, write: false });
  if (args.help || !args.campaignDir) {
    console.log(
      JSON.stringify(
        {
          usage:
            'node extract-pages.mjs --campaign-dir "<abs>" [--write]',
        },
        null,
        2,
      ),
    );
    process.exit(args.help ? 0 : 1);
  }
  requireCampaign(path.resolve(args.campaignDir));
  const report = extractPages(args.campaignDir);
  if (report.error) {
    console.error(JSON.stringify(report));
    process.exit(2);
  }
  if (args.write) applyWrite(report);
  console.log(JSON.stringify(report, null, 2));
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
