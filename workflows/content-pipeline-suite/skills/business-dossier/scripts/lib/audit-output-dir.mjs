/**
 * Resolve audit artifact folders under a client project directory.
 *
 * Golden Image / ICM (when `{projectDir}/01-intake/` exists):
 *   `{projectDir}/01-intake/1.2-audit/{gbp-categories|geographic-locations|brightlocal}/`
 * Legacy flat campaigns:
 *   `{projectDir}/audit/{…}/`
 */

import fs from 'fs';
import path from 'path';

export const AUDIT_FOLDER_NAME = 'audit';
/** Golden Image ICM audit slot (campaign-relative). */
export const GOLDEN_IMAGE_AUDIT_REL = path.join('01-intake', '1.2-audit');
export const GBP_CATEGORIES_SUBFOLDER = 'gbp-categories';
export const GEOGRAPHIC_LOCATIONS_SUBFOLDER = 'geographic-locations';
export const BRIGHTLOCAL_SUBFOLDER = 'brightlocal';
/** Client deliverable prefix: paste-{slug}-{YYYY-MM-DD}.{ext} */
export const GBP_CATEGORIES_PASTE_PREFIX = 'paste-';
export const GEOGRAPHIC_LOCATIONS_PASTE_PREFIX = 'paste-loc-';
/** Persistent Wikipedia resolution cache (not deleted on cleanup) */
export const GEOGRAPHIC_WIKI_CACHE_FILENAME = 'wikipedia-geography-cache.json';

/**
 * True when the campaign has been goldenized (ICM `01-intake/` present).
 * @param {string} projectDir
 * @returns {boolean}
 */
export function isGoldenImageCampaign(projectDir) {
  if (!projectDir || typeof projectDir !== 'string') return false;
  const intake = path.join(path.resolve(projectDir), '01-intake');
  return fs.existsSync(intake) && fs.statSync(intake).isDirectory();
}

/** Client-facing paste deliverables kept after a successful geographic-locations run */
export const GEOGRAPHIC_LOCATIONS_DELIVERABLE_EXT = [
  'docx',
  'html',
  'md',
  'rtf',
  'txt',
];
/** Legacy deliverable prefix (migrated to paste- on cleanup) */
export const GBP_CATEGORIES_PASTE_LEGACY_PREFIX = 'gbp-categories-audit-paste-';

/** Client-facing paste deliverables kept after a successful run */
export const GBP_CATEGORIES_DELIVERABLE_EXT = [
  'docx',
  'html',
  'md',
  'rtf',
  'txt',
];

/**
 * @param {string} projectDir — Client project folder root (not the audit subfolder).
 * @returns {string} Absolute path to ICM `01-intake/1.2-audit` or legacy `{projectDir}/audit`
 *   (or `projectDir` if it is already named `audit` / `1.2-audit`).
 */
export function resolveAuditOutputDir(projectDir) {
  if (!projectDir || typeof projectDir !== 'string') {
    throw new Error('project_dir is required');
  }

  const resolved = path.resolve(projectDir);
  const baseName = path.basename(resolved).toLowerCase();

  let auditDir;
  if (baseName === AUDIT_FOLDER_NAME.toLowerCase() || baseName === '1.2-audit') {
    auditDir = resolved;
  } else if (isGoldenImageCampaign(resolved)) {
    auditDir = path.join(resolved, GOLDEN_IMAGE_AUDIT_REL);
  } else {
    auditDir = path.join(resolved, AUDIT_FOLDER_NAME);
  }

  ensureDirectory(auditDir);
  return auditDir;
}

function ensureDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    if (!fs.statSync(dirPath).isDirectory()) {
      throw new Error(`${dirPath} exists but is not a directory`);
    }
    return;
  }
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * @param {string} projectDir — Client project folder root.
 * @returns {string} Absolute path to `{projectDir}/audit/gbp-categories`.
 */
export function resolveGbpCategoriesOutputDir(projectDir) {
  const auditDir = resolveAuditOutputDir(projectDir);
  const outDir = path.join(auditDir, GBP_CATEGORIES_SUBFOLDER);
  ensureDirectory(outDir);
  return outDir;
}

/**
 * @param {string} projectDir — Client project folder root.
 * @returns {string} Absolute path to `{projectDir}/audit/geographic-locations`.
 */
export function resolveGeographicLocationsOutputDir(projectDir) {
  const auditDir = resolveAuditOutputDir(projectDir);
  const outDir = path.join(auditDir, GEOGRAPHIC_LOCATIONS_SUBFOLDER);
  ensureDirectory(outDir);
  return outDir;
}

/**
 * @param {string} projectDir — Client project folder root.
 * @returns {string} Absolute path to `{projectDir}/audit/brightlocal`.
 */
