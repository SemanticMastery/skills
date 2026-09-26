/**
 * Pre-gather research bundle for business dossier (SerpAPI + Firecrawl).
 * Runs before Grok synthesis. Writes scratch artifacts under workDir (temp).
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.resolve(__dirname, '..');
const GBP_SCRIPT = path.join(SCRIPTS_DIR, 'get-gbp-categories.mjs');
const SERPAPI = 'https://serpapi.com/search.json';

function readTextFileSafe(filePath, maxChars = 12000) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (raw.length <= maxChars) return raw;
    return `${raw.slice(0, maxChars)}\n\n[truncated ${raw.length - maxChars} chars]`;
  } catch {
    return null;
  }
}

function readJsonFileSafe(filePath, maxChars = 12000) {
  const text = readTextFileSafe(filePath, maxChars);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function cityFromAddress(address) {
  if (!address) return '';
  const parts = address.split(',').map((p) => p.trim());
  if (parts.length >= 2) return parts[parts.length - 2];
  return parts[0] || '';
}

function firecrawlAvailable() {
  try {
    const r = spawnSync('firecrawl', ['--status'], { encoding: 'utf8', timeout: 15000 });
    return r.status === 0;
  } catch {
    return false;
  }
}

function runFirecrawl(args, cwd, log) {
  try {
    execFileSync('firecrawl', args, {
      cwd,
      encoding: 'utf8',
      timeout: 180000,
      stdio: 'pipe',
    });
    log.push(`firecrawl ok: ${args.slice(0, 4).join(' ')}`);
    return true;
  } catch (err) {
    log.push(`firecrawl failed (${args[0]}): ${err.message}`);
    return false;
  }
}

function fetchGbpCategories(gbpUrl, log) {
  if (!process.env.SERPAPI_API_KEY) {
    log.push('SERPAPI_API_KEY not set — skipping SerpAPI pre-gather.');
    return null;
  }
  try {
    const raw = execFileSync(process.execPath, [GBP_SCRIPT, '--gbp-url', gbpUrl], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    const parsed = JSON.parse(raw);
    log.push('SerpAPI get-gbp-categories.mjs succeeded.');
    return parsed;
  } catch (err) {
    log.push(`SerpAPI get-gbp-categories.mjs failed: ${err.message}`);
    return null;
  }
}

async function fetchSerpPlaceDetails(placeId, log) {
  if (!process.env.SERPAPI_API_KEY || !placeId) return null;
  try {
    const url = `${SERPAPI}?engine=google_maps&place_id=${encodeURIComponent(placeId)}&api_key=${encodeURIComponent(process.env.SERPAPI_API_KEY)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const place = json.place_results;
    if (!place) throw new Error('No place_results');
    log.push('SerpAPI google_maps place_id detail fetch succeeded.');
    return place;
  } catch (err) {
    log.push(`SerpAPI place detail fetch failed: ${err.message}`);
    return null;
  }
}

function formatHours(place) {
  if (place?.hours?.length) {
    const today = place.hours.find((h) => h.current_day) || place.hours[0];
    if (today?.hours) return today.hours;
  }
  if (place?.open_state) return place.open_state;
  if (place?.operating_hours?.hours?.length) {
    return place.operating_hours.hours.join('; ');
  }
  return null;
}

function formatCategory(place, categories) {
  const primary = categories?.primary || place?.type?.[0] || place?.type;
  if (!primary) return null;
  if (String(primary).startsWith('📍')) return primary;
  return primary;
}

function formatStarRating(place) {
  if (place?.rating == null) return null;
  const reviews = place.reviews != null ? place.reviews : '?';
  return `Star rating: ${place.rating} out of 5 stars ${place.rating} (${reviews} reviews)`;
}

export function buildDocxHeader({ name, place, gbpData }) {
  const biz = gbpData?.result?.business || {};
  const cats = gbpData?.result?.categories || {};
  const categoryRaw = formatCategory(place, cats);
  return {
    businessName: place?.title || biz.title || name,
    starRating: formatStarRating(place),
    category: categoryRaw
      ? categoryRaw.startsWith('📍')
        ? categoryRaw
        : `📍 ${categoryRaw}`
      : null,
    hours: formatHours(place),
  };
}

function summarizeSerpBundle(gbpData, placeDetails) {
  const lines = ['## SerpAPI pre-gather (verify independently)'];
  const biz = gbpData?.result?.business || {};
  const cats = gbpData?.result?.categories || {};

  if (biz.title) lines.push(`- GBP title: ${biz.title}`);
  if (biz.address) lines.push(`- GBP address: ${biz.address}`);
  if (biz.phone) lines.push(`- GBP phone: ${biz.phone}`);
  if (biz.website) lines.push(`- GBP website: ${biz.website}`);
  if (biz.place_id) lines.push(`- Place ID: ${biz.place_id}`);
  const gps = placeDetails?.gps_coordinates;
  if (gps?.latitude != null && gps?.longitude != null) {
    lines.push(`- GBP GPS: ${gps.latitude}, ${gps.longitude}`);
  }
  if (cats.primary) lines.push(`- Primary category: ${cats.primary}`);
  if (cats.additional?.length) lines.push(`- Additional categories: ${cats.additional.join('; ')}`);

  if (placeDetails) {
    if (placeDetails.rating != null) {
      lines.push(`- Rating: ${placeDetails.rating} (${placeDetails.reviews ?? '?'} reviews)`);
    }
    const hours = formatHours(placeDetails);
    if (hours) lines.push(`- Hours / open state: ${hours}`);
    if (placeDetails.description) lines.push(`- GBP description: ${placeDetails.description}`);
    if (Array.isArray(placeDetails.user_reviews)) {
      lines.push('- Sample GBP reviews:');
      for (const r of placeDetails.user_reviews.slice(0, 5)) {
        lines.push(`  - ${r.rating ?? '?'}★ ${(r.snippet || r.text || '').slice(0, 200)}`);
      }
    }
  }

  return lines.join('\n');
}

function summarizeFirecrawlBundle(files, log) {
  const lines = ['## Firecrawl pre-gather (verify independently)'];
  for (const [label, filePath] of Object.entries(files)) {
    if (!filePath || !fs.existsSync(filePath)) {
      log.push(`Firecrawl artifact missing: ${label}`);
      continue;
    }
    const ext = path.extname(filePath).toLowerCase();
    let excerpt = null;
    if (ext === '.json') {
      const data = readJsonFileSafe(filePath, 8000);
      excerpt = typeof data === 'string' ? data : JSON.stringify(data, null, 2).slice(0, 8000);
    } else {
      excerpt = readTextFileSafe(filePath, 8000);
    }
    if (excerpt) {
      lines.push('', `### ${label}`, '```', excerpt, '```');
    }
  }
  return lines.join('\n');
}

/**
 * @param {object} params
 * @param {string} params.name
 * @param {string} params.address
 * @param {string} params.phone
 * @param {string} params.website
 * @param {string} params.gbpUrl
 * @param {string} [params.workDir] Temp scratch dir; defaults to os.tmpdir()/business-dossier-{slug}
 * @param {string} params.slug
 * @param {string[]} params.log
 * @param {boolean} [params.skipFirecrawl]
 */
