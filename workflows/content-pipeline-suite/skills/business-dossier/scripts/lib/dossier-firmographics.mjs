/**
 * Parse [II] FIRMOGRAPHICS from Glen Patel business dossier markdown.
 *
 * Canonical [II] shape (markdown list of labeled fields):
 *   - **Name:** …
 *   - **Address:** street, City, ST ZIP
 *   - **Phone:** …
 *   - **Website:** …   (alias: Official Website)
 *   - **GBP URL:** …   (canonical https://www.google.com/maps?cid={CID})
 *   - **GBP CID:** …   (raw Company ID digits)
 *
 * Also accepts a legacy prose/semicolon [II] line and can normalize it.
 */

import fs from 'fs';
import path from 'path';
import {
  isGoldenImageCampaign,
  GOLDEN_IMAGE_AUDIT_REL,
} from './audit-output-dir.mjs';
import { parseCityStateFromWorkbook, normalizeState } from './geographic-wikipedia.mjs';

export { isGoldenImageCampaign };

/** Golden Image ICM intake slot (campaign-relative). */
export const GOLDEN_IMAGE_DOSSIER_REL = path.join('outputs', 'business-dossier');

/** Golden Image ICM on-page crawl / audit output slot (campaign-relative). */
export const GOLDEN_IMAGE_CRAWL_REL = GOLDEN_IMAGE_AUDIT_REL;

/** Legacy crawl output path (pre–Golden Image). */
export const LEGACY_CRAWL_REL = path.join('audit', 'crawl-report');

function listDossierMdInDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => /dossier\.md$/i.test(n) && !n.startsWith('~$'))
    .map((n) => path.join(dir, n));
}

/**
 * Resolve dossier output directory for a campaign folder.
 * Default: `{project}/outputs/business-dossier/`.
 * Legacy (no `01-intake/`): campaign root.
 *
 * @param {string} projectDir campaign folder (--project-dir)
 * @param {{ create?: boolean }} [opts]
 */
export function resolveDossierOutputDir(projectDir, { create = false } = {}) {
  const resolved = path.resolve(projectDir);
  const outputDir = path.join(resolved, GOLDEN_IMAGE_DOSSIER_REL);
  if (create) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
}

/**
 * Hyphenated dossier basename on disk (matches campaign workbook slug style).
 * @param {string} businessName display name from intake / NAPW
 * @returns {string} e.g. "Pikeville-Handyman-Services-Dossier"
 */
