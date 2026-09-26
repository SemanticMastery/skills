#!/usr/bin/env node
/**
 * Evidence-threshold gate for content-pipeline-pages.
 *
 * Usage:
 *   node pd-coverage.mjs --campaign-dir "<abs>" --slug "<slug>" [--write] [--waive --waived-by <name>]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readManifest, resolveDirs, writeManifest } from "./lib/ready.mjs";
import {
  findCatalogOffering,
  findProfile,
  loadCoverageMap,
  ownerInterviewCovers,
  parseLastUpdated,
  parseProductDoc,
  r20AllUnknown,
  scoreOffering,
} from "./lib/product-doc.mjs";

const CANONICAL_REL = path.join("01-intake", "1.1-docs", "Product-Documentation.md");

function parseArgs(argv) {
  const out = {
    campaignDir: null,
    slug: null,
    write: false,
    waive: false,
    waivedBy: null,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--campaign-dir") out.campaignDir = argv[++i];
    else if (a === "--slug") out.slug = argv[++i];
    else if (a === "--write") out.write = true;
    else if (a === "--waive") out.waive = true;
    else if (a === "--waived-by") out.waivedBy = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function fail(error, extra = {}) {
  console.log(JSON.stringify({ error, ...extra }));
  process.exit(1);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function evaluateCoverage({ campaignDir, slug, write = false, waive = false, waivedBy = null }) {
  const dirs = resolveDirs({ campaignDir });
  const man = readManifest(dirs.pipelineDir);
  if (!man) {
    return {
      error: "product_doc_missing",
      hint: "Set setup.product_doc_source via pipeline-pages-init; copy with content-pipeline-init/scripts/sync-resources.mjs",
    };
  }

  const src = man.setup?.product_doc_source;
  if (!src || !fs.existsSync(src)) {
    return {
      error: "product_doc_missing",
      hint: "Set setup.product_doc_source via pipeline-pages-init; copy with content-pipeline-init/scripts/sync-resources.mjs",
    };
  }

  if (waive || write) {
    if (!man.runs?.[slug]) return { error: "run_row_required", slug };
  }

  const copyMd = fs.readFileSync(src, "utf8");
  const pd_last_updated = parseLastUpdated(copyMd);
  const page = (man.setup.pages || []).find((p) => p.slug === slug);
  if (!page?.offering) return { error: "offering_not_found", slug };

  const parsed = parseProductDoc(copyMd);
  const catalogOffering = findCatalogOffering(parsed.catalog, page.offering);
  if (!catalogOffering) return { error: "offering_not_found", slug, offering: page.offering };

  const profile = findProfile(parsed, catalogOffering);
  const map = loadCoverageMap();
  const covered_rows = scoreOffering({
    parsed,
    profile,
    map,
    campaignDir: dirs.campaignDir,
    slug,
    seed: page.seed,
  });
  const score = covered_rows.length;
  const interviewCovers = ownerInterviewCovers(parsed, catalogOffering, slug, profile);
  const blocked = r20AllUnknown(profile, map) && !interviewCovers;
  let result = blocked ? "block" : score === 7 ? "pass" : "warn";
  let message = result === "block" ? `Run owner-interview for ${slug}` : "";

  if (pd_last_updated) {
    const canonicalPath = path.join(dirs.campaignDir, CANONICAL_REL);
    if (fs.existsSync(canonicalPath)) {
      const canonUpdated = parseLastUpdated(fs.readFileSync(canonicalPath, "utf8"));
      if (canonUpdated && canonUpdated > pd_last_updated) {
        message = message ? `${message}; re-sync required` : "re-sync required";
      }
    }
  }

  const existing = man.runs?.[slug]?.evidence_gate;
  let stale_waiver = false;
  if (waive) {
    result = "waived";
  } else if (existing?.result === "waived") {
    if (existing.pd_last_updated !== pd_last_updated) {
      stale_waiver = true;
    } else {
      result = "waived";
    }
  }

  const payload = {
    result,
    score,
    covered_rows,
    message,
    pd_last_updated,
    stale_waiver,
  };

  if (write || waive) {
    const gate = {
      result,
      score,
      covered_rows,
      pd_last_updated,
      waived_by: result === "waived" ? waivedBy || existing?.waived_by || null : null,
      waived_on: result === "waived" ? (waive ? today() : existing?.waived_on || today()) : null,
      message,
    };
    man.runs[slug].evidence_gate = gate;
    writeManifest(dirs.pipelineDir, man);
  }

  return payload;
}

export function main(argv = process.argv) {
  const args = parseArgs(argv);
  if (args.help || !args.campaignDir || !args.slug) {
    console.log(
      JSON.stringify(
        {
          usage:
            'node pd-coverage.mjs --campaign-dir "<abs>" --slug "<slug>" [--write] [--waive --waived-by <name>]',
        },
        null,
        2,
      ),
    );
    process.exit(args.help ? 0 : 1);
  }
  if (args.waive && !args.waivedBy) fail("waived_by_required");
  const result = evaluateCoverage({
    campaignDir: args.campaignDir,
    slug: args.slug,
    write: args.write,
    waive: args.waive,
    waivedBy: args.waivedBy,
  });
  if (result.error) fail(result.error, result);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.result === "block" ? 1 : 0);
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
