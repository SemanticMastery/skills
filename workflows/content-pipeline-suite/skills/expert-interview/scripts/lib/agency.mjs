import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { agencySettingsPath, agencySlug } from "./paths.mjs";

const SYNCED = /onedrive|sharepoint|operations - documents/i;

export function defaultGwsConfigDir(slug) {
  return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "gws", slug);
}

export function isSyncedConfigDir(dir) {
  const n = String(dir || "").replace(/\//g, "\\");
  return SYNCED.test(n);
}

export function settingsTemplate(campaignDir) {
  const slug = agencySlug(campaignDir).toLowerCase();
  return {
    agency_slug: slug,
    calendar_id: "primary",
    inviter_email: "",
    gws_config_dir: defaultGwsConfigDir(slug),
  };
}

export function loadAgencySettings(campaignDir) {
  const settingsPath = agencySettingsPath(campaignDir);
  if (!fs.existsSync(settingsPath)) {
    return {
      error: "agency_settings_missing",
      path: settingsPath,
      template: settingsTemplate(campaignDir),
    };
  }
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  const configDir = settings.gws_config_dir || defaultGwsConfigDir(agencySlug(campaignDir).toLowerCase());
  if (isSyncedConfigDir(configDir)) {
    return { error: "config_dir_synced", gws_config_dir: configDir };
  }
  return { settings: { ...settings, gws_config_dir: configDir }, path: settingsPath };
}

export function requireGwsClientEnv(env = process.env) {
  if (!env.GOOGLE_WORKSPACE_CLI_CLIENT_ID || !env.GOOGLE_WORKSPACE_CLI_CLIENT_SECRET) {
    return { error: "gws_client_unset" };
  }
  return { ok: true };
}