export function dossierFileBasename(businessName) {
  const slug = businessName
    .trim()
    .replace(/[''`]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug}-Dossier`;
}

/** Legacy spaced basename: `{Business Name} Dossier` (pre–2026-07 hyphen convention). */
export function legacyDossierBasename(businessName) {
  return `${businessName.trim()} Dossier`;
}

/**
 * @param {string} projectDir campaign folder
 * @param {string} businessName display name used in dossier basename
 * @param {{ createOutputDir?: boolean, outputDir?: string | null }} [opts]
 */
export function resolveDossierArtifactPaths(
  projectDir,
  businessName,
  { createOutputDir = false, outputDir = null } = {}
) {
  const baseName = dossierFileBasename(businessName);
  const dir =
    outputDir != null
      ? path.resolve(outputDir)
      : resolveDossierOutputDir(projectDir, { create: createOutputDir });
  if (createOutputDir && outputDir != null) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return {
    outputDir: dir,
    baseName,
    mdPath: path.join(dir, `${baseName}.md`),
    docxPath: path.join(dir, `${baseName}.docx`),
  };
}

/**
 * Find an existing dossier markdown by business name (Golden Image path first, legacy root second).
 * Accepts hyphenated `{slug}-Dossier.md` (current) or legacy `{Name} Dossier.md`.
 *
 * @param {string} projectDir
 * @param {string} businessName
 * @returns {string | null} absolute path to .md if found
 */
export function findExistingDossierMd(projectDir, businessName) {
  const resolved = path.resolve(projectDir);
  const goldenDir = path.join(resolved, GOLDEN_IMAGE_DOSSIER_REL);
  const candidates = [
    path.join(goldenDir, `${dossierFileBasename(businessName)}.md`),
    path.join(goldenDir, `${legacyDossierBasename(businessName)}.md`),
    path.join(resolved, `${legacyDossierBasename(businessName)}.md`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const REQUIRED_FIRMOGRAPHIC_KEYS = ['name', 'address', 'phone', 'website'];

const FIELD_ALIASES = {
  name: ['Name', 'Legal Name'],
  address: ['Address', 'Primary Address'],
  phone: ['Phone', 'Verified Phone'],
  website: ['Website', 'Official Website'],
  gbp_url: [
    'GBP URL',
    'GB Map Share URL',
    'Google Maps URL',
    'Google Business Profile URL',
    'GBP Share URL',
  ],
  gbp_cid: ['GBP CID', 'Maps CID', 'data_cid', 'Company ID', 'CID'],
  latitude: ['Latitude', 'Lat'],
  longitude: ['Longitude', 'Lng', 'Long'],
  geocode_source: ['Geocode source', 'Coordinate source'],
  geocoded_address: ['Geocoded address', 'Geocode display name'],
};

function normalizeDossierMarkdown(markdown) {
  return markdown.replace(/\\\[([IVX]+)\\\]/g, '[$1]');
}

function extractSectionII(markdown) {
  const text = normalizeDossierMarkdown(markdown);
  const match = text.match(
    /\[II\]\s*FIRMOGRAPHICS([\s\S]*?)(?=\[III\]|$)/i
  );
  return match ? match[1] : '';
}

function readField(section, aliases) {
  for (const label of aliases) {
    const re = new RegExp(
      `(?:^|\\n)\\s*(?:[-*]\\s+)?\\*\\*${label}:\\*\\*\\s*(.+)$`,
      'im'
    );
    const m = section.match(re);
    if (m) return m[1].trim();
  }
  return '';
}

function unwrapMarkdownLink(value) {
  if (!value) return '';
  const link = value.match(/\[([^\]]*)\]\(([^)]+)\)/);
  if (link) return (link[2] || link[1]).trim();
  return value.trim();
}

function extractWebsiteFromText(text) {
  if (!text) return '';
  const labeled = extractOfficialWebsiteFromMarkdown(text);
  if (labeled) return labeled;
  const m = text.match(
    /(?:Official\s+)?Website:\s*(\[([^\]]*)\]\(([^)]+)\)|https?:\/\/\S+)/i
  );
  if (!m) return '';
  if (m[3]) return m[3].trim();
  return unwrapMarkdownLink(m[1]).replace(/[.,;)\]]+$/, '');
}

function extractPhoneFromText(text) {
  if (!text) return '';
  const labeled = readField(text, FIELD_ALIASES.phone);
  if (labeled) return labeled;
  const m = text.match(
    /(?:\+?1[-.\s]*)?(?:\(?\d{3}\)?[-.\s]*)\d{3}[-.\s]*\d{4}/
  );
  return m ? m[0].trim() : '';
}

/**
 * Fallback when [II] is a single prose / semicolon line instead of labeled fields.
 * Example: "Legal Name; street, City, ST ZIP; (555) 555-5555; Website: https://…"
 *
 * @param {string} section body of [II] FIRMOGRAPHICS
 * @returns {{ name: string, address: string, phone: string, website: string } | null}
 */
export function parseProseFirmographicsSection(section) {
  const text = (section || '').replace(/\r\n/g, '\n').trim();
  if (!text) return null;

  const website = extractWebsiteFromText(text);
  const phone = extractPhoneFromText(text);

  // Strip website/phone labels before segment split so address matching stays clean
  let working = text
    .replace(/(?:Official\s+)?Website:\s*(?:\[[^\]]*\]\([^)]+\)|https?:\/\/\S+)/gi, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const segments = working
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  let address = '';
  let name = '';

  for (const seg of segments) {
    if (phone && seg.includes(phone)) continue;
    const parsed = parseUsAddress(seg);
    if (parsed?.city && parsed?.state) {
      address = parsed.raw_address;
      break;
    }
  }

  if (!address) {
    // Whole-line fallback: find "street, City, ST ZIP" substring
    const addrMatch = working.match(
      /([0-9][^;]*?,\s*[^,]+,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?)/i
    );
    if (addrMatch) {
      const parsed = parseUsAddress(addrMatch[1]);
      if (parsed?.city && parsed?.state) address = parsed.raw_address;
    }
  }

  if (!address) return null;

  // Name = first segment that is not the address / phone
  for (const seg of segments) {
    if (phone && seg.includes(phone)) continue;
    if (parseUsAddress(seg)?.city) continue;
    if (/^https?:\/\//i.test(seg)) continue;
    if (seg.length >= 2) {
      name = seg.replace(/^(?:Legal\s+)?Name:\s*/i, '').trim();
      break;
    }
  }

  return {
    name,
    address,
    phone: phone || '',
    website: website || '',
  };
}