export function resolveBrightlocalOutputDir(projectDir) {
  const auditDir = resolveAuditOutputDir(projectDir);
  const outDir = path.join(auditDir, BRIGHTLOCAL_SUBFOLDER);
  ensureDirectory(outDir);
  return outDir;
}

/**
 * Resolve a save path under `{projectDir}/audit/brightlocal/` when projectDir is set.
 * Absolute paths and explicit relative paths with directories are left unchanged.
 *
 * @param {string} projectDir — Client project folder root.
 * @param {string} filename — Basename or relative path (e.g. `brightlocal-keyword-update-2026-06-01.json`).
 * @returns {string}
 */
export function resolveBrightlocalArtifactPath(projectDir, filename) {
  if (!filename || typeof filename !== 'string') {
    throw new Error('filename is required');
  }
  const resolved = path.resolve(filename);
  if (path.isAbsolute(filename) || filename.includes('/') || filename.includes('\\')) {
    return resolved;
  }
  return path.join(resolveBrightlocalOutputDir(projectDir), filename);
}

/**
 * @param {string} filename — Basename only (no directory).
 * @returns {boolean}
 */
export function isGbpCategoriesDeliverable(filename) {
  if (filename.includes('-merged.')) return false;
  const ext = path.extname(filename).slice(1).toLowerCase();
  if (!GBP_CATEGORIES_DELIVERABLE_EXT.includes(ext)) return false;
  return (
    filename.startsWith(GBP_CATEGORIES_PASTE_PREFIX) ||
    filename.startsWith(GBP_CATEGORIES_PASTE_LEGACY_PREFIX)
  );
}

/**
 * @param {string} filename — Basename only (no directory).
 * @returns {string|null} Canonical deliverable basename (paste-{slug}-{date}.{ext})
 */
export function normalizeGbpCategoriesDeliverableName(filename) {
  if (!isGbpCategoriesDeliverable(filename)) return null;
  if (filename.startsWith(GBP_CATEGORIES_PASTE_PREFIX)) return filename;
  if (filename.startsWith(GBP_CATEGORIES_PASTE_LEGACY_PREFIX)) {
    return (
      GBP_CATEGORIES_PASTE_PREFIX +
      filename.slice(GBP_CATEGORIES_PASTE_LEGACY_PREFIX.length)
    );
  }
  return null;
}

/**
 * @param {string} filename — Basename only (no directory).
 * @returns {boolean}
 */
export function isGbpCategoriesIntermediate(filename) {
  if (isGbpCategoriesDeliverable(filename)) return false;
  if (filename.startsWith(GBP_CATEGORIES_PASTE_PREFIX)) return true;
  if (filename.startsWith('gbp-categories')) return true;
  return false;
}

/**
 * Remove intermediate GBP category artifacts; migrate legacy deliverables from
 * `audit/` root into `audit/gbp-categories/`.
 *
 * @param {string} projectDir — Client project folder root.
 * @param {{ deletePaths?: string[], migrateLegacy?: boolean }} [options]
 * @returns {{ deleted: string[], migrated: string[], deliverable_dir: string }}
 */
export function cleanupGbpCategoriesIntermediates(projectDir, options = {}) {
  const { deletePaths = [], migrateLegacy = true } = options;
  const auditDir = resolveAuditOutputDir(projectDir);
  const gbpDir = resolveGbpCategoriesOutputDir(projectDir);

  const deleted = [];
  const migrated = [];

  for (const extra of deletePaths) {
    if (extra && fs.existsSync(extra)) {
      fs.unlinkSync(extra);
      deleted.push(path.resolve(extra));
    }
  }

  for (const dir of [auditDir, gbpDir]) {
    if (!fs.existsSync(dir)) continue;

    for (const name of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, name);

      if (isGbpCategoriesDeliverable(name)) {
        const canonical = normalizeGbpCategoriesDeliverableName(name);
        const dest = path.join(gbpDir, canonical);

        if (migrateLegacy && dir === auditDir) {
          if (!fs.existsSync(dest)) {
            fs.renameSync(fullPath, dest);
            migrated.push(dest);
          } else {
            fs.unlinkSync(fullPath);
            deleted.push(fullPath);
          }
        } else if (dir === gbpDir && canonical !== name) {
          if (!fs.existsSync(dest)) {
            fs.renameSync(fullPath, dest);
            migrated.push(dest);
          } else {
            fs.unlinkSync(fullPath);
            deleted.push(fullPath);
          }
        }
        continue;
      }

      if (isGbpCategoriesIntermediate(name)) {
        fs.unlinkSync(fullPath);
        deleted.push(fullPath);
      }
    }
  }

  return {
    deleted,
    migrated,
    deliverable_dir: gbpDir,
  };
}

