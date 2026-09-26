#!/usr/bin/env node
/**
 * Batch voice links: one command per campaign lists every seated service page
 * (and company, when a pack exists), opens a record when a pack has none,
 * creates or reuses a host session, and writes a paste-ready manifest.
 *
 *   node interview-links.mjs --campaign-dir "..." --plan
 *   node interview-links.mjs --campaign-dir "..." [--scopes a,b,c] [--exclude x] [--no-company] [--expires YYYY-MM-DD]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fail, parseArgs } from "./lib/args.mjs";
import { SECONDS_PER_QUESTION, estimateMinutes } from "./lib/estimate.mjs";
import { offeringsFromProductDoc } from "./lib/pd.mjs";
import {
  companySlug,
  displayLabel,
  intakeDocsDir,
  linksManifestPair,
  manifestPath,
  requireCampaign,
  resolveCampaignDir,
  serviceTitle,
} from "./lib/paths.mjs";
import { atomicWrite, findActiveRecordEntry, findPackEntry, isPack, isRecord, listInterviewEntries } from "./lib/record.mjs";
import { createRecord } from "./interview-record.mjs";
import { createLink } from "./interview-voice.mjs";
import * as defaultHost from "./lib/host-client.mjs";

const LINK_ACTIONS = ["scopes", "exclude", "noCompany", "expires", "plan"];
export { SECONDS_PER_QUESTION, estimateMinutes };
export const DEFAULT_LINK_DAYS = 7;

function newestPackEntry(campaignDir, scope) {
  const entries = listInterviewEntries(campaignDir, scope).filter((entry) => isPack(entry.data) && !isRecord(entry.data));
  return entries.length ? entries[entries.length - 1] : findPackEntry(campaignDir, scope);
}

export function scopeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseList(value) {
  return String(value || "")
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + Number(days));
  return date.toISOString().slice(0, 10);
}

export function defaultExpiresOn(days = DEFAULT_LINK_DAYS) {
  return plusDays(days);
}

export function listCatalogScopes(campaignDir) {
  const pdPath = path.join(intakeDocsDir(campaignDir), "Product-Documentation.md");
  if (!fs.existsSync(pdPath)) return { error: "pd_not_found" };
  const names = offeringsFromProductDoc(fs.readFileSync(pdPath, "utf8"));
  return { scopes: names.map(scopeSlug).filter(Boolean) };
}

export function listManifestIncludes(campaignDir) {
  const file = manifestPath(campaignDir);
  if (!fs.existsSync(file)) return { scopes: [], source: "missing" };
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return { scopes: [], source: "invalid" };
  }
  const pages = data?.setup?.pages || [];
  const scopes = pages
    .filter((page) => page && page.decision === "include" && page.slug)
    .map((page) => scopeSlug(page.slug))
    .filter(Boolean);
  return { scopes, source: scopes.length ? "manifest" : "empty" };
}

function recordPlanState(record) {
  if (!record) return "will-create";
  const state = record.data?.state;
  if (state === "compiled" || state === "superseded") return state;
  return "exists";
}

export function selectScopes({ campaignDir, scopes, exclude, noCompany = false } = {}) {
  const requested = parseList(scopes).map(scopeSlug);
  const excluded = new Set(parseList(exclude).map(scopeSlug));
  const included = listManifestIncludes(campaignDir);
  let selected;
  let source;
  if (requested.length) {
    selected = requested.filter((scope) => scope !== "company");
    source = "scopes";
  } else if (included.scopes.length) {
    selected = [...included.scopes];
    source = "manifest";
  } else {
    const catalog = listCatalogScopes(campaignDir);
    if (catalog.error) return catalog;
    selected = [...catalog.scopes];
    source = "catalog";
  }
  selected = selected.filter((scope) => !excluded.has(scope));
  const wantCompany =
    !noCompany && !excluded.has("company") && (requested.length ? requested.includes("company") : true);
  const out = [];
  if (wantCompany) out.push("company");
  out.push(...selected);
  return { scopes: out, source };
}

function planRow(campaignDir, scope) {
  const packEntry = newestPackEntry(campaignDir, scope);
  const record = findActiveRecordEntry(campaignDir, scope);
  const questionCount = packEntry ? (packEntry.data.questions || []).length : 0;
  return {
    scope,
    service_title: serviceTitle(scope),
    question_count: questionCount,
    est_minutes: estimateMinutes(questionCount),
    pack: packEntry ? "existing" : "missing",
    record: recordPlanState(record),
  };
}

export function planLinks({ campaignDir, scopes, exclude, noCompany = false } = {}) {
  const selected = selectScopes({ campaignDir, scopes, exclude, noCompany });
  if (selected.error) return selected;
  const ready = [];
  const needsPack = [];
  const skipped = [];
  for (const scope of selected.scopes) {
    const row = planRow(campaignDir, scope);
    if (row.pack === "missing") {
      needsPack.push(row);
      continue;
    }
    if (row.record === "compiled" || row.record === "superseded") {
      skipped.push({ ...row, reason: "record_not_writable", extra: { state: row.record } });
      continue;
    }
    ready.push(row);
  }
  return {
    source: selected.source,
    scopes: selected.scopes,
    ready,
    needs_pack: needsPack,
    skipped,
  };
}

export function renderPasteBlock({ company, expiresOn, links }) {
  const title = displayLabel(company);
  const lines = [
    `# Owner interview links — ${title}`,
    "",
    `Complete each link once. If a call is interrupted, reopen the same link to resume. Links are valid until ${expiresOn}.`,
    "",
  ];
  if (!links.length) {
    lines.push("No interview links were ready.");
    lines.push("");
    return lines.join("\n");
  }
  links.forEach((row, index) => {
    lines.push(`${index + 1}. ${row.service_title} — ${row.question_count} questions (~${row.est_minutes} min): ${row.url}`);
  });
  const totalMin = links.reduce((sum, row) => sum + row.est_minutes, 0);
  lines.push("");
  lines.push(
    `Total: ~${totalMin} minutes across ${links.length} interview${links.length === 1 ? "" : "s"} (approximate; ${SECONDS_PER_QUESTION} seconds per question).`,
  );
  lines.push("");
  return lines.join("\n");
}

function manifestPair(campaignDir, date = todayStamp()) {
  return linksManifestPair(campaignDir, date);
}

async function seatLink({ campaignDir, scope, expires, host, createRecordFn, createLinkFn }) {
  const packEntry = newestPackEntry(campaignDir, scope);
  if (!packEntry) return { skipped: { scope, reason: "pack_not_found" } };

  const before = findActiveRecordEntry(campaignDir, scope);
  let recordCreated = false;
  if (!before) {
    const created = createRecordFn({ campaignDir, scope });
    if (created?.error) return { skipped: { scope, reason: created.error, extra: created.extra || undefined } };
    recordCreated = true;
  } else if (before.data.state === "compiled" || before.data.state === "superseded") {
    return { skipped: { scope, reason: "record_not_writable", extra: { state: before.data.state } } };
  }

  const priorSession = findActiveRecordEntry(campaignDir, scope)?.data?.voice_session_id || null;
  const result = await createLinkFn({
    campaignDir,
    scope,
    args: expires ? { expires } : {},
    host,
  });
  if (result?.error) {
    return {
      skipped: {
        scope,
        reason: result.error,
        extra: result.extra || undefined,
        record_created: recordCreated,
      },
    };
  }
  const questions = packEntry.data.questions || [];
  return {
    link: {
      scope,
      service_title: serviceTitle(scope),
      question_count: questions.length,
      est_minutes: estimateMinutes(questions.length),
      url: result.url,
      session_id: result.session_id,
      link: priorSession && priorSession === result.session_id ? "reused" : "created",
      record_created: recordCreated,
    },
  };
}

export async function createLinks({
  campaignDir,
  scopes,
  exclude,
  noCompany = false,
  expires,
  host = defaultHost,
  createRecordFn = createRecord,
  createLinkFn = createLink,
} = {}) {
  if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(String(expires))) {
    return { error: "expires_invalid", extra: { expires } };
  }
  const selected = selectScopes({ campaignDir, scopes, exclude, noCompany });
  if (selected.error) return selected;

  const links = [];
  const skipped = [];
  for (const scope of selected.scopes) {
    const row = await seatLink({ campaignDir, scope, expires, host, createRecordFn, createLinkFn });
    if (row.skipped) skipped.push(row.skipped);
    else links.push(row.link);
  }

  const expiresOn = expires || defaultExpiresOn();
  const pasteBlock = renderPasteBlock({
    company: companySlug(campaignDir),
    expiresOn,
    links,
  });
  const pair = manifestPair(campaignDir);
  fs.mkdirSync(path.dirname(pair.json), { recursive: true });
  const payload = {
    campaign: companySlug(campaignDir),
    expires_on: expiresOn,
    links,
    skipped,
    paste_block: pasteBlock,
    manifest: { json: pair.json, md: pair.md },
  };
  const jsonErr = atomicWrite(pair.json, `${JSON.stringify(payload, null, 2)}\n`);
  if (jsonErr?.error) return jsonErr;
  const mdErr = atomicWrite(pair.md, pasteBlock);
  if (mdErr?.error) return mdErr;
  return payload;
}

export async function runLinks(args, deps = {}) {
  if (args.plan) {
    return planLinks({
      campaignDir: args.campaignDir,
      scopes: args.scopes,
      exclude: args.exclude,
      noCompany: Boolean(args.noCompany),
    });
  }
  return createLinks({
    campaignDir: args.campaignDir,
    scopes: args.scopes,
    exclude: args.exclude,
    noCompany: Boolean(args.noCompany),
    expires: args.expires,
    host: deps.host || defaultHost,
    createRecordFn: deps.createRecordFn || createRecord,
    createLinkFn: deps.createLinkFn || createLink,
  });
}

export async function main(argv = process.argv, deps = {}) {
  const args = parseArgs(argv, { actions: LINK_ACTIONS });
  if (args.foreignFlag) fail("foreign_flag", { flag: args.foreignFlag });
  if (args.help) {
    console.log(
      "usage: interview-links.mjs --campaign-dir <abs> [--plan] [--scopes a,b,c] [--exclude x] [--no-company] [--expires YYYY-MM-DD]",
    );
    return;
  }
  if (args.unknown) fail("unknown_flag", { flag: args.unknown });
  const campaignDir = resolveCampaignDir(args);
  requireCampaign(campaignDir);
  const result = await runLinks({ ...args, campaignDir }, deps);
  if (result?.error) fail(result.error, result.extra || {});
  console.log(JSON.stringify(result, null, 2));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
