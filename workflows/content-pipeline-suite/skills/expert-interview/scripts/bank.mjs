#!/usr/bin/env node
/**
 * Story bank: refresh from host export, flags, digest. No live Retell calls.
 */

import fs from "node:fs";
import path from "node:path";
import { fail, parseArgs } from "./lib/args.mjs";
import {
  digestEntries,
  entryFromStory,
  findEntry,
  heldEntries,
  loadBank,
  markUsed,
  mergeEntries,
  openFlags,
  retireUsed,
  writeBank,
} from "./lib/bank.mjs";
import { scanBriefUsedIds } from "./lib/brief-scan.mjs";
import { renderDigest } from "./lib/digest.mjs";
import * as defaultHost from "./lib/host-client.mjs";
import {
  companySlug,
  displayLabel,
  expertTranscriptPair,
  pipelineDir,
  requireCampaign,
  resolveCampaignDir,
  resolveSeriesRecordPath,
  storyBankDigestPath,
} from "./lib/paths.mjs";
import { atomicWrite, loadSeriesRecord, topicsFromRoadmap, writeSeriesRecord } from "./lib/series-record.mjs";

export const BANK_ACTIONS = [
  "refresh",
  "listFlags",
  "clearFlag",
  "entry",
  "pd",
  "setPublish",
  "decision",
  "acceptCall",
  "reclassify",
  "input",
  "digest",
  "listHeld",
];

function err(code, extra) {
  return { error: code, ...extra };
}

function writeTranscripts(campaignDir, exportData, speaker) {
  const pairs = [];
  for (const cycle of exportData.cycles || []) {
    const date = String(cycle.calls?.[0]?.started_at || "").slice(0, 10);
    const pair = expertTranscriptPair(campaignDir, cycle.cycle_no, date);
    const payload = { ...cycle, speaker };
    atomicWrite(pair.json, `${JSON.stringify(payload, null, 2)}\n`);
    const md = [
      `# Cycle ${cycle.cycle_no} transcript`,
      "",
      `- session: ${cycle.session_id}`,
      `- speaker: ${speaker}`,
      "",
    ].join("\n");
    atomicWrite(pair.md, md);
    pairs.push(pair);
  }
  return pairs;
}

function incomingFromExport(exportData, speaker) {
  const incoming = [];
  const ackIds = [];
  for (const cycle of exportData.cycles || []) {
    for (const call of cycle.calls || []) {
      if (call.live) continue;
      ackIds.push(call.call_id);
      for (const story of call.stories || []) {
        incoming.push(entryFromStory(story, { ...cycle, calls: cycle.calls }, speaker));
      }
    }
  }
  return { incoming, ackIds: [...new Set(ackIds)] };
}

async function maybeSyncTopics(campaignDir, record, host) {
  const roadmap = path.join(pipelineDir(campaignDir), "02-plan", "editorial-roadmap.md");
  const seriesJson = resolveSeriesRecordPath(campaignDir).json;
  if (!fs.existsSync(roadmap) || !fs.existsSync(seriesJson)) return;
  if (fs.statSync(roadmap).mtimeMs <= fs.statSync(seriesJson).mtimeMs) return;
  const topics = topicsFromRoadmap(campaignDir);
  await host.patchSeries(record.series_id, { topics });
  record.topics = topics;
  writeSeriesRecord(campaignDir, record);
}

function writeDigestFile(campaignDir, bank) {
  const digest = renderDigest(bank, { company: displayLabel(companySlug(campaignDir)) });
  const dest = storyBankDigestPath(campaignDir);
  atomicWrite(dest, digest);
  return dest;
}

