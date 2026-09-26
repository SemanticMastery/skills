import fs from "node:fs";
import path from "node:path";
import { pipelineDir, resolveSeriesRecordPath } from "./paths.mjs";
import { extractClustersFromMarkdown } from "./roadmap-clusters.mjs";

const TOPIC_CAP = 12;

export function topicsFromRoadmap(campaignDir) {
  const roadmap = path.join(pipelineDir(campaignDir), "02-plan", "editorial-roadmap.md");
  if (!fs.existsSync(roadmap)) return [];
  const { clusters } = extractClustersFromMarkdown(fs.readFileSync(roadmap, "utf8"));
  return (clusters || []).map((c) => c.name).slice(0, TOPIC_CAP);
}

export function parseCadence(raw, byday) {
  const token = String(raw || "biweekly").toLowerCase();
  const day = String(byday || "").toUpperCase() || undefined;
  if (token === "monthly") return { freq: "monthly", interval: 1, byday: day };
  if (token === "weekly") return { freq: "weekly", interval: 1, byday: day || "MO" };
  if (token === "biweekly") return { freq: "weekly", interval: 2, byday: day || "MO" };
  return { error: "cadence_invalid", cadence: token };
}

export function cadenceLabel(cadence) {
  if (!cadence) return "";
  if (cadence.freq === "monthly") return "monthly";
  if (cadence.freq === "weekly" && Number(cadence.interval) === 2) return "biweekly";
  if (cadence.freq === "weekly") return "weekly";
  return `${cadence.freq}/${cadence.interval}`;
}

export function isWorkersDevLink(url) {
  try {
    return new URL(url).hostname.toLowerCase().endsWith("workers.dev");
  } catch {
    return false;
  }
}

export function conflictCopyPresent(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) return false;
  const base = path.basename(filePath, path.extname(filePath));
  return fs.readdirSync(dir).some(
    (name) =>
      name !== path.basename(filePath) &&
      name.startsWith(base) &&
      /DESKTOP|conflicted copy/i.test(name),
  );
}

export function atomicWrite(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, contents);
  fs.renameSync(tmp, filePath);
}

export function loadSeriesRecord(campaignDir) {
  const { json } = resolveSeriesRecordPath(campaignDir);
  if (!fs.existsSync(json)) return null;
  return JSON.parse(fs.readFileSync(json, "utf8"));
}

export function renderSeriesMd(record) {
  const cal = record.calendar || {};
  return [
    `# ${record.company_name || record.campaign} expert interview series`,
    "",
    `- series_id: ${record.series_id}`,
    `- speaker: ${record.speaker}`,
    `- status: ${record.status}`,
    `- cadence: ${cadenceLabel(record.cadence)}`,
    `- timezone: ${record.timezone}`,
    `- link: ${record.link || ""}`,
    `- calendar: ${cal.state || "pending"}`,
    "",
  ].join("\n");
}

export function writeSeriesRecord(campaignDir, record) {
  const pair = resolveSeriesRecordPath(campaignDir);
  atomicWrite(pair.json, `${JSON.stringify(record, null, 2)}\n`);
  atomicWrite(pair.md, renderSeriesMd(record));
  return pair;
}

export function walkSeriesRecords(clientsRoot) {
  const found = [];
  function walk(dir, depth) {
    if (depth > 8 || !fs.existsSync(dir)) return;
    const base = path.basename(dir);
    if (base === "node_modules" || base === ".cursor") return;
    let names;
    try {
      names = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of names) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (entry.isFile() && entry.name.endsWith("-expert-interview-series.json")) {
        try {
          found.push({ path: full, data: JSON.parse(fs.readFileSync(full, "utf8")) });
        } catch {
          /* skip */
        }
      }
    }
  }
  walk(clientsRoot, 0);
  return found;
}
