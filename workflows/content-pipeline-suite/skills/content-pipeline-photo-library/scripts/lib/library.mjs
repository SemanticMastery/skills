import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isCountyTag } from "./taxonomy.mjs";

const SKILL_TEMPLATE_CLASSIFIER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "templates",
  "classify.mjs",
);

export const STATUSES = ["inbox", "review", "approved", "rejected"];

export const FLAG_KEYS = [
  "has_text",
  "has_logo",
  "likely_ugc",
  "has_people",
  "off_topic",
  "ephemeral_promo",
];

export const MANIFEST_NAME = "library-manifest.json";
export const SOURCES_NAME = "sources.md";
export const QUEUE_NAME = "review-queue.md";
export const CAMPAIGN_CLASSIFIER_NAME = "classify.mjs";

/** Standard image types only. `.bin` and other non-image types are never ingested. */
export const ALLOWED_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

export function normalizeImageExt(ext) {
  const raw = String(ext || "").toLowerCase();
  const withDot = raw.startsWith(".") ? raw : `.${raw}`;
  return withDot === ".jpeg" ? ".jpg" : withDot;
}

export function isAllowedImageExt(ext) {
  const e = normalizeImageExt(ext);
  return e === ".jpg" || e === ".png" || e === ".webp" || e === ".gif";
}

export function isAllowedImagePath(relPath) {
  return isAllowedImageExt(path.extname(String(relPath || "")));
}

/**
 * Detect a standard image from magic bytes. Returns `.jpg` / `.png` / `.webp` / `.gif`
 * or `null`. Never returns `.bin`.
 */
export function imageExtFromBytes(buf) {
  if (!buf || buf.length < 3) return null;
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return ".png";
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) return ".jpg";
  if (
    buf.length >= 12 &&
    buf.slice(0, 4).toString("ascii") === "RIFF" &&
    buf.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    return ".webp";
  }
  if (buf.length >= 6) {
    const gif = buf.slice(0, 6).toString("ascii");
    if (gif === "GIF87a" || gif === "GIF89a") return ".gif";
  }
  return null;
}

export const LIBRARY_REL = path.join("01-resources", "image-library");
export const LIBRARY_REL_LEGACY = path.join("04-publish", "image-library");

export function canonicalLibraryDir(pipelineDir) {
  return path.join(pipelineDir, "01-resources", "image-library");
}

export function legacyLibraryDir(pipelineDir) {
  return path.join(pipelineDir, "04-publish", "image-library");
}

function looksLikeLibrary(dir) {
  if (!dir || !fs.existsSync(dir)) return false;
  return [
    MANIFEST_NAME,
    SOURCES_NAME,
    CAMPAIGN_CLASSIFIER_NAME,
    QUEUE_NAME,
    "inbox",
    "review",
    "approved",
  ].some((name) => fs.existsSync(path.join(dir, name)));
}

/**
 * Campaign photo library home.
 * Canonical: `{pipeline}/01-resources/image-library/`.
 * Falls back to `{pipeline}/04-publish/image-library/` only when that folder
 * already has library files and the canonical path does not.
 */
export function libraryDir(pipelineDir) {
  const next = canonicalLibraryDir(pipelineDir);
  if (looksLikeLibrary(next)) return next;
  const legacy = legacyLibraryDir(pipelineDir);
  if (looksLikeLibrary(legacy)) return legacy;
  return next;
}

/** Campaign-owned Gemini prompt. Missing file is a classify hard-stop. */
export function campaignClassifierPath(pipelineDir) {
  return path.join(libraryDir(pipelineDir), CAMPAIGN_CLASSIFIER_NAME);
}

/**
 * Copy the unedited skill template into this campaign once.
 * Never overwrites an existing campaign classify.mjs.
 */
