#!/usr/bin/env node
/**
 * Fetch Google Business Profile categories for a subject business.
 *
 * Priority:
 *   1. SerpAPI google_maps (place_id, then data_cid, then name/coords search)
 *   2. DataForSEO my_business_info/live (name + location)
 *
 * Accepts GBP URLs in common formats:
 *   - https://www.google.com/maps?cid=9017651635464888641
 *   - https://maps.app.goo.gl/...
 *   - https://share.google/...
 *   - Full /maps/place/... URLs (hex pair, place_id, or business name)
 *
 * Env:
 *   SERPAPI_API_KEY (required for primary path)
 *   DATAFORSEO_USERNAME / DATAFORSEO_PASSWORD (fallback)
 */

import {
  followRedirects,
  extractIdentifiersFromUrl,
} from './lib/resolve-maps-cid.mjs';

const SERPAPI = 'https://serpapi.com';
const DFS_MBI = 'https://api.dataforseo.com/v3/business_data/google/my_business_info/live';

function parseArgs(argv) {
  const out = {
    gbpUrl: null,
    placeId: null,
    cid: null,
    name: null,
    locationName: null,
    locationCoordinate: null,
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--gbp-url' && argv[i + 1]) out.gbpUrl = argv[++i];
    else if (a === '--place-id' && argv[i + 1]) out.placeId = argv[++i];
    else if (a === '--cid' && argv[i + 1]) out.cid = argv[++i];
    else if (a === '--name' && argv[i + 1]) out.name = argv[++i];
    else if (a === '--location-name' && argv[i + 1]) out.locationName = argv[++i];
    else if (a === '--location-coordinate' && argv[i + 1]) out.locationCoordinate = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (!a.startsWith('-') && !out.gbpUrl && !out.placeId && !out.cid) out.gbpUrl = a;
  }
  return out;
}

function usage() {
  return `Usage:
  node get-gbp-categories.mjs --gbp-url "https://maps.app.goo.gl/..."
  node get-gbp-categories.mjs --place-id ChIJ...
  node get-gbp-categories.mjs --cid 9017651635464888641
  node get-gbp-categories.mjs --name "Patrick A. Finn, LTD." --location-coordinate "42.12,-88.07,500"

Options:
  --gbp-url URL              Any Google Maps / share / goo.gl GBP link
  --place-id ID              Google Place ID (ChIJ...)
  --cid NUM                  Numeric Maps CID (data_cid)
  --name TEXT                Business name (fallback / disambiguation)
  --location-name TEXT       DataForSEO location_name fallback
  --location-coordinate TXT  lat,lng,radius_m for DataForSEO / SerpAPI bias
  --dry-run                  Resolve identifiers only; no paid API calls
  --help

Supported URL formats:
  - google.com/maps?cid=...
  - maps.app.goo.gl/... (follows redirects)
  - share.google/... (follows redirects; uses q= / kgmid when needed)
  - google.com/maps/place/... (place_id, hex pair, or business name)

Output: JSON to stdout`;
}

function serpApiKey() {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) throw new Error('Missing SERPAPI_API_KEY in environment');
  return key;
}

function dfsAuthHeader() {
  const u = process.env.DATAFORSEO_USERNAME;
  const p = process.env.DATAFORSEO_PASSWORD;
  if (!u || !p) throw new Error('Missing DATAFORSEO_USERNAME or DATAFORSEO_PASSWORD');
  return `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`;
}

async function resolveInput(args) {
  const resolved = {
    input: args.gbpUrl || args.placeId || args.cid || args.name,
    inputUrl: args.gbpUrl || null,
    finalUrl: null,
    redirectChain: [],
    placeId: args.placeId || null,
    cid: args.cid || null,
    name: args.name || null,
    kgmid: null,
    locationCoordinate: args.locationCoordinate || null,
    locationName: args.locationName || null,
    parseNotes: [],
  };

  if (args.gbpUrl) {
    const { finalUrl, chain } = await followRedirects(args.gbpUrl);
    resolved.finalUrl = finalUrl;
    resolved.redirectChain = chain;
    const extracted = extractIdentifiersFromUrl(finalUrl);
    resolved.placeId = resolved.placeId || extracted.placeId;
    resolved.cid = resolved.cid || extracted.cid;
    resolved.name = resolved.name || extracted.name;
    resolved.kgmid = extracted.kgmid;
    resolved.locationCoordinate = resolved.locationCoordinate || extracted.locationCoordinate;
    resolved.parseNotes.push(...extracted.parseNotes);
  }

  if (!resolved.placeId && !resolved.cid && !resolved.name) {
    throw new Error(
      'Could not resolve place_id, cid, or business name from input. Pass --name or a fuller GBP URL.',
    );
  }

  return resolved;
}