/**
 * Build canonical labeled [II] body from parsed fields (facts unchanged).
 * @param {{ name?: string, address: string, phone?: string, website?: string }} fields
 */
export function formatLabeledFirmographicsBody(fields) {
  const lines = [
    `- **Name:** ${fields.name || ''}`.trimEnd(),
    `- **Address:** ${fields.address || ''}`.trimEnd(),
  ];
  if (fields.latitude != null && fields.latitude !== '') {
    lines.push(`- **Latitude:** ${fields.latitude}`.trimEnd());
  }
  if (fields.longitude != null && fields.longitude !== '') {
    lines.push(`- **Longitude:** ${fields.longitude}`.trimEnd());
  }
  if (fields.geocode_source) {
    lines.push(`- **Geocode source:** ${fields.geocode_source}`.trimEnd());
  }
  if (fields.geocoded_address) {
    lines.push(`- **Geocoded address:** ${fields.geocoded_address}`.trimEnd());
  }
  lines.push(
    `- **Phone:** ${fields.phone || ''}`.trimEnd(),
    `- **Website:** ${fields.website || ''}`.trimEnd()
  );
  if (fields.gbp_url) {
    lines.push(`- **GBP URL:** ${fields.gbp_url}`.trimEnd());
  }
  if (fields.gbp_cid) {
    lines.push(`- **GBP CID:** ${fields.gbp_cid}`.trimEnd());
  }
  return `\n${lines.join('\n')}\n`;
}

/**
 * True when [II] already has labeled Address (and ideally Website).
 * @param {string} section
 */
export function hasLabeledFirmographics(section) {
  return Boolean(readField(section, FIELD_ALIASES.address));
}

/**
 * Rewrite dossier markdown [II] to labeled **Field:** format (same facts).
 * @param {string} markdown
 * @param {{ name?: string, address: string, phone?: string, website?: string }} fields
 * @returns {string}
 */
export function replaceSectionIIWithLabeled(markdown, fields) {
  const text = normalizeDossierMarkdown(markdown);
  const body = formatLabeledFirmographicsBody(fields);
  const replaced = text.replace(
    /(\[II\]\s*FIRMOGRAPHICS)([\s\S]*?)(?=\[III\]|$)/i,
    `$1${body}`
  );
  if (replaced === text) {
    throw new Error('Could not locate [II] FIRMOGRAPHICS to normalize');
  }
  return replaced;
}

function gbpUrlAliasPattern() {
  return FIELD_ALIASES.gbp_url
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
}

function replaceExistingGbpUrlField(markdown, gbpUrl) {
  const re = new RegExp(
    `((?:^|\\n)\\s*(?:[-*]\\s+)?\\*\\*(?:${gbpUrlAliasPattern()}):\\*\\*\\s*).+$`,
    'im'
  );
  return markdown.replace(re, `$1${gbpUrl}`);
}

function insertGbpUrlField(markdown, gbpUrl) {
  const line = `- **GBP URL:** ${gbpUrl}`;
  return markdown.replace(
    /(\[II\]\s*FIRMOGRAPHICS)([\s\S]*?)(?=\[III\]|$)/i,
    (full, header, body) => {
      const websiteLine = body.match(
        /((?:^|\n)\s*(?:[-*]\s+)?\*\*(?:Official\s+)?Website:\*\*\s*.+)/i
      );
      if (websiteLine) {
        return header + body.replace(websiteLine[1], `${websiteLine[1]}\n${line}`);
      }
      const trimmed = body.replace(/^\r?\n/, '');
      return `${header}\n${line}\n${trimmed}`;
    }
  );
}

const MAPS_ROW_RE =
  /^(\|\s*(?:Google Maps(?:\s*\(GBP\))?|Google Business Profile|GBP)\s*\|)([^|\n]*)(\|[^\n]*)$/im;