export async function pregatherDossier({
  name,
  address,
  phone,
  website,
  gbpUrl,
  workDir,
  slug,
  log,
  skipFirecrawl = false,
}) {
  const gatherDir = workDir || path.join(os.tmpdir(), `business-dossier-${slug}`);
  fs.mkdirSync(gatherDir, { recursive: true });

  const gbpData = fetchGbpCategories(gbpUrl, log);
  const placeId =
    gbpData?.result?.business?.place_id || gbpData?.resolved?.place_id || null;
  const placeDetails = await fetchSerpPlaceDetails(placeId, log);

  const firecrawlFiles = {};
  if (!skipFirecrawl) {
    if (!firecrawlAvailable()) {
      log.push('Firecrawl CLI not available/authenticated — skipping Firecrawl pre-gather.');
    } else {
      const city = cityFromAddress(address);
      const websiteOut = path.join(gatherDir, 'website.md');
      const reviewsOut = path.join(gatherDir, 'search-reviews.json');
      const ownerOut = path.join(gatherDir, 'search-owner.json');
      const bbbOut = path.join(gatherDir, 'search-bbb.json');
      const sosOut = path.join(gatherDir, 'search-registry.json');

      if (website) {
        runFirecrawl(['scrape', website, '-o', websiteOut], gatherDir, log);
        firecrawlFiles.website = websiteOut;
      }

      const reviewQuery = `"${name}" ${city} reviews yelp google`.trim();
      runFirecrawl(
        ['search', reviewQuery, '--scrape', '--limit', '8', '-o', reviewsOut, '--json'],
        gatherDir,
        log
      );
      firecrawlFiles.reviews_search = reviewsOut;

      runFirecrawl(
        ['search', `"${name}" owner principal linkedin ${city}`.trim(), '--limit', '6', '-o', ownerOut, '--json'],
        gatherDir,
        log
      );
      firecrawlFiles.owner_search = ownerOut;

      runFirecrawl(
        ['search', `site:bbb.org "${name}" ${city}`.trim(), '--limit', '5', '-o', bbbOut, '--json'],
        gatherDir,
        log
      );
      firecrawlFiles.bbb_search = bbbOut;

      runFirecrawl(
        ['search', `"${name}" LLC incorporation secretary of state ${city}`.trim(), '--limit', '5', '-o', sosOut, '--json'],
        gatherDir,
        log
      );
      firecrawlFiles.registry_search = sosOut;
    }
  }

  const docxHeader = buildDocxHeader({
    name,
    place: placeDetails,
    gbpData,
  });

  const serpSummary = summarizeSerpBundle(gbpData, placeDetails);
  const firecrawlSummary = Object.keys(firecrawlFiles).length
    ? summarizeFirecrawlBundle(firecrawlFiles, log)
    : '';

  const bundle = {
    gather_dir: gatherDir,
    docx_header: docxHeader,
    gbp_data: gbpData,
    place_details: placeDetails
      ? {
          title: placeDetails.title,
          rating: placeDetails.rating,
          reviews: placeDetails.reviews,
          type: placeDetails.type,
          hours: formatHours(placeDetails),
          open_state: placeDetails.open_state,
          place_id: placeDetails.place_id,
          gps_coordinates: placeDetails.gps_coordinates || null,
        }
      : null,
    firecrawl_files: firecrawlFiles,
    serp_summary: serpSummary,
    firecrawl_summary: firecrawlSummary,
  };

  return bundle;
}