async function serpFetch(params) {
  const url = new URL(`${SERPAPI}/search.json`);
  url.searchParams.set('api_key', serpApiKey());
  url.searchParams.set('engine', 'google_maps');
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url);
  if (res.status === 429) throw new Error('SerpAPI rate limit (429)');
  if (!res.ok) throw new Error(`SerpAPI HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`SerpAPI: ${json.error}`);
  return json;
}

function normalizeCategoriesFromSerp(place) {
  const labels = Array.isArray(place.type) ? place.type : place.type ? [place.type] : [];
  const ids = Array.isArray(place.type_ids) ? place.type_ids : place.type_ids ? [place.type_ids] : [];
  return {
    primary: labels[0] || null,
    additional: labels.slice(1),
    all: labels,
    ids,
  };
}

function normalizeCategoriesFromDfs(item) {
  const additional = item.additional_categories || [];
  return {
    primary: item.category || null,
    additional,
    all: [item.category, ...additional].filter(Boolean),
    ids: item.category_ids || [],
  };
}

async function fetchViaSerpApi(resolved) {
  const attempts = [];

  if (resolved.placeId) {
    attempts.push({ label: 'place_id', params: { place_id: resolved.placeId } });
  }
  if (resolved.cid) {
    attempts.push({ label: 'data_cid', params: { data_cid: resolved.cid } });
  }
  if (resolved.name) {
    const params = { q: resolved.name };
    if (resolved.locationCoordinate) {
      const [lat, lng] = resolved.locationCoordinate.split(',').map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        params.ll = `@${lat},${lng},14z`;
      }
    }
    attempts.push({ label: 'name_search', params });
  }

  for (const attempt of attempts) {
    try {
      const json = await serpFetch(attempt.params);
      const place = json.place_results;
      if (!place?.title) continue;
      return {
        source: 'serpapi',
        method: attempt.label,
        business: {
          title: place.title,
          place_id: place.place_id || resolved.placeId || null,
          data_cid: place.data_cid || resolved.cid || null,
          address: place.address || null,
          website: place.website || null,
          phone: place.phone || null,
        },
        categories: normalizeCategoriesFromSerp(place),
        raw: {
          search_metadata: json.search_metadata,
          search_parameters: json.search_parameters,
        },
      };
    } catch (err) {
      if (attempt === attempts[attempts.length - 1]) throw err;
    }
  }

  throw new Error('SerpAPI could not resolve a place from available identifiers');
}

async function fetchViaDataForSeo(resolved) {
  const keyword = resolved.name;
  if (!keyword) {
    throw new Error('DataForSEO fallback requires a business name');
  }

  const task = {
    keyword,
    language_code: 'en',
  };
  if (resolved.locationCoordinate) {
    task.location_coordinate = resolved.locationCoordinate;
  } else if (resolved.locationName) {
    task.location_name = resolved.locationName;
  } else {
    throw new Error(
      'DataForSEO fallback needs --location-coordinate or --location-name when name-only lookup is ambiguous',
    );
  }

  const res = await fetch(DFS_MBI, {
    method: 'POST',
    headers: {
      Authorization: dfsAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([task]),
  });
  if (!res.ok) throw new Error(`DataForSEO HTTP ${res.status}`);
  const json = await res.json();
  const taskResult = json.tasks?.[0];
  if (!taskResult || taskResult.status_code !== 20000) {
    throw new Error(
      `DataForSEO: ${taskResult?.status_message || 'request failed'} (${taskResult?.status_code ?? 'unknown'})`,
    );
  }
  const item = taskResult.result?.[0]?.items?.[0];
  if (!item) throw new Error('DataForSEO returned no business match');

  return {
    source: 'dataforseo',
    method: 'my_business_info/live',
    business: {
      title: item.title,
      place_id: item.place_id || resolved.placeId || null,
      data_cid: item.cid || resolved.cid || null,
      address: item.address || null,
      website: item.url || null,
      phone: item.phone || null,
    },
    categories: normalizeCategoriesFromDfs(item),
    raw: {
      cost: json.cost ?? null,
      status_code: taskResult.status_code,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  if (!args.gbpUrl && !args.placeId && !args.cid && !args.name) {
    console.error(usage());
    process.exit(1);
  }

  const resolved = await resolveInput(args);
  const output = {
    resolved: {
      input: resolved.input,
      input_url: resolved.inputUrl,
      final_url: resolved.finalUrl,
      redirect_chain: resolved.redirectChain,
      place_id: resolved.placeId,
      data_cid: resolved.cid,
      name: resolved.name,
      kgmid: resolved.kgmid,
      location_coordinate: resolved.locationCoordinate,
      location_name: resolved.locationName,
      parse_notes: resolved.parseNotes,
    },
  };

  if (args.dryRun) {
    output.dry_run = true;
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  try {
    output.result = await fetchViaSerpApi(resolved);
  } catch (serpErr) {
    output.serpapi_error = serpErr.message;
    try {
      output.result = await fetchViaDataForSeo(resolved);
    } catch (dfsErr) {
      output.dataforseo_error = dfsErr.message;
      console.error(JSON.stringify({ ...output, error: 'All lookup methods failed' }, null, 2));
      process.exit(1);
    }
  }

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }, null, 2));
  process.exit(1);
});