function ensureGbpUrlInDigitalEcosystem(markdown, gbpUrl) {
  const match = markdown.match(
    /(\[V\]\s*DIGITAL ECOSYSTEM)([\s\S]*?)(?=\[VI\]|$)/i
  );
  if (!match) return { markdown, changed: false };
  const [, header, body] = match;
  const existingRow = body.match(MAPS_ROW_RE);
  if (existingRow) {
    const current = unwrapMarkdownLink(existingRow[2].trim());
    if (current === gbpUrl) {
      return { markdown, changed: false };
    }
    const status = existingRow[3].trim();
    const newRow = `| Google Maps (GBP) | ${gbpUrl} ${status.startsWith('|') ? status : `| ${status}`}`;
    const newBody = body.replace(MAPS_ROW_RE, newRow);
    return {
      markdown:
        markdown.slice(0, match.index) +
        header +
        newBody +
        markdown.slice(match.index + match[0].length),
      changed: true,
    };
  }

  const row = `| Google Maps (GBP) | ${gbpUrl} | Active |`;
  const websiteRow = body.match(/(\|\s*Website\s*\|[^\n]*)/i);
  let newBody;
  if (websiteRow) {
    newBody = body.replace(websiteRow[1], `${websiteRow[1]}\n${row}`);
  } else {
    const sep = body.match(/(\|[ \t:-]+\|[ \t:-]+\|[ \t:-]+\|)/);
    if (sep) newBody = body.replace(sep[1], `${sep[1]}\n${row}`);
    else newBody = `${body.replace(/\s*$/, '')}\n${row}\n`;
  }

  return {
    markdown:
      markdown.slice(0, match.index) +
      header +
      newBody +
      markdown.slice(match.index + match[0].length),
    changed: true,
  };
}

function replaceExistingGbpCidField(markdown, cid) {
  const re = new RegExp(
    `((?:^|\\n)\\s*(?:[-*]\\s+)?\\*\\*(?:GBP CID|Maps CID|data_cid|Company ID|CID):\\*\\*\\s*).+$`,
    'im'
  );
  return markdown.replace(re, `$1${cid}`);
}

function insertGbpCidField(markdown, cid) {
  const line = `- **GBP CID:** ${cid}`;
  return markdown.replace(
    /(\[II\]\s*FIRMOGRAPHICS)([\s\S]*?)(?=\[III\]|$)/i,
    (full, header, body) => {
      const gbpLine = body.match(
        /((?:^|\n)\s*(?:[-*]\s+)?\*\*(?:GBP URL|GB Map Share URL|Google Maps URL):[^\n]*)/i
      );
      if (gbpLine) {
        return header + body.replace(gbpLine[1], `${gbpLine[1]}\n${line}`);
      }
      const trimmed = body.replace(/^\r?\n/, '');
      return `${header}\n${line}\n${trimmed}`;
    }
  );
}

function ensureGbpCidInFirmographics(markdown, cid) {
  const n = String(cid || '').trim();
  if (!n) return { markdown, changed: false };
  const section = extractSectionII(markdown);
  const existing = unwrapMarkdownLink(readField(section, FIELD_ALIASES.gbp_cid));
  if (!existing) {
    return { markdown: insertGbpCidField(markdown, n), changed: true };
  }
  if (existing !== n) {
    const next = replaceExistingGbpCidField(markdown, n);
    return { markdown: next, changed: next !== markdown };
  }
  return { markdown, changed: false };
}

/**
 * Write canonical CID URL into [II] **GBP URL:** / **GBP CID:** and [V] Google Maps row.
 * Replaces maps.app / share.google values. CLI CID URL is source of truth.
 *
 * @param {string} markdown
 * @param {string} gbpUrl canonical https://www.google.com/maps?cid={CID}
 * @param {{ cid?: string | null }} [opts]
 * @returns {{ markdown: string, changed: boolean, gbp_url: string, gbp_cid: string }}
 */
function aliasPattern(aliases) {
  return aliases.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
}

function replaceExistingLabeledField(markdown, aliases, value) {
  const re = new RegExp(
    `((?:^|\\n)\\s*(?:[-*]\\s+)?\\*\\*(?:${aliasPattern(aliases)}):\\*\\*\\s*).+$`,
    'im'
  );
  return markdown.replace(re, `$1${value}`);
}

