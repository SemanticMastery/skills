import fs from "node:fs";
import path from "node:path";
import { pipelineDir } from "./paths.mjs";

function collectBriefFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) collectBriefFiles(full, out);
    else if (/^post-.*-brief\.md$/i.test(name)) out.push(full);
  }
  return out;
}

export function parseUsedIds(markdown) {
  const line = String(markdown || "")
    .split(/\r?\n/)
    .find((l) => /^story bank entries used:/i.test(l.trim()));
  if (!line) return [];
  const rest = line.replace(/^story bank entries used:\s*/i, "").trim();
  if (!rest || /^none$/i.test(rest) || rest === "[]") return [];
  return rest
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function scanBriefUsedIds(campaignDir) {
  const briefRoot = path.join(pipelineDir(campaignDir), "03-write", "3.1-brief");
  const files = collectBriefFiles(briefRoot);
  const ids = [];
  const unknown = [];
  const seen = new Set();
  for (const file of files) {
    for (const id of parseUsedIds(fs.readFileSync(file, "utf8"))) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return { ids, files, unknown };
}