export async function run(args, { host = defaultHost, now = Date.now(), exportData } = {}) {
  const campaignDir = resolveCampaignDir(args);
  requireCampaign(campaignDir);
  const record = loadSeriesRecord(campaignDir);
  if (!record) return err("series_not_found");

  if (args.listFlags) {
    const bank = loadBank(campaignDir);
    return { flags: openFlags(bank) };
  }
  if (args.listHeld) {
    const bank = loadBank(campaignDir);
    return { held: heldEntries(bank) };
  }

  if (args.clearFlag) {
    if (!args.entry) return err("entry_required");
    const bank = loadBank(campaignDir);
    const entry = findEntry(bank, args.entry);
    if (!entry) return err("entry_not_found", { entry: args.entry });
    entry.flags = [];
    if (args.pd === "handoff") entry.pd_handoff = { at: new Date(now).toISOString(), decision: "handoff" };
    if (args.pd === "dismissed") entry.pd_handoff = { at: new Date(now).toISOString(), decision: "dismissed" };
    const written = writeBank(campaignDir, bank);
    if (written.error) return written;
    writeDigestFile(campaignDir, bank);
    return { ok: true, action: "clear-flag", entry };
  }

  if (args.setPublish) {
    if (!args.entry) return err("entry_required");
    if (!["public", "framing-only", "internal"].includes(args.decision)) return err("decision_required");
    const bank = loadBank(campaignDir);
    const entry = findEntry(bank, args.entry);
    if (!entry) return err("entry_not_found", { entry: args.entry });
    entry.publish_decision = args.decision;
    const written = writeBank(campaignDir, bank);
    if (written.error) return written;
    writeDigestFile(campaignDir, bank);
    return { ok: true, action: "set-publish", entry };
  }

  if (args.acceptCall) {
    try {
      await host.releaseHeldCall(record.series_id, args.acceptCall);
    } catch (e) {
      return err("host_unreachable", { message: String(e?.message || e) });
    }
    const bank = loadBank(campaignDir);
    for (const entry of bank.entries || []) {
      if (entry.call_id === args.acceptCall) {
        entry.held = false;
        if (entry.status === "held") entry.status = "fresh";
      }
    }
    const written = writeBank(campaignDir, bank);
    if (written.error) return written;
    writeDigestFile(campaignDir, bank);
    return { ok: true, action: "accept-call", call_id: args.acceptCall };
  }

  if (args.reclassify) {
    if (!args.input) return err("input_required");
    const overrides = JSON.parse(fs.readFileSync(args.input, "utf8"));
    const bank = loadBank(campaignDir);
    const list = Array.isArray(overrides) ? overrides : overrides.entries || [overrides];
    for (const item of list) {
      const entry = findEntry(bank, item.entry_id);
      if (!entry) continue;
      if (item.theme != null) entry.theme = item.theme;
      if (item.status === "superseded") {
        entry.status = "superseded";
        entry.retire_reason = item.reason || "reclassify";
      }
    }
    const written = writeBank(campaignDir, bank);
    if (written.error) return written;
    writeDigestFile(campaignDir, bank);
    return { ok: true, action: "reclassify" };
  }

  if (args.digest && !args.refresh) {
    const bank = loadBank(campaignDir);
    const dest = writeDigestFile(campaignDir, bank);
    return { ok: true, action: "digest", digest: dest, fresh: digestEntries(bank).length };
  }

  if (args.refresh) {
    try {
      await maybeSyncTopics(campaignDir, record, host);
    } catch {
      /* topics are optional */
    }
    let data = exportData;
    if (!data) {
      try {
        data = await host.exportSeries(record.series_id, { unpulled: true });
      } catch (e) {
        return err("host_unreachable", { message: String(e?.message || e) });
      }
    }
    const speaker = record.speaker;
    const pairs = writeTranscripts(campaignDir, data, speaker);
    const { incoming, ackIds } = incomingFromExport(data, speaker);
    const bank = loadBank(campaignDir);
    const merged = mergeEntries(bank.entries, incoming);
    let entries = merged.entries;
    const scan = scanBriefUsedIds(campaignDir);
    const known = new Set(entries.map((e) => e.entry_id));
    const unknown = scan.ids.filter((id) => !known.has(id));
    entries = markUsed(entries, scan.ids.filter((id) => known.has(id)), new Date(now).toISOString());
    entries = retireUsed(entries, now);
    bank.entries = entries;
    const written = writeBank(campaignDir, bank);
    if (written.error) return written;
    const dest = writeDigestFile(campaignDir, bank);
    if (ackIds.length) {
      try {
        await host.ackSeries(record.series_id, ackIds);
      } catch (e) {
        return err("host_unreachable", { message: String(e?.message || e) });
      }
    }
    return {
      ok: true,
      action: "refresh",
      new_entries: merged.added,
      flags_open: openFlags(bank).length,
      held_calls: [...new Set(heldEntries(bank).map((e) => e.call_id))],
      digest: dest,
      transcripts: pairs.map((p) => p.stem),
      warnings: unknown.length ? [`unknown_brief_ids:${unknown.join(",")}`] : [],
    };
  }

  return err("action_required");
}

async function main() {
  const args = parseArgs(process.argv, { actions: BANK_ACTIONS });
  if (args.help) {
    console.log("bank.mjs --campaign-dir <abs> --refresh|--list-flags|--digest|--list-held|--clear-flag|--set-publish|--accept-call|--reclassify");
    return;
  }
  if (args.foreignFlag) fail("foreign_flag", { flag: args.foreignFlag });
  if (args.unknown) fail("unknown_flag", { flag: args.unknown });
  const result = await run(args);
  if (result?.error) fail(result.error, result);
  console.log(JSON.stringify(result));
}

if (process.argv[1]?.endsWith("bank.mjs")) {
  main();
}