function insertLabeledFieldAfter(markdown, line, afterAliases) {
  return markdown.replace(
    /(\[II\]\s*FIRMOGRAPHICS)([\s\S]*?)(?=\[III\]|$)/i,
    (full, header, body) => {
      if (afterAliases?.length) {
        const afterLine = body.match(
          new RegExp(
            `((?:^|\\n)\\s*(?:[-*]\\s+)?\\*\\*(?:${aliasPattern(afterAliases)}):\\*\\*[^\\n]*)`,
            'i'
          )
        );
        if (afterLine) {
          return header + body.replace(afterLine[1], `${afterLine[1]}\n${line}`);
        }
      }
      const trimmed = body.replace(/^\r?\n/, '');
      return `${header}\n${line}\n${trimmed}`;
    }
  );
}

function upsertLabeledField(markdown, aliases, value, afterAliases) {
  const v = String(value ?? '').trim();
  if (!v) return { markdown, changed: false };
  const section = extractSectionII(markdown);
  const existing = unwrapMarkdownLink(readField(section, aliases));
  if (existing === v) return { markdown, changed: false };
  if (existing) {
    const next = replaceExistingLabeledField(markdown, aliases, v);
    return { markdown: next, changed: next !== markdown };
  }
  const line = `- **${aliases[0]}:** ${v}`;
  return { markdown: insertLabeledFieldAfter(markdown, line, afterAliases), changed: true };
}

/**
 * Write geocoded lat/long into [II] after **Address:**.
 * CLI / Nominatim / Maps URL / SerpAPI result is the source of truth.
 *
 * @param {string} markdown
 * @param {{ ok?: boolean, latitude?: unknown, longitude?: unknown, source?: string, display_name?: string }} geo
 * @returns {{ markdown: string, changed: boolean, latitude: string, longitude: string }}
 */
export function ensureCoordinatesInDossier(markdown, geo) {
  if (!geo?.ok) {
    return { markdown, changed: false, latitude: '', longitude: '' };
  }
  const latitude = String(geo.latitude ?? '').trim();
  const longitude = String(geo.longitude ?? '').trim();
  if (!latitude || !longitude) {
    return { markdown, changed: false, latitude: '', longitude: '' };
  }

  let next = normalizeDossierMarkdown(markdown);
  let changed = false;

  const lat = upsertLabeledField(next, FIELD_ALIASES.latitude, latitude, FIELD_ALIASES.address);
  next = lat.markdown;
  changed = changed || lat.changed;

  const lng = upsertLabeledField(next, FIELD_ALIASES.longitude, longitude, FIELD_ALIASES.latitude);
  next = lng.markdown;
  changed = changed || lng.changed;

  if (geo.source) {
    const src = upsertLabeledField(
      next,
      FIELD_ALIASES.geocode_source,
      geo.source,
      FIELD_ALIASES.longitude
    );
    next = src.markdown;
    changed = changed || src.changed;
  }

  if (geo.display_name) {
    const after = geo.source ? FIELD_ALIASES.geocode_source : FIELD_ALIASES.longitude;
    const disp = upsertLabeledField(
      next,
      FIELD_ALIASES.geocoded_address,
      geo.display_name,
      after
    );
    next = disp.markdown;
    changed = changed || disp.changed;
  }

  return { markdown: next, changed, latitude, longitude };
}

export function ensureGbpUrlInDossier(markdown, gbpUrl, { cid = null } = {}) {
  const url = String(gbpUrl || '').trim();
  if (!url) return { markdown, changed: false, gbp_url: '', gbp_cid: '' };

  let next = normalizeDossierMarkdown(markdown);
  let changed = false;
  const section = extractSectionII(next);
  const existing = unwrapMarkdownLink(readField(section, FIELD_ALIASES.gbp_url));

  if (!existing) {
    next = insertGbpUrlField(next, url);
    changed = true;
  } else if (existing !== url) {
    next = replaceExistingGbpUrlField(next, url);
    changed = next !== markdown;
  }

  const cidEnsured = ensureGbpCidInFirmographics(next, cid);
  next = cidEnsured.markdown;
  changed = changed || cidEnsured.changed;

  const eco = ensureGbpUrlInDigitalEcosystem(next, url);
  return {
    markdown: eco.markdown,
    changed: changed || eco.changed,
    gbp_url: url,
    gbp_cid: String(cid || '').trim(),
  };
}

/**
 * One-shot normalize: if [II] is not labeled, parse prose and rewrite to **Field:** format.
 *
 * @param {string} dossierPath
 * @param {{ write?: boolean }} [opts] write=false returns preview only (no disk change)
 * @returns {{ ok: boolean, normalized: boolean, dossier: string, fields: object, preview_body?: string }}
 */