export function seedCampaignClassifierTemplate(pipelineDir) {
  const dest = campaignClassifierPath(pipelineDir);
  if (fs.existsSync(dest)) return { dest, seeded: false };
  if (!fs.existsSync(SKILL_TEMPLATE_CLASSIFIER)) {
    const err = new Error(
      `Missing skill classifier template at ${SKILL_TEMPLATE_CLASSIFIER}`,
    );
    err.code = "MISSING_CLASSIFIER_TEMPLATE";
    throw err;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(SKILL_TEMPLATE_CLASSIFIER, dest);
  return { dest, seeded: true };
}

const SKILL_SCRIPTS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SKILL_ROOT_DIR = path.join(SKILL_SCRIPTS_DIR, "..");

/** Writer-facing copies under `{pipeline}/scripts/`. Always refresh from the skill. */
export const CAMPAIGN_HELPER_RELS = [
  "match-library.mjs",
  "check-helpers.mjs",
  "lib/campaign.mjs",
  "lib/library.mjs",
  "lib/taxonomy.mjs",
];

export function campaignScriptsDir(pipelineDir) {
  return path.join(pipelineDir, "scripts");
}

/**
 * Copy 3.5-images helpers into this campaign so writers can run matcher/Fal
 * from SharePoint-visible paths (no `{skill_root}` / `{ops_skill_root}`).
 * Overwrites skill-owned helper copies. Never touches `classify.mjs`.
 */
export function seedCampaignImageHelpers(pipelineDir) {
  const destRoot = campaignScriptsDir(pipelineDir);
  fs.mkdirSync(path.join(destRoot, "lib"), { recursive: true });
  const copied = [];
  for (const rel of CAMPAIGN_HELPER_RELS) {
    const src = path.join(SKILL_SCRIPTS_DIR, rel);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(destRoot, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    copied.push(rel);
  }
  const falSrc = path.join(
    SKILL_ROOT_DIR,
    "..",
    "content-pipeline-run",
    "scripts",
    "fal-generate.mjs",
  );
  if (fs.existsSync(falSrc)) {
    fs.copyFileSync(falSrc, path.join(destRoot, "fal-generate.mjs"));
    copied.push("fal-generate.mjs");
  }
  const readmeSrc = path.join(
    SKILL_ROOT_DIR,
    "templates",
    "campaign-scripts-README.md",
  );
  if (fs.existsSync(readmeSrc)) {
    fs.copyFileSync(readmeSrc, path.join(destRoot, "README.md"));
    copied.push("README.md");
  }
  return { dest: destRoot, copied };
}

export function planTaxonomyPath(pipelineDir) {
  return path.join(pipelineDir, "02-plan", "siteswarm-tag-taxonomy.md");
}

export function publishTaxonomyPath(pipelineDir) {
  return path.join(pipelineDir, "04-publish", "siteswarm-tag-taxonomy.md");
}

/**
 * Init-owned SoT is `02-plan/siteswarm-tag-taxonomy.md`.
 * Fall back to an existing `04-publish/` copy. Missing both → 02-plan path
 * so loadTaxonomyFile hard-stops on the write target.
 */
export function taxonomyPath(pipelineDir) {
  const plan = planTaxonomyPath(pipelineDir);
  const publish = publishTaxonomyPath(pipelineDir);
  if (fs.existsSync(plan)) return plan;
  if (fs.existsSync(publish)) return publish;
  return plan;
}

export function statusDir(libDir, status) {
  return path.join(libDir, status);
}

export function emptyFlags() {
  return {
    has_text: false,
    has_logo: false,
    likely_ugc: false,
    has_people: false,
    off_topic: false,
    ephemeral_promo: false,
  };
}

const EPHEMERAL_CAPTION =
  /\b(donate|venmo|gofundme|fundrais|fundraiser|all funds are allocated|not everyone is in a position to donate|this week only|limited[- ]time|ends (today|tonight|sunday|monday))\b/i;

export function isEphemeralCaption(caption) {
  return EPHEMERAL_CAPTION.test(String(caption || ""));
}

export function emptyManifest({ campaignDir = "", pipelineDir = "" } = {}) {
  return {
    schema_version: 1,
    skill: "content-pipeline-photo-library",
    campaign_dir: campaignDir,
    pipeline_dir: pipelineDir,
    updated_at: new Date().toISOString(),
    items: [],
  };
}

export function ensureLibraryTree(libDir) {
  fs.mkdirSync(libDir, { recursive: true });
  for (const s of STATUSES) {
    fs.mkdirSync(statusDir(libDir, s), { recursive: true });
  }
  const manifestPath = path.join(libDir, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) {
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(emptyManifest(), null, 2) + "\n",
      "utf8",
    );
  }
  return libDir;
}

export function loadManifest(libDir) {
  const p = path.join(libDir, MANIFEST_NAME);
  if (!fs.existsSync(libDir) || !fs.existsSync(p)) {
    return emptyManifest();
  }
  const raw = fs.readFileSync(p, "utf8");
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyManifest();
    if (!Array.isArray(parsed.items)) parsed.items = [];
    return parsed;
  } catch {
    const err = new Error(`Invalid JSON in ${p}`);
    err.code = "INVALID_MANIFEST";
    throw err;
  }
}

export function saveManifest(libDir, manifest) {
  ensureLibraryTree(libDir);
  manifest.updated_at = new Date().toISOString();
  fs.writeFileSync(
    path.join(libDir, MANIFEST_NAME),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8",
  );
}

export function sha256Buffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function tagsOutsideAllowlist(tags, allowlist) {
  if (!allowlist) return [];
  const set = new Set(allowlist);
  return (tags || []).filter((t) => !set.has(t));
}

