#!/usr/bin/env node
/**
 * Series lifecycle: create, status, cadence, pause/end, rotate-link, inventory, sync-topics.
 */

import fs from "node:fs";
import path from "node:path";
import { fail, parseArgs } from "./lib/args.mjs";
import * as defaultHost from "./lib/host-client.mjs";
import {
  agencySlug,
  companySlug,
  displayLabel,
  requireCampaign,
  resolveCampaignDir,
  storyBankDigestPath,
} from "./lib/paths.mjs";
import {
  cadenceLabel,
  isWorkersDevLink,
  loadSeriesRecord,
  parseCadence,
  topicsFromRoadmap,
  writeSeriesRecord,
  walkSeriesRecords,
} from "./lib/series-record.mjs";

export const SERIES_ACTIONS = [
  "create",
  "status",
  "speaker",
  "email",
  "timezone",
  "cadence",
  "byday",
  "steering",
  "setCadence",
  "pause",
  "resume",
  "end",
  "rotateLink",
  "inventory",
  "clientsRoot",
  "syncTopics",
  "allowWorkersDev",
];

function err(code, extra) {
  return { error: code, ...extra };
}

function baseRecord(campaignDir, args) {
  const company = displayLabel(companySlug(campaignDir));
  const agency = displayLabel(agencySlug(campaignDir));
  return {
    agency_slug: agencySlug(campaignDir).toLowerCase(),
    campaign: companySlug(campaignDir),
    company_name: company,
    agency_name: agency,
    owner_name: args.speaker,
    speaker: args.speaker,
    spokesperson_email: args.email,
    timezone: args.timezone,
    steering: Boolean(args.steering),
    topics: [],
  };
}

export async function run(args, { host = defaultHost } = {}) {
  if (args.inventory) {
    const root = args.clientsRoot;
    if (!root || !path.isAbsolute(root)) return err("clients_root_required");
    const rows = walkSeriesRecords(root).map(({ path: recPath, data }) => {
      const campaignDir = path.resolve(path.dirname(recPath), "..", "..");
      const bankJson = storyBankDigestPath(campaignDir).replace(/\.md$/i, ".json");
      let fresh = 0;
      if (fs.existsSync(bankJson)) {
        try {
          const bank = JSON.parse(fs.readFileSync(bankJson, "utf8"));
          fresh = (bank.entries || []).filter((e) => e.status === "fresh").length;
        } catch {
          fresh = 0;
        }
      }
      return {
        series_id: data.series_id,
        campaign: data.campaign,
        agency_slug: data.agency_slug,
        status: data.status,
        speaker: data.speaker,
        link: data.link,
        fresh_entries: fresh,
        path: recPath,
      };
    });
    return { inventory: rows };
  }

  const campaignDir = resolveCampaignDir(args);
  requireCampaign(campaignDir);

  if (args.create) {
    if (!args.timezone) return err("timezone_required");
    if (!args.speaker) return err("speaker_required");
    if (!args.email) return err("email_required");
    const existing = loadSeriesRecord(campaignDir);
    if (existing && existing.status === "active") return err("series_active", { series_id: existing.series_id });
    const cadence = parseCadence(args.cadence || "biweekly", args.byday);
    if (cadence.error) return cadence;
    const payload = {
      ...baseRecord(campaignDir, args),
      cadence,
    };
    if (args.steering) payload.topics = topicsFromRoadmap(campaignDir);
    let created;
    try {
      created = await host.createSeries(payload);
    } catch (e) {
      return err("host_unreachable", { message: String(e?.message || e) });
    }
    const link = created.url || created.link || "";
    if (isWorkersDevLink(link) && !args.allowWorkersDev) {
      return err("link_origin_not_neutral", { link });
    }
    const record = {
      ...payload,
      series_id: created.series_id,
      link,
      link_token: created.link_token,
      status: created.status || "active",
      calendar: { state: "pending" },
    };
    writeSeriesRecord(campaignDir, record);
    return { ok: true, action: "create", record };
  }

  const record = loadSeriesRecord(campaignDir);
  if (!record) return err("series_not_found");

  if (args.status) {
    let remote = {};
    try {
      remote = await host.getSeries(record.series_id);
    } catch (e) {
      return err("host_unreachable", { message: String(e?.message || e) });
    }
    return { ok: true, action: "status", record: { ...record, ...remote, calendar: record.calendar } };
  }

  if (args.syncTopics) {
    const topics = topicsFromRoadmap(campaignDir);
    try {
      await host.patchSeries(record.series_id, { topics });
    } catch (e) {
      return err("host_unreachable", { message: String(e?.message || e) });
    }
    record.topics = topics;
    writeSeriesRecord(campaignDir, record);
    return { ok: true, action: "sync-topics", topics };
  }

  if (args.setCadence) {
    const cadence = parseCadence(args.setCadence, args.byday || record.cadence?.byday);
    if (cadence.error) return cadence;
    try {
      await host.patchSeries(record.series_id, { cadence });
    } catch (e) {
      return err("host_unreachable", { message: String(e?.message || e) });
    }
    record.cadence = cadence;
    record.calendar = { ...(record.calendar || {}), state: "needs_update" };
    writeSeriesRecord(campaignDir, record);
    return { ok: true, action: "set-cadence", cadence: cadenceLabel(cadence), record };
  }

  if (args.pause || args.resume || args.end) {
    const status = args.pause ? "paused" : args.end ? "ended" : "active";
    try {
      await host.patchSeries(record.series_id, { status });
    } catch (e) {
      return err("host_unreachable", { message: String(e?.message || e) });
    }
    record.status = status;
    record.calendar = { ...(record.calendar || {}), state: "needs_update" };
    writeSeriesRecord(campaignDir, record);
    return { ok: true, action: status, record };
  }

  if (args.rotateLink) {
    let rotated;
    try {
      rotated = await host.rotateSeriesLink(record.series_id);
    } catch (e) {
      return err("host_unreachable", { message: String(e?.message || e) });
    }
    record.link = rotated.url || rotated.link || record.link;
    record.link_token = rotated.link_token || record.link_token;
    record.calendar = { ...(record.calendar || {}), state: "needs_update" };
    writeSeriesRecord(campaignDir, record);
    return { ok: true, action: "rotate-link", record };
  }

  return err("action_required");
}

async function main() {
  const args = parseArgs(process.argv, { actions: SERIES_ACTIONS });
  if (args.help) {
    console.log("series.mjs --campaign-dir <abs> --create|--status|--set-cadence|--pause|--resume|--end|--rotate-link|--sync-topics|--inventory");
    return;
  }
  if (args.foreignFlag) fail("foreign_flag", { flag: args.foreignFlag });
  if (args.unknown) fail("unknown_flag", { flag: args.unknown });
  const result = await run(args);
  if (result?.error) fail(result.error, result);
  console.log(JSON.stringify(result));
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("series.mjs")) {
  main();
}