/**
 * @param {string} filename — Basename only (no directory).
 * @returns {boolean}
 */
export function isGeographicLocationsDeliverable(filename) {
  if (filename.includes('-merged.')) return false;
  const ext = path.extname(filename).slice(1).toLowerCase();
  if (!GEOGRAPHIC_LOCATIONS_DELIVERABLE_EXT.includes(ext)) return false;
  return filename.startsWith(GEOGRAPHIC_LOCATIONS_PASTE_PREFIX);
}

/**
 * @param {string} filename — Basename only (no directory).
 * @returns {boolean}
 */
export function isGeographicLocationsIntermediate(filename) {
  if (isGeographicLocationsDeliverable(filename)) return false;
  if (filename === GEOGRAPHIC_WIKI_CACHE_FILENAME) return false;
  if (filename.startsWith(GEOGRAPHIC_LOCATIONS_PASTE_PREFIX)) return true;
  if (filename.startsWith('geographic-locations-')) return true;
  return false;
}

/**
 * @param {string} projectDir — Client project folder root.
 * @param {{ deletePaths?: string[] }} [options]
 * @returns {{ deleted: string[], deliverable_dir: string }}
 */
export function cleanupGeographicLocationsIntermediates(projectDir, options = {}) {
  const { deletePaths = [] } = options;
  const auditDir = resolveAuditOutputDir(projectDir);
  const geoDir = resolveGeographicLocationsOutputDir(projectDir);

  const deleted = [];

  for (const extra of deletePaths) {
    if (extra && fs.existsSync(extra)) {
      fs.unlinkSync(extra);
      deleted.push(path.resolve(extra));
    }
  }

  for (const dir of [auditDir, geoDir]) {
    if (!fs.existsSync(dir)) continue;

    for (const name of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, name);

      if (isGeographicLocationsDeliverable(name)) {
        if (dir === auditDir) {
          const dest = path.join(geoDir, name);
          if (!fs.existsSync(dest)) {
            fs.renameSync(fullPath, dest);
          } else {
            fs.unlinkSync(fullPath);
            deleted.push(fullPath);
          }
        }
        continue;
      }

      if (isGeographicLocationsIntermediate(name)) {
        if (!fs.statSync(fullPath).isFile()) continue;
        fs.unlinkSync(fullPath);
        deleted.push(fullPath);
      }
    }
  }

  return { deleted, deliverable_dir: geoDir };
}

/**
 * Match client-facing SEO Audit docx filenames.
 * Accepts spaced or hyphenated titles (e.g. "Client Local SEO Audit.docx"
 * or "Client-Local-SEO-Audit.docx"). Excludes backup copies.
 * @param {string} filename — basename only
 */
export function isSeoAuditDocxFilename(filename) {
  if (!filename || !filename.toLowerCase().endsWith('.docx')) return false;
  if (/\.backup-/i.test(filename)) return false;
  const normalized = filename.replace(/-/g, ' ');
  return /seo audit/i.test(normalized);
}

/**
 * Candidate directories for client-facing *SEO Audit*.docx during Golden Image ICM
 * migration limbo:
 * 1. `{projectDir}/01-intake/1.2-audit/` — Golden Image / ICM (preferred when present)
 * 2. `{projectDir}/` — legacy flat campaign root
 *
 * After all clients are migrated, audits live only under `1.2-audit`.
 *
 * @param {string} projectDir — Client project folder root
 * @returns {string[]} Absolute directory paths to search (existing dirs only)
 */
export function resolveSeoAuditSearchDirs(projectDir) {
  if (!projectDir || typeof projectDir !== 'string') {
    throw new Error('project_dir is required');
  }
  const resolved = path.resolve(projectDir);
  const dirs = [
    path.join(resolved, '01-intake', '1.2-audit'),
    resolved,
  ];
  return dirs.filter((d) => fs.existsSync(d) && fs.statSync(d).isDirectory());
}

/**
 * @param {string} projectDir — Client project folder root
 * @returns {string} Absolute path to the SEO Audit docx
 */
export function discoverSeoAuditDocx(projectDir) {
  if (!projectDir || !fs.existsSync(projectDir)) {
    throw new Error(`Project dir not found: ${projectDir}`);
  }
  const searchDirs = resolveSeoAuditSearchDirs(projectDir);
  for (const dir of searchDirs) {
    const names = fs.readdirSync(dir);
    const match = names.find((n) => isSeoAuditDocxFilename(n));
    if (match) {
      return path.join(dir, match);
    }
  }
  throw new Error(
    `No *SEO Audit*.docx found under project root or 01-intake/1.2-audit: ${projectDir}`
  );
}