export function normalizeDossierFirmographics(dossierPath, { write = true } = {}) {
  const resolved = path.resolve(dossierPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Dossier not found: ${resolved}`);
  }

  const markdown = fs.readFileSync(resolved, 'utf8');
  const section = extractSectionII(markdown);
  if (!section.trim()) {
    throw new Error(`[II] FIRMOGRAPHICS not found in dossier: ${resolved}`);
  }

  if (hasLabeledFirmographics(section)) {
    const labeled = parseGbpAnchorFromDossier(resolved);
    return {
      ok: true,
      normalized: false,
      dossier: resolved,
      fields: labeled,
    };
  }

  const prose = parseProseFirmographicsSection(section);
  if (!prose?.address) {
    throw new Error(
      `Could not normalize [II] FIRMOGRAPHICS in ${resolved}: no parseable address (labeled or prose)`
    );
  }

  const fields = {
    name: prose.name || path.basename(resolved, '.md').replace(/-?Dossier$/i, ''),
    address: prose.address,
    phone: prose.phone,
    website: prose.website,
  };

  const next = replaceSectionIIWithLabeled(markdown, fields);
  if (write) {
    fs.writeFileSync(resolved, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
    return {
      ok: true,
      normalized: true,
      dossier: resolved,
      fields: parseGbpAnchorFromDossier(resolved),
      preview_body: formatLabeledFirmographicsBody(fields).trim(),
    };
  }

  return {
    ok: true,
    normalized: true,
    dossier: resolved,
    fields: {
      ok: true,
      source: 'dossier-prose-preview',
      dossier: resolved,
      location_name: fields.name,
      address: fields.address,
      phone: fields.phone || null,
      website: fields.website || null,
    },
    preview_body: formatLabeledFirmographicsBody(fields).trim(),
  };
}

/** First address before `;` — location-specific dossier uses primary segment. */
export function primaryAddressSegment(addressLine) {
  if (!addressLine) return '';
  // Prefer US city/state segment when the line is a semicolon prose blob
  const segments = addressLine.split(';').map((s) => s.trim()).filter(Boolean);
  if (segments.length > 1) {
    for (const seg of segments) {
      if (
        /,\s*[^,]+,\s*[A-Z]{2}(?:\s+\d{5})?/i.test(seg) ||
        parseCityStateFromWorkbook(seg).city
      ) {
        return seg.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }
  }
  const first = segments[0] || '';
  return first.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} address e.g. "2701 Moore St, Philadelphia, PA 19145"
 */
export function parseUsAddress(address) {
  const cleaned = primaryAddressSegment(address);
  const m = cleaned.match(
    /^(.*?),\s*([^,]+),\s*([A-Z]{2})(?:\s+(\d{5}(?:-\d{4})?))?(?:\s*,\s*United States)?$/i
  );
  if (!m) {
    const cityZip = parseCityStateFromWorkbook(cleaned);
    if (cityZip.city && cityZip.state) {
      return {
        street: '',
        city: cityZip.city,
        state: cityZip.state,
        state_abbr: null,
        zip: '',
        city_st_zip: cleaned,
        raw_address: cleaned,
      };
    }
    return null;
  }

  const street = m[1].trim();
  const city = m[2].trim();
  const stateAbbr = m[3].toUpperCase();
  const zip = m[4] || '';
  const cityStZip = zip
    ? `${city}, ${stateAbbr} ${zip}`
    : `${city}, ${stateAbbr}`;

  return {
    street,
    city,
    state: normalizeState(stateAbbr),
    state_abbr: stateAbbr,
    zip,
    city_st_zip: cityStZip,
    raw_address: cleaned,
  };
}

export function findDossierFiles(projectDir) {
  const resolved = path.resolve(projectDir);
  if (!fs.existsSync(resolved)) return [];

  const goldenHits = listDossierMdInDir(path.join(resolved, GOLDEN_IMAGE_DOSSIER_REL));
  if (goldenHits.length) return goldenHits.sort();

  return listDossierMdInDir(resolved).sort();
}

/**
 * Default crawl deliverable directory for a campaign folder.
 * Golden Image: `01-intake/1.2-audit/`. Legacy: `audit/crawl-report/`.
 *
 * @param {string} projectDir campaign folder (--project-dir)
 * @param {{ create?: boolean }} [opts]
 */
export function resolveCrawlOutputDir(projectDir, { create = false } = {}) {
  const resolved = path.resolve(projectDir);
  const outputDir = isGoldenImageCampaign(resolved)
    ? path.join(resolved, GOLDEN_IMAGE_CRAWL_REL)
    : path.join(resolved, LEGACY_CRAWL_REL);
  if (create) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
}

/**
 * Resolve `field-learnings.md` for read (explicit output dir → golden → legacy).
 *
 * @param {string} projectDir
 * @param {{ outputDir?: string | null }} [opts]
 * @returns {string | null} absolute path if file exists, else null
 */
export function findFieldLearningsFile(projectDir, { outputDir = null } = {}) {
  const candidates = [];
  if (outputDir != null) {
    candidates.push(path.join(path.resolve(outputDir), 'field-learnings.md'));
  }
  const resolved = path.resolve(projectDir);
  candidates.push(path.join(resolved, GOLDEN_IMAGE_CRAWL_REL, 'field-learnings.md'));
  candidates.push(path.join(resolved, LEGACY_CRAWL_REL, 'field-learnings.md'));

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function extractOfficialWebsiteFromMarkdown(text) {
  const patterns = [
    /\*\*Official Website:\*\*\s*(.+)$/im,
    /\*\*Website:\*\*\s*(.+)$/im,
    /(?:^|\n|;)\s*(?:Official\s+)?Website:\s*(\[([^\]]*)\]\(([^)]+)\)|https?:\/\/\S+)/im,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    let val = (m[3] || m[1] || '').trim();
    const link = val.match(/\[([^\]]*)\]\(([^)]+)\)/);
    if (link) val = (link[2] || link[1]).trim();
    val = val.replace(/[.,;)\]]+$/, '');
    if (/^https?:\/\//i.test(val)) return val;
  }
  return null;
}

/**
 * Read Official Website from dossier (Golden Image `1.1-docs/` first, legacy root second).
 * Accepts labeled **Website:** / **Official Website:** or prose `Website: https://…`.
 *
 * @param {string} projectDir campaign folder
 * @returns {string | null}
 */
export function readDossierWebsite(projectDir) {
  const files = findDossierFiles(projectDir);
  for (const dossierPath of files) {
    const text = fs.readFileSync(dossierPath, 'utf8');
    const website = extractOfficialWebsiteFromMarkdown(text);
    if (website) return website;
    const section = extractSectionII(text);
    const prose = parseProseFirmographicsSection(section);
    if (prose?.website) return prose.website;
  }
  return null;
}

/**
 * Require dossier + Official Website before a new crawl when `--project-dir` is set.
 *
 * @param {string} projectDir
 * @returns {{ dossierPath: string, website: string }}
 */
export function assertDossierForCrawl(projectDir) {
  const resolved = path.resolve(projectDir);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Project dir not found: ${resolved}`);
  }

  const files = findDossierFiles(projectDir);
  if (!files.length) {
    throw new Error(
      `No *Dossier.md found for crawl under ${resolved}. ` +
        `Expected ${GOLDEN_IMAGE_DOSSIER_REL}/ or campaign root. ` +
        `Run business-dossier first, or omit --project-dir and pass --domain.`
    );
  }

  const website = readDossierWebsite(projectDir);
  if (!website) {
    throw new Error(
      `Dossier at ${files[0]} has no **Official Website:** URL. ` +
        `Fix the dossier or omit --project-dir and pass --domain.`
    );
  }

  return { dossierPath: files[0], website };
}

/**
 * @param {string} dossierPath absolute or relative path to *Dossier.md
 */
export function parseGbpAnchorFromDossier(dossierPath) {
  const resolved = path.resolve(dossierPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Dossier not found: ${resolved}`);
  }

  const markdown = fs.readFileSync(resolved, 'utf8');
  const section = extractSectionII(markdown);
  if (!section.trim()) {
    throw new Error(`[II] FIRMOGRAPHICS not found in dossier: ${resolved}`);
  }

  let name = readField(section, FIELD_ALIASES.name);
  let addressLine = readField(section, FIELD_ALIASES.address);
  let phone = readField(section, FIELD_ALIASES.phone);
  let website = unwrapMarkdownLink(readField(section, FIELD_ALIASES.website));
  let source = 'dossier';

  if (!addressLine) {
    const prose = parseProseFirmographicsSection(section);
    if (prose?.address) {
      name = name || prose.name;
      addressLine = prose.address;
      phone = phone || prose.phone;
      website = website || prose.website;
      source = 'dossier-prose';
    }
  }

  if (!website) {
    website = extractOfficialWebsiteFromMarkdown(section) || '';
  }

  const parsed = parseUsAddress(addressLine);
  if (!parsed?.city || !parsed?.state) {
    throw new Error(
      `Could not parse city/state from dossier address: ${addressLine || '(empty)'}. ` +
        `Expected labeled **Address:** street, City, ST ZIP (or a semicolon prose [II] line). ` +
        `Offer normalizeDossierFirmographics() to rewrite [II] in place.`
    );
  }

  return {
    ok: true,
    source,
    dossier: resolved,
    location_name: name || path.basename(resolved, '.md'),
    address: parsed.raw_address,
    street: parsed.street,
    city_st_zip: parsed.city_st_zip,
    gbp_city: parsed.city,
    state: parsed.state,
    state_abbr: parsed.state_abbr,
    zip: parsed.zip,
    phone: phone || null,
    website: website || null,
    gbp_url: unwrapMarkdownLink(readField(section, FIELD_ALIASES.gbp_url)) || null,
    gbp_cid: unwrapMarkdownLink(readField(section, FIELD_ALIASES.gbp_cid)) || null,
    latitude: readField(section, FIELD_ALIASES.latitude) || null,
    longitude: readField(section, FIELD_ALIASES.longitude) || null,
    geocode_source: readField(section, FIELD_ALIASES.geocode_source) || null,
    geocoded_address: readField(section, FIELD_ALIASES.geocoded_address) || null,
  };
}

