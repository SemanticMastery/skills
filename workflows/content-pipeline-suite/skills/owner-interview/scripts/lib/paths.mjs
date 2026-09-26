import fs from "node:fs";
import path from "node:path";
import { fail } from "./args.mjs";

export function resolveCampaignDir(args) {
  const raw = args.campaignDir;
  if (!raw) fail("campaign_dir_required");
  if (!path.isAbsolute(raw)) fail("campaign_dir_not_absolute", { campaignDir: raw });
  return path.resolve(raw);
}

export function requireCampaign(campaignDir) {
  if (!campaignDir || !fs.existsSync(campaignDir)) {
    fail("campaign_dir_not_found", { campaignDir });
  }
  const base = path.basename(campaignDir);
  if (base === "01-resources" || base === "06-content-pipeline" || base === "1.1-docs" || base === "interviews") {
    fail("campaign_dir_not_campaign_root", { campaignDir });
  }
}

export function companySlug(campaignDir) {
  return path.basename(campaignDir);
}

/** Parent folder of the campaign — Golden Image `{Agency}`. */
export function agencySlug(campaignDir) {
  return path.basename(path.dirname(campaignDir));
}

/** URL slug from the agency folder: Example-Agency → example-agency. Not from the display name. */
export function agencyUrlSlug(campaignDir) {
  return String(agencySlug(campaignDir) || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Owner page `/i/{agency}/{session}`; voice `/v/{agency}/{session}`. `/s/{id}` stays valid. */
export function brandedSessionUrl({ fallbackUrl, agencySlug: slug, sessionId, agentKind = "owner" } = {}) {
  const raw = String(fallbackUrl || "").trim();
  if (!sessionId || !raw) return raw;
  let origin;
  try {
    origin = new URL(raw).origin;
  } catch {
    return raw;
  }
  const s = String(slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!s) return raw;
  if (agentKind === "voice") return `${origin}/v/${s}/${sessionId}`;
  return `${origin}/i/${s}/${sessionId}`;
}

/** People-facing title for the `company` interview scope. Not "Company-wide". */
export const COMPANY_SCOPE_TITLE = "Company Details";

function isLegacyCompanyTitle(value) {
  return /^(company[- ]wide|company wide)$/i.test(String(value || "").trim());
}

/** Folder slug for people-facing copy: Ridgeline-Tree-Care → Ridgeline Tree Care. */
export function displayLabel(value) {
  return String(value || "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Agency folder for page copy: Example-Agency → Tree Care HQ. */
export function agencyDisplayName(value) {
  return displayLabel(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

/** Offering slug for the interview page: deep-root-fertilization → Deep Root Fertilization. */
export function serviceTitle(scope, explicit) {
  const named = String(explicit || "").trim();
  if (named) {
    if (isLegacyCompanyTitle(named) || /^company$/i.test(named)) return COMPANY_SCOPE_TITLE;
    return displayLabel(named);
  }
  const slug = String(scope || "").trim().toLowerCase();
  if (!slug || slug === "company") return COMPANY_SCOPE_TITLE;
  return displayLabel(slug)
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function intakeDocsDir(campaignDir) {
  return path.join(campaignDir, "01-intake", "1.1-docs");
}

const INTERVIEW_KINDS = new Set(["owner", "expert", "voice"]);

/** Live interview working files. Canonical PD / dossier / matrix stay in `1.1-docs/`. */
export function interviewWorkDir(campaignDir, kind) {
  const k = String(kind || "").trim().toLowerCase();
  if (!INTERVIEW_KINDS.has(k)) fail("interview_kind_invalid", { kind });
  return path.join(intakeDocsDir(campaignDir), "interviews", k);
}

/** New kind folder first, then legacy flat `1.1-docs/` for in-flight campaigns. */
export function interviewSearchDirs(campaignDir, kind) {
  return [interviewWorkDir(campaignDir, kind), intakeDocsDir(campaignDir)];
}

export function collectInterviewFiles(campaignDir, kind, predicate) {
  const seen = new Set();
  const out = [];
  for (const dir of interviewSearchDirs(campaignDir, kind)) {
    if (!fs.existsSync(dir)) continue;
    let names;
    try {
      names = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of names) {
      if (!entry.isFile()) continue;
      if (seen.has(entry.name)) continue;
      if (predicate && !predicate(entry.name)) continue;
      seen.add(entry.name);
      out.push({ name: entry.name, dir, path: path.join(dir, entry.name) });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function canonicalPdPath(campaignDir) {
  return path.join(intakeDocsDir(campaignDir), "Product-Documentation.md");
}

export function pipelineDir(campaignDir) {
  return path.join(campaignDir, "06-content-pipeline");
}

export function resourcesDir(campaignDir) {
  return path.join(pipelineDir(campaignDir), "01-resources");
}

export function pagesBriefDir(campaignDir) {
  return path.join(pipelineDir(campaignDir), "pages", "p.1-brief");
}

export function manifestPath(campaignDir) {
  return path.join(pipelineDir(campaignDir), "pipeline-pages-manifest.json");
}

export function interviewStem(campaignDir, scope, date) {
  const day = date || new Date().toISOString().slice(0, 10);
  return `${companySlug(campaignDir)}-owner-interview-${scope}-${day}`;
}

export function interviewPair(campaignDir, scope, date) {
  const stem = interviewStem(campaignDir, scope, date);
  const dir = interviewWorkDir(campaignDir, "owner");
  return {
    stem,
    json: path.join(dir, `${stem}.json`),
    md: path.join(dir, `${stem}.md`),
    basenameMd: `${stem}.md`,
    basenameJson: `${stem}.json`,
  };
}

export function linksManifestPair(campaignDir, date) {
  const day = date || new Date().toISOString().slice(0, 10);
  const stem = `${companySlug(campaignDir)}-interview-links-${day}`;
  const dir = interviewWorkDir(campaignDir, "owner");
  return {
    stem,
    json: path.join(dir, `${stem}.json`),
    md: path.join(dir, `${stem}.md`),
  };
}

export function transcriptStem(campaignDir, scope, date, n) {
  const day = date || new Date().toISOString().slice(0, 10);
  return `${companySlug(campaignDir)}-interview-transcript-${scope}-${day}-${n}`;
}

export function transcriptPair(campaignDir, scope, date, n) {
  const stem = transcriptStem(campaignDir, scope, date, n);
  const dir = interviewWorkDir(campaignDir, "owner");
  return {
    stem,
    json: path.join(dir, `${stem}.json`),
    md: path.join(dir, `${stem}.md`),
    basenameMd: `${stem}.md`,
    basenameJson: `${stem}.json`,
  };
}