export function buildPregatherUserAppendix(bundle) {
  const parts = [
    '',
    '# Pre-gathered research bundle (SerpAPI + Firecrawl)',
    '',
    'Use these seeds for TSCR triangulation. Verify every node independently. Do not treat seeds as authoritative without cross-reference.',
    '',
    bundle.serp_summary,
  ];
  if (bundle.firecrawl_summary) {
    parts.push('', bundle.firecrawl_summary);
  }
  parts.push(
    '',
    '## Output formatting (DOCX-compatible)',
    '- Section headers: `[I] EXECUTIVE SUMMARY` through `[VII] BUSINESS DESCRIPTION` with NO trailing colon on the header line.',
    '- [II] FIRMOGRAPHICS: markdown list (`- **Name:**`, `- **Address:**`, `- **Latitude:**`, `- **Longitude:**`, `- **Phone:**`, `- **Website:**`, `- **GBP URL:**`, `- **GBP CID:**`, plus Geocode source / Geocoded address / Founding Date / Operating Hours when known). Always include `- **GBP URL:**` as `https://www.google.com/maps?cid={CID}` (never maps.app.goo.gl or share.google) and `- **GBP CID:**` with the raw Company ID. Use the provided Latitude / Longitude — do not invent coordinates.',
    '- [III] SCOPE OF OPERATIONS: markdown list (`- **Core Services:**`, `- **Specialized Care:**` if applicable, `- **Service Territory:**`).',
    '- [IV] LEADERSHIP & CREDENTIALS: markdown list (`- **Principal:**`, `- **Professional Bio:**`, `- **Verified Credentials:**` with nested `-` items).',
    '- [V] DIGITAL ECOSYSTEM: include a markdown table with columns `Platform | Handle/Link | Status` (3 columns). Include a `Google Maps (GBP)` row using the canonical CID URL `https://www.google.com/maps?cid={CID}` — never a maps.app or share.google redirect.',
    '- [VI] PUBLIC SENTIMENT ANALYSIS: markdown list (`- **Sentiment Score:** X / 5.0`, `- **Product Quality:**`, `- **Customer Service:**`, `- **Professional Reliability:**`, `- **Key Complaints:**`).',
    '- Blank line after every [I]–[VII] header. Do not stack `**Label:**` lines without `- ` — CommonMark joins them.',
    '- Do NOT include Maps UI paste artifacts, process chatter ("Gathering…"), chatbot closers, or "Would you like me to..." questions.',
    '- First line MUST be `[I] EXECUTIVE SUMMARY`. Return ONLY the seven-section dossier.'
  );
  return parts.join('\n');
}