/**
 * Validate that [II] has labeled fields parseable as GBP anchor.
 * @param {string} markdownOrPath dossier markdown text OR path to *.md
 * @returns {{ ok: boolean, missing: string[], labeled: boolean, parseable: boolean, error?: string }}
 */
export function validateFirmographicsSection(markdownOrPath) {
  let markdown = markdownOrPath;
  if (
    typeof markdownOrPath === 'string' &&
    (markdownOrPath.endsWith('.md') || fs.existsSync(markdownOrPath))
  ) {
    const resolved = path.resolve(markdownOrPath);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      markdown = fs.readFileSync(resolved, 'utf8');
    }
  }

  const section = extractSectionII(markdown);
  const missing = [];
  if (!section.trim()) {
    return {
      ok: false,
      missing: ['[II] FIRMOGRAPHICS'],
      labeled: false,
      parseable: false,
      error: 'section missing',
    };
  }

  const labeled = hasLabeledFirmographics(section);
  for (const key of REQUIRED_FIRMOGRAPHIC_KEYS) {
    const aliases = FIELD_ALIASES[key];
    if (!readField(section, aliases)) missing.push(`**${aliases[0]}:**`);
  }
  const gbpUrl = unwrapMarkdownLink(readField(section, FIELD_ALIASES.gbp_url));
  const gbpCid = unwrapMarkdownLink(readField(section, FIELD_ALIASES.gbp_cid));
  const gbpIsRedirect =
    /maps\.app\.goo\.gl|share\.google|goo\.gl\/maps/i.test(gbpUrl || '');
  if (gbpIsRedirect) {
    missing.push('**GBP URL:** (CID URL, not maps.app/share.google)');
  }

  try {
    // Use temp parse via prose-aware logic without requiring a file path
    const name = readField(section, FIELD_ALIASES.name);
    let addressLine = readField(section, FIELD_ALIASES.address);
    if (!addressLine) {
      addressLine = parseProseFirmographicsSection(section)?.address || '';
    }
    const parsed = parseUsAddress(addressLine);
    const parseable = Boolean(parsed?.city && parsed?.state);
    const latitude = readField(section, FIELD_ALIASES.latitude);
    const longitude = readField(section, FIELD_ALIASES.longitude);
    return {
      ok: labeled && parseable && missing.length === 0,
      missing,
      labeled,
      parseable,
      location_name: name || null,
      gbp_city: parsed?.city || null,
      state: parsed?.state || null,
      gbp_url: gbpUrl || null,
      gbp_cid: gbpCid || null,
      latitude: latitude || null,
      longitude: longitude || null,
    };
  } catch (err) {
    return {
      ok: false,
      missing,
      labeled,
      parseable: false,
      error: err.message,
    };
  }
}
