#!/usr/bin/env node
/**
 * Recurring agency calendar event. Prints gws commands; --create runs the injected or live runner.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fail, parseArgs } from "./lib/args.mjs";
import { loadAgencySettings, requireGwsClientEnv } from "./lib/agency.mjs";
import {
  eventPayload,
  gwsDeleteArgv,
  gwsDeleteCommand,
  gwsInsertArgv,
  gwsInsertCommand,
  gwsPatchArgv,
  gwsPatchCommand,
  loginCommand,
  nextOccurrenceIso,
} from "./lib/gws.mjs";
import { requireCampaign, resolveCampaignDir } from "./lib/paths.mjs";
import { loadSeriesRecord, writeSeriesRecord } from "./lib/series-record.mjs";

export const CALENDAR_ACTIONS = ["preview", "create", "retry", "updateLink", "cancel", "pause", "resume", "setCadence"];

function err(code, extra) {
  return { error: code, ...extra };
}

/** Windows cannot spawn npm `.ps1` / `.cmd` shims (ENOENT / EINVAL). Run the CLI JS via node. */
export function gwsInvocation(env = process.env) {
  if (process.platform === "win32") {
    const js = path.join(env.APPDATA || "", "npm", "node_modules", "@googleworkspace", "cli", "run-gws.js");
    if (existsSync(js)) return { bin: process.execPath, prefix: [js] };
    return { bin: env.ComSpec || "cmd.exe", prefix: ["/d", "/s", "/c", "gws"] };
  }
  return { bin: "gws", prefix: [] };
}

export async function run(args, { env = process.env, runner, now = Date.now() } = {}) {
  const campaignDir = resolveCampaignDir(args);
  requireCampaign(campaignDir);
  const client = requireGwsClientEnv(env);
  if (client.error) return client;

  const loaded = loadAgencySettings(campaignDir);
  if (loaded.error) return loaded;
  const { settings } = loaded;
  const record = loadSeriesRecord(campaignDir);
  if (!record) return err("series_not_found");

  const event = eventPayload(record, settings, { startIso: nextOccurrenceIso(record, now) });
  const insertCmd = gwsInsertCommand({ settings, event, dryRun: Boolean(args.preview) || !args.create && !args.retry && !args.resume });

  if (args.preview) {
    return {
      ok: true,
      action: "preview",
      command: `${insertCmd}`,
      rrule: event.recurrence[0],
      timeZone: event.start.timeZone,
      env: { GOOGLE_WORKSPACE_CLI_CONFIG_DIR: settings.gws_config_dir },
    };
  }

  async function exec(command, argv) {
    if (typeof runner === "function") return runner(command, { settings, record, event, argv });
    const { bin, prefix } = gwsInvocation(env);
    const r = spawnSync(bin, [...prefix, ...argv], {
      encoding: "utf8",
      env: { ...env, GOOGLE_WORKSPACE_CLI_CONFIG_DIR: settings.gws_config_dir },
      windowsHide: true,
    });
    const stdout = String(r.stdout || "").trim();
    const stderr = String(r.stderr || "").trim();
    let parsed = null;
    try {
      parsed = stdout ? JSON.parse(stdout) : null;
    } catch {
      parsed = null;
    }
    if (r.error || r.status !== 0) {
      const detail = parsed?.error || stderr || stdout || r.error?.message || "gws_failed";
      return { error: detail, login: loginCommand(settings.gws_config_dir) };
    }
    return parsed || { ok: true };
  }

  if (args.create || args.retry || args.resume) {
    const result = await exec(
      gwsInsertCommand({ settings, event, dryRun: false }),
      gwsInsertArgv({ settings, event, dryRun: false }),
    );
    if (result?.error || result?.ok === false) {
      record.calendar = { state: "pending", error: result.error || result.message || "gws_failed" };
      writeSeriesRecord(campaignDir, record);
      return { ok: false, action: "create", record, error: record.calendar.error };
    }
    record.calendar = {
      state: "created",
      calendar_event_id: result.id || result.event_id || "evt-mock",
      calendar_id: settings.calendar_id || "primary",
    };
    writeSeriesRecord(campaignDir, record);
    return { ok: true, action: args.resume ? "resume" : "create", record };
  }

  if (args.cancel || args.pause) {
    const eventId = record.calendar?.calendar_event_id;
    const command = gwsDeleteCommand({ settings, eventId });
    await exec(command, gwsDeleteArgv({ settings, eventId }));
    record.calendar = { ...(record.calendar || {}), state: args.pause ? "paused" : "cancelled" };
    writeSeriesRecord(campaignDir, record);
    return { ok: true, action: args.pause ? "pause" : "cancel", command, record };
  }

  if (args.updateLink || args.setCadence) {
    const eventId = record.calendar?.calendar_event_id;
    const command = gwsPatchCommand({ settings, eventId, event });
    await exec(command, gwsPatchArgv({ settings, eventId, event }));
    record.calendar = { ...(record.calendar || {}), state: "created" };
    writeSeriesRecord(campaignDir, record);
    return { ok: true, action: args.updateLink ? "update-link" : "set-cadence", command, record };
  }

  return err("action_required", { login: loginCommand(settings.gws_config_dir) });
}

async function main() {
  const args = parseArgs(process.argv, { actions: CALENDAR_ACTIONS });
  if (args.help) {
    console.log("calendar.mjs --campaign-dir <abs> --preview|--create|--retry|--update-link|--cancel");
    return;
  }
  if (args.foreignFlag) fail("foreign_flag", { flag: args.foreignFlag });
  if (args.unknown) fail("unknown_flag", { flag: args.unknown });
  const result = await run(args);
  if (result?.error) fail(result.error, result);
  if (result?.command && result.action === "preview") console.log(result.command);
  console.log(JSON.stringify(result));
}

if (process.argv[1]?.endsWith("calendar.mjs")) {
  main();
}
