import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OPS_SKILL_BANK = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "expert-interview",
  "scripts",
  "bank.mjs",
);

export function findSeriesRecord(campaignDir) {
  const dir = path.join(campaignDir, "01-intake", "1.1-docs");
  if (!fs.existsSync(dir)) return null;
  const name = fs.readdirSync(dir).find((n) => n.endsWith("-expert-interview-series.json"));
  return name ? path.join(dir, name) : null;
}

export function defaultBankScript() {
  return path.resolve(OPS_SKILL_BANK);
}

export function refreshStoryBank(campaignDir, opts = {}) {
  if (!findSeriesRecord(campaignDir)) return { skipped: "no_series" };
  const script = opts.bankScript || defaultBankScript();
  if (!fs.existsSync(script)) return { skipped: "skill_missing" };
  const spawn = opts.spawn || spawnSync;
  const r = spawn(process.execPath, [script, "--campaign-dir", campaignDir, "--refresh"], {
    encoding: "utf8",
    timeout: opts.timeoutMs || 60_000,
    env: opts.env || process.env,
  });
  const stdout = String(r.stdout || "").trim();
  let parsed = null;
  try {
    parsed = stdout ? JSON.parse(stdout) : null;
  } catch {
    parsed = null;
  }
  if (r.status !== 0 || parsed?.error) {
    return {
      warning: parsed?.error || `story_bank_refresh_failed:${r.status}`,
      story_bank: parsed,
    };
  }
  return {
    story_bank: {
      new_entries: parsed?.new_entries ?? 0,
      flags_open: parsed?.flags_open,
      digest: parsed?.digest,
    },
  };
}

export function attachStoryBank(result, campaignDir, opts = {}) {
  const refresh = refreshStoryBank(campaignDir, opts);
  if (refresh.skipped === "no_series") return result;
  if (refresh.skipped === "skill_missing") {
    result.warnings = [...(result.warnings || []), "skill_missing"];
    return result;
  }
  if (refresh.warning) {
    result.warnings = [...(result.warnings || []), refresh.warning];
  }
  if (refresh.story_bank) result.story_bank = refresh.story_bank;
  return result;
}