export function validateItem(item, { allowlist } = {}) {
  const errors = [];
  if (!item || typeof item !== "object") {
    return { ok: false, errors: ["item is not an object"] };
  }
  if (!item.id) errors.push("missing id");
  if (!STATUSES.includes(item.status)) {
    errors.push(`invalid status ${item.status}`);
  }
  if (item.status === "rejected" && !item.rel_path) {
    // purged binary — manifest row remains so ingest can skip
  } else if (item.rel_path && item.status) {
    const expectedPrefix = `${item.status}/`;
    const norm = String(item.rel_path).replace(/\\/g, "/");
    if (!norm.startsWith(expectedPrefix)) {
      errors.push(
        `rel_path ${item.rel_path} does not match status folder ${item.status}/`,
      );
    }
  }
  const proposedBad = tagsOutsideAllowlist(item.proposed_tags, allowlist);
  const approvedBad = tagsOutsideAllowlist(item.approved_tags, allowlist);
  if (proposedBad.length) {
    errors.push(`proposed_tags outside allowlist: ${proposedBad.join(", ")}`);
  }
  if (approvedBad.length) {
    errors.push(`approved_tags outside allowlist: ${approvedBad.join(", ")}`);
  }
  return { ok: errors.length === 0, errors };
}

export function validateManifest(manifest, { allowlist } = {}) {
  const errors = [];
  if (!manifest || typeof manifest !== "object") {
    return { ok: false, errors: ["manifest is not an object"] };
  }
  if (!Array.isArray(manifest.items)) {
    return { ok: false, errors: ["manifest.items must be an array"] };
  }
  for (const item of manifest.items) {
    const r = validateItem(item, { allowlist });
    if (!r.ok) {
      errors.push(`${item?.id || "(no id)"}: ${r.errors.join("; ")}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Matcher helper. Reads manifest rows with status=approved.
 * Does not glob approved/ as the tag source.
 * Missing library folder → empty list (not a crash).
 */
export function loadApprovedItems(libDir) {
  if (!libDir || !fs.existsSync(libDir)) return [];
  const manifest = loadManifest(libDir);
  return (manifest.items || []).filter(
    (it) => it.status === "approved" && isAllowedImagePath(it.rel_path),
  );
}

export function findItem(manifest, id) {
  return (manifest.items || []).find((it) => it.id === id) || null;
}

export function upsertItem(manifest, item) {
  const idx = manifest.items.findIndex((it) => it.id === item.id);
  if (idx === -1) manifest.items.push(item);
  else manifest.items[idx] = item;
  return manifest;
}

export function rejectedSourceIds(manifest) {
  const ids = new Set();
  for (const it of manifest.items || []) {
    if (it.status === "rejected" && it.source_media_id) {
      ids.add(String(it.source_media_id));
    }
  }
  return ids;
}

export function existingHashes(manifest) {
  const hashes = new Set();
  for (const it of manifest.items || []) {
    if (it.sha256) hashes.add(it.sha256);
  }
  return hashes;
}

export function existingSourceIds(manifest) {
  const ids = new Set();
  for (const it of manifest.items || []) {
    if (it.source_media_id) ids.add(String(it.source_media_id));
  }
  return ids;
}

export function binaryPath(libDir, item) {
  if (!item?.rel_path) return null;
  const rel = String(item.rel_path).replace(/\\/g, "/").replace(/^\/+/, "");
  if (!rel || rel === "." || rel.includes("..")) return null;
  const resolved = path.resolve(libDir, rel);
  const root = path.resolve(libDir);
  if (resolved === root || !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

export function itemBinaryExists(libDir, item) {
  const from = binaryPath(libDir, item);
  return Boolean(from && fs.existsSync(from) && fs.statSync(from).isFile());
}

/** Allowlist tag → filename slug. "Tree Pruning" → "tree-pruning". */
export function tagToSlug(tag) {
  return String(tag || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** First topic tag for the filename. County tags stay on the manifest only. */
export function primaryFilenameTag(tags) {
  const list = (Array.isArray(tags) ? tags : []).filter(Boolean);
  return list.find((t) => !isCountyTag(t)) || list[0] || "";
}

/**
 * Stable unique stem. Avoids `gbp_gbp_contrib_…` when source_media_id
 * already starts with the platform (`gbp_contrib_…`).
 */
export function uniqueFileStem(item) {
  const platform = String(item.source_platform || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const mediaId = String(item.source_media_id || "").trim();
  if (mediaId && platform) {
    const mediaLower = mediaId.toLowerCase();
    if (mediaLower === platform || mediaLower.startsWith(`${platform}_`)) {
      return mediaId;
    }
    return `${platform}_${mediaId}`;
  }
  if (mediaId) return mediaId;
  return String(item.id || "photo");
}

export function labeledApprovedBasename(item, ext) {
  const tags = item.approved_tags?.length ? item.approved_tags : item.proposed_tags;
  const slug = tagToSlug(primaryFilenameTag(tags));
  const stem = uniqueFileStem(item);
  const safeExt = !ext ? ".png" : ext.startsWith(".") ? ext : `.${ext}`;
  if (!slug) return `${stem}${safeExt}`;
  return `${slug}_${stem}${safeExt}`;
}

/** Delete the binary. Keep the manifest row (`status=rejected`, empty rel_path). */
export function deleteItemBinary(libDir, item) {
  const from = binaryPath(libDir, item);
  if (from && fs.existsSync(from)) {
    const stat = fs.statSync(from);
    if (!stat.isFile()) {
      const err = new Error(`Refusing to delete non-file for ${item.id}: ${from}`);
      err.code = "BAD_BINARY_PATH";
      throw err;
    }
    fs.unlinkSync(from);
  }
  item.status = "rejected";
  item.rel_path = "";
  item.purged_at = new Date().toISOString();
  return item;
}

export function moveItemBinary(libDir, item, nextStatus) {
  if (nextStatus === "rejected") {
    return deleteItemBinary(libDir, item);
  }
  const from = binaryPath(libDir, item);
  if (!from || !fs.existsSync(from)) {
    const err = new Error(
      `Missing binary for ${item.id}: ${from || item.rel_path || "(empty rel_path)"}`,
    );
    err.code = "MISSING_BINARY";
    throw err;
  }
  const ext = path.extname(item.rel_path) || path.extname(from) || ".png";
  const destNameRaw =
    nextStatus === "approved" ? labeledApprovedBasename(item, ext) : `${item.id}${ext}`;
  const destDir = statusDir(libDir, nextStatus);
  fs.mkdirSync(destDir, { recursive: true });
  const destName = uniqueBasename(destDir, destNameRaw);
  const dest = path.join(destDir, destName);
  fs.renameSync(from, dest);
  item.status = nextStatus;
  item.rel_path = `${nextStatus}/${destName}`.replace(/\\/g, "/");
  return item;
}

/** Rename an already-approved file to the tag + unique-stem contract. */
export function relabelApprovedItem(libDir, item) {
  if (item.status !== "approved") return item;
  const from = binaryPath(libDir, item);
  if (!from || !fs.existsSync(from)) {
    const err = new Error(`Missing binary for ${item.id}: ${item.rel_path || "(empty rel_path)"}`);
    err.code = "MISSING_BINARY";
    throw err;
  }
  const ext = path.extname(item.rel_path) || path.extname(from) || ".png";
  const destNameRaw = labeledApprovedBasename(item, ext);
  const destDir = statusDir(libDir, "approved");
  const currentName = path.basename(from);
  if (currentName === destNameRaw) {
    item.rel_path = `approved/${destNameRaw}`.replace(/\\/g, "/");
    return item;
  }
  const destName = uniqueBasename(destDir, destNameRaw);
  fs.renameSync(from, path.join(destDir, destName));
  item.rel_path = `approved/${destName}`.replace(/\\/g, "/");
  return item;
}

export function relabelApprovedItems(libDir, manifest) {
  let renamed = 0;
  for (const item of manifest.items || []) {
    if (item.status !== "approved") continue;
    const before = item.rel_path;
    relabelApprovedItem(libDir, item);
    if (item.rel_path !== before) renamed += 1;
  }
  return renamed;
}

/** Delete rejected binaries (manifest rows + leftover files in rejected/). */
export function purgeRejectedBinaries(libDir, manifest) {
  let deleted = 0;
  for (const item of manifest.items || []) {
    if (item.status !== "rejected") continue;
    const from = binaryPath(libDir, item);
    if (from && fs.existsSync(from) && fs.statSync(from).isFile()) {
      fs.unlinkSync(from);
      deleted += 1;
    }
    if (item.rel_path) {
      item.rel_path = "";
      item.purged_at = item.purged_at || new Date().toISOString();
    }
  }
  const rejDir = statusDir(libDir, "rejected");
  if (fs.existsSync(rejDir)) {
    for (const name of fs.readdirSync(rejDir)) {
      const p = path.join(rejDir, name);
      let st;
      try {
        st = fs.statSync(p);
      } catch {
        continue;
      }
      if (st.isFile()) {
        fs.unlinkSync(p);
        deleted += 1;
      }
    }
  }
  return deleted;
}

export function uniqueBasename(dir, base) {
  let name = base;
  let n = 1;
  while (fs.existsSync(path.join(dir, name))) {
    const ext = path.extname(base);
    const stem = path.basename(base, ext);
    name = `${stem}-${n}${ext}`;
    n += 1;
  }
  return name;
}
