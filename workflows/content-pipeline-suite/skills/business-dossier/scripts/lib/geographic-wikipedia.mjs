/**
 * US geographic entity resolution via English Wikipedia (city → county → metro).
 * Optimized: batch extracts (50 titles/request), deduped county fetches, disk cache.
 */

import fs from 'fs';
import path from 'path';
import { wikiUrl } from './entity-notation.mjs';

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = 'SemanticLinks-GeographicLocations/2.0 (batch; contact: semanticlinks)';
const BATCH_SIZE = 50;
const CACHE_VERSION = 2;

export const WIKI_GEO_CACHE_FILENAME = 'wikipedia-geography-cache.json';

const STATE_ABBR = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  DC: 'District of Columbia',
};

let pauseMs = 200;

export function normalizeState(input) {
  if (!input) return null;
  const trimmed = input.trim();
  if (STATE_ABBR[trimmed.toUpperCase()]) return STATE_ABBR[trimmed.toUpperCase()];
  return trimmed;
}

/** @param {string} cityStZip e.g. "Roseville, CA 95747, United States" */
export function parseCityStateFromWorkbook(cityStZip) {
  const m = cityStZip.match(/^([^,]+),\s*([A-Z]{2})\b/i);
  if (!m) return { city: null, state: null };
  return {
    city: m[1].trim(),
    state: normalizeState(m[2]),
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function adaptivePause() {
  if (pauseMs > 0) await sleep(pauseMs);
}

function onRateLimit() {
  pauseMs = Math.min(Math.max(pauseMs * 2, 500), 4000);
}

function onSuccessBatch() {
  pauseMs = Math.max(150, pauseMs - 25);
}

async function wikiGet(params, attempt = 0) {
  const url = `${WIKI_API}?${new URLSearchParams({
    format: 'json',
    origin: '*',
    ...params,
  })}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (res.status === 429 && attempt < 6) {
    onRateLimit();
    await sleep(1500 * (attempt + 1));
    return wikiGet(params, attempt + 1);
  }
  if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
  onSuccessBatch();
  return res.json();
}

function pageToIntro(page) {
  if (!page || page.missing !== undefined) return null;
  return {
    title: page.title,
    extract: page.extract || '',
    pageid: page.pageid,
  };
}

/**
 * Fetch intro extracts for up to 50 titles per HTTP request.
 * @param {string[]} titles
 * @returns {Promise<Map<string, { title: string, extract: string, pageid: number }>>}
 */
export async function fetchIntroBatch(titles) {
  const unique = [...new Set(titles.filter(Boolean))];
  const byCanonical = new Map();

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const chunk = unique.slice(i, i + BATCH_SIZE);
    const data = await wikiGet({
      action: 'query',
      prop: 'extracts',
      exintro: '1',
      explaintext: '1',
      redirects: '1',
      titles: chunk.join('|'),
    });
    for (const page of Object.values(data?.query?.pages || {})) {
      const intro = pageToIntro(page);
      if (intro) byCanonical.set(intro.title.toLowerCase(), intro);
    }
    if (i + BATCH_SIZE < unique.length) await adaptivePause();
  }

  return byCanonical;
}

/** @deprecated Prefer fetchIntroBatch — single-title wrapper */
export async function fetchIntro(title) {
  const map = await fetchIntroBatch([title]);
  const wanted = title.toLowerCase();
  if (map.has(wanted)) return map.get(wanted);
  for (const intro of map.values()) {
    if (intro.title.toLowerCase() === wanted) return intro;
  }
  return map.values().next().value || null;
}

function normalizeCountyName(raw, state) {
  let county = raw.trim().replace(/\s+/g, ' ');
  if (!/^[\w .'-]+ County$/i.test(county)) return null;
  if (state && !county.includes(',')) {
    county = `${county}, ${state}`;
  }
  if (county.includes('.')) return null;
  if (!/^[A-Z][a-zA-Z .'-]+ County, [A-Za-z ]+$/.test(county)) return null;
  return county;
}

function normalizeMetroName(raw) {
  let metro = raw.trim().replace(/\s+/g, ' ');
  metro = metro.replace(/^(The|A|An)\s+/i, '');
  metro = metro.replace(
    /\s+Metropolitan Statistical Area$/i,
    ' metropolitan area'
  );
  // Reject sentence fragments (periods) and overlong extract bleed.
  if (metro.includes('.') || metro.length > 80) return null;
  // Proper-noun phrase + metro suffix only (each word Capitalized before suffix).
  if (
    !/^[A-Z][A-Za-z0-9'’-]+(?: [A-Z][A-Za-z0-9'’-]+){0,5}(?: metropolitan area| metro area)(?:, [A-Za-z .'-]+)?$/.test(
      metro
    )
  ) {
    return null;
  }
  return metro;
}

function pickBestCountyMatch(extract, state) {
  const stateName = state || 'California';
  const countyCapture = '([A-Z][a-z]+(?:\\s+[A-Z][a-z]+){0,3}\\s+County)';
  const patterns = [
    new RegExp(`${countyCapture}, ${stateName}\\b`, 'gi'),
    new RegExp(`\\bin\\s+(?:[a-z]+\\s+)*${countyCapture},`, 'gi'),
    new RegExp(`\\bin ${countyCapture},`, 'gi'),
    new RegExp(`\\bof ${countyCapture}, ${stateName}`, 'gi'),
    new RegExp(`\\bcounty seat of ${countyCapture}\\b`, 'gi'),
    new RegExp(`\\blocated in ${countyCapture},`, 'gi'),
    new RegExp(`${countyCapture}\\s+line\\b`, 'gi'),
  ];

  let best = null;
  for (const re of patterns) {
    for (const m of extract.matchAll(re)) {
      const county = normalizeCountyName(m[1], state);
      if (!county) continue;
      if (!best || county.length > best.length) best = county;
    }
  }
  return best;
}

export function parseCountyFromExtract(extract, state) {
  return pickBestCountyMatch(extract, state);
}

export function parseMetroFromExtract(extract) {
  // Do not allow '.' in the capture — otherwise "in the Midwest. The Milwaukee
  // metropolitan area …" bleeds prose into the metro title.
  const patterns = [
    /\bwithin the ([A-Z][A-Za-z0-9 '’-]*(?:metropolitan area|metro area))\b/i,
    /\bpart of the ([A-Z][A-Za-z0-9 '’-]*(?:metropolitan area|metro area))\b/i,
    /\blocated within the ([A-Z][A-Za-z0-9 '’-]*(?:metropolitan area|metro area))\b/i,
    /\bin the ([A-Z][A-Za-z0-9 '’-]*(?:metropolitan area|metro area))\b/i,
    /\bprincipal city of the ([A-Z][A-Za-z0-9 '’,–-]*(?:metropolitan area|metro area))\b/i,
    /\b([A-Z][A-Za-z0-9 '’-]+ metropolitan area)\b/,
    /\b([A-Z][A-Za-z0-9 '’-]+ metro area)\b/,
  ];
  for (const re of patterns) {
    const m = extract.match(re);
    if (!m) continue;
    const metro = normalizeMetroName(m[1]);
    if (metro) return metro;
  }
  return null;
}

function isValidCityIntro(intro, city) {
  if (!intro?.title || !intro.extract) return false;
  const cityLower = city.toLowerCase();
  const titleLower = intro.title.toLowerCase();
  const escaped = cityLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (titleLower.startsWith(cityLower) || titleLower.includes(`, ${cityLower},`)) {
    return true;
  }
  return new RegExp(
    `\\b${escaped}\\s+is\\s+(?:an?|the)\\s+`,
    'i'
  ).test(intro.extract);
}

function cityWikiTitle(city, state) {
  return `${city}, ${state}`;
}

function countyWikiTitle(county, state) {
  if (/,/.test(county)) return county;
  return `${county}, ${state}`;
}

function cityCacheKey(city, state) {
  return `${city.toLowerCase()}|${state.toLowerCase()}`;
}

function pickIntroForCity(introsByTitle, city, state, requestedTitle) {
  const wanted = requestedTitle.toLowerCase();
  if (introsByTitle.has(wanted)) {
    const intro = introsByTitle.get(wanted);
    if (isValidCityIntro(intro, city)) return intro;
  }
  for (const intro of introsByTitle.values()) {
    if (isValidCityIntro(intro, city)) return intro;
  }
  return null;
}

function geographyFromIntro(intro, city, state, countyMetroByTitle) {
  if (!intro) {
    return {
      city,
      state,
      cityTitle: null,
      countyTitle: null,
      metroTitle: null,
      error: 'wikipedia_not_found',
    };
  }

  let countyTitle = parseCountyFromExtract(intro.extract, state);
  let metroTitle = parseMetroFromExtract(intro.extract);

  countyTitle = countyTitle
    ? normalizeCountyName(countyTitle.split(',')[0], state)
    : null;

  if (countyTitle && !metroTitle) {
    const countyKey = countyWikiTitle(countyTitle, state).toLowerCase();
    const countyIntro = countyMetroByTitle?.get(countyKey);
    if (countyIntro) {
      metroTitle =
        normalizeMetroName(parseMetroFromExtract(countyIntro.extract) || '') ||
        null;
    }
  }

  metroTitle = metroTitle ? normalizeMetroName(metroTitle) : null;

  return {
    city,
    state,
    cityTitle: intro.title,
    countyTitle,
    metroTitle,
    error: null,
  };
}

async function wikiSearchTop(query, limit = 5) {
  const data = await wikiGet({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: String(limit),
  });
  return (data?.query?.search || []).map((h) => h.title);
}

export function loadGeographicCache(cachePath) {
  if (!cachePath || !fs.existsSync(cachePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (data?.version !== CACHE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveGeographicCache(cachePath, state, entries) {
  if (!cachePath) return;
  const payload = {
    version: CACHE_VERSION,
    state,
    updated: new Date().toISOString(),
    cities: entries,
  };
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(payload, null, 2), 'utf8');
}

/**
 * Resolve many US cities in few Wikipedia API round-trips.
 * @param {string[]} cities
 * @param {string} state
 * @param {{ cachePath?: string, refreshCache?: boolean }} [options]
 */
export async function resolveCitiesGeography(cities, state, options = {}) {
  const { cachePath = null, refreshCache = false } = options;
  const started = Date.now();
  let apiCalls = 0;

  const cache = !refreshCache ? loadGeographicCache(cachePath) : null;
  const cachedEntries = cache?.cities ? { ...cache.cities } : {};

  const needResolve = [];
  const results = new Map();

  for (const city of cities) {
    const key = cityCacheKey(city, state);
    const hit = cachedEntries[key];
    if (hit?.cityTitle && !refreshCache) {
      results.set(city, { ...hit, fromCache: true });
    } else {
      needResolve.push(city);
    }
  }

  if (needResolve.length === 0) {
    return {
      resolved: cities.map((c) => results.get(c)),
      errors: [],
      stats: {
        api_calls_estimate: 0,
        cached: cities.length,
        fetched: 0,
        elapsed_ms: Date.now() - started,
      },
    };
  }

  pauseMs = 200;
  const errors = [];

  // Pass 1: batch primary titles
  const primaryTitles = needResolve.map((c) => cityWikiTitle(c, state));
  apiCalls += Math.ceil(primaryTitles.length / BATCH_SIZE);
  let introsMap = await fetchIntroBatch(primaryTitles);

  const stillMissing = [];
  const introByCity = new Map();

  for (const city of needResolve) {
    const intro = pickIntroForCity(introsMap, city, state, cityWikiTitle(city, state));
    if (intro) introByCity.set(city, intro);
    else stillMissing.push(city);
  }

  // Pass 2: batch alternate titles for misses
  if (stillMissing.length) {
    const altTitles = stillMissing.map(
      (c) => `${c}, ${state}, United States`
    );
    apiCalls += Math.ceil(altTitles.length / BATCH_SIZE);
    const altMap = await fetchIntroBatch(altTitles);
    for (const [k, v] of altMap) introsMap.set(k, v);

    const stillMissing2 = [];
    for (const city of stillMissing) {
      const intro = pickIntroForCity(
        introsMap,
        city,
        state,
        `${city}, ${state}, United States`
      );
      if (intro) introByCity.set(city, intro);
      else stillMissing2.push(city);
    }
    stillMissing.length = 0;
    stillMissing.push(...stillMissing2);
  }

  // Pass 3: search + batch intros for remaining (typically 0–3 cities)
  if (stillMissing.length) {
    const searchTitles = [];
    for (const city of stillMissing) {
      apiCalls += 1;
      try {
        const hits = await wikiSearchTop(cityWikiTitle(city, state), 5);
        searchTitles.push(...hits);
        await adaptivePause();
      } catch (e) {
        errors.push({ city, error: String(e.message || e) });
      }
    }
    if (searchTitles.length) {
      apiCalls += Math.ceil(searchTitles.length / BATCH_SIZE);
      const searchMap = await fetchIntroBatch(searchTitles);
      for (const [k, v] of searchMap) introsMap.set(k, v);
      for (const city of stillMissing) {
        if (introByCity.has(city)) continue;
        const intro = pickIntroForCity(introsMap, city, state, cityWikiTitle(city, state));
        if (intro) introByCity.set(city, intro);
      }
    }
  }

  // Deduped county intros for metro lookup
  const countyTitlesNeeded = new Set();
  for (const city of needResolve) {
    const intro = introByCity.get(city);
    if (!intro) continue;
    let countyTitle = parseCountyFromExtract(intro.extract, state);
    const metroTitle = parseMetroFromExtract(intro.extract);
    countyTitle = countyTitle
      ? normalizeCountyName(countyTitle.split(',')[0], state)
      : null;
    if (countyTitle && !metroTitle) {
      countyTitlesNeeded.add(countyWikiTitle(countyTitle, state));
    }
  }

  let countyIntroMap = new Map();
  if (countyTitlesNeeded.size) {
    apiCalls += Math.ceil(countyTitlesNeeded.size / BATCH_SIZE);
    countyIntroMap = await fetchIntroBatch([...countyTitlesNeeded]);
  }

  for (const city of needResolve) {
    const intro = introByCity.get(city);
    if (!intro) {
      const row = {
        city,
        state,
        cityTitle: null,
        countyTitle: null,
        metroTitle: null,
        error: 'wikipedia_not_found',
      };
      results.set(city, row);
      if (!errors.some((e) => e.city === city)) {
        errors.push({ city, error: row.error });
      }
      continue;
    }
    const row = geographyFromIntro(intro, city, state, countyIntroMap);
    results.set(city, row);
    if (row.error) errors.push({ city, error: row.error });
    cachedEntries[cityCacheKey(city, state)] = row;
  }

  if (cachePath) {
    const prior = loadGeographicCache(cachePath);
    const merged = { ...(prior?.cities || {}), ...cachedEntries };
    saveGeographicCache(cachePath, prior?.state === 'multi' ? 'multi' : state, merged);
  }

  const resolved = cities.map((c) => {
    const r = results.get(c);
    return r || {
      city: c,
      state,
      cityTitle: null,
      countyTitle: null,
      metroTitle: null,
      error: 'wikipedia_not_found',
    };
  });

  return {
    resolved,
    errors,
    stats: {
      api_calls_estimate: apiCalls,
      cached: cities.length - needResolve.length,
      fetched: needResolve.length,
      elapsed_ms: Date.now() - started,
    },
  };
}

/**
 * Resolve one US city/town (delegates to batch resolver).
 */
export async function resolveCityGeography(city, state, options = {}) {
  const { resolved, errors } = await resolveCitiesGeography([city], state, options);
  return resolved[0] || { city, state, error: errors[0]?.error || 'wikipedia_not_found' };
}

/**
 * Build ordered paste structure: metros (ilvl 4) → counties (5) → cities (6).
 */
export function buildLocationTree(resolved) {
  const metros = new Map();
  const counties = new Map();

  for (const row of resolved) {
    if (!row.cityTitle) continue;
    if (
      row.countyTitle &&
      (row.countyTitle.includes('.') ||
        !/^[A-Z][a-zA-Z .'-]+ County, [A-Za-z ]+$/.test(row.countyTitle))
    ) {
      continue;
    }

    if (
      row.metroTitle &&
      /(?: metropolitan area| metro area)/i.test(row.metroTitle)
    ) {
      const key = row.metroTitle.toLowerCase();
      if (!metros.has(key)) {
        metros.set(key, { title: row.metroTitle });
      }
    }

    const countyKey = row.countyTitle;
    if (!countyKey) continue;
    if (!counties.has(countyKey)) {
      counties.set(countyKey, {
        title: row.countyTitle,
        cities: [],
        sortName: row.countyTitle,
      });
    }
    const bucket = counties.get(countyKey);
    if (!bucket.cities.some((c) => c.title === row.cityTitle)) {
      bucket.cities.push({ title: row.cityTitle });
    }
  }

  const metroList = [...metros.values()]
    .sort((a, b) => {
      const aSac = /sacramento metropolitan area/i.test(a.title);
      const bSac = /sacramento metropolitan area/i.test(b.title);
      if (aSac && !bSac) return -1;
      if (bSac && !aSac) return 1;
      return a.title.localeCompare(b.title);
    })
    .filter((m, i, arr) => {
      if (arr.length <= 1) return true;
      if (/greater sacramento/i.test(m.title)) return false;
      if (
        /^greater /i.test(m.title) &&
        arr.some((x) => /sacramento metropolitan/i.test(x.title))
      ) {
        return false;
      }
      return true;
    });

  const countyList = [...counties.values()]
    .filter((c) => c.title)
    .sort((a, b) => a.sortName.localeCompare(b.sortName))
    .map((c) => ({
      title: c.title,
      cities: c.cities.sort((a, b) => a.title.localeCompare(b.title)),
    }));

  const independentCities = [];
  for (const row of resolved) {
    if (!row.cityTitle || row.countyTitle) continue;
    if (
      row.metroTitle &&
      /(?: metropolitan area| metro area)/i.test(row.metroTitle)
    ) {
      const key = row.metroTitle.toLowerCase();
      if (!metros.has(key)) {
        metros.set(key, { title: row.metroTitle });
      }
    }
    independentCities.push({ title: row.cityTitle });
  }

  independentCities.sort((a, b) => a.title.localeCompare(b.title));

  return { metros: metroList, counties: countyList, independentCities };
}

/**
 * Build per-hub info used as input to the paste formatter.
 * The formatter (buildLocationDocxBlocks) now collapses consecutive duplicate
 * metro/county headers so that cities sharing a county are listed together
 * without repeating the parent hierarchy (non-bloated output).
 * @param {Array<{city:string,state:string,cityTitle?:string,countyTitle?:string|null,metroTitle?:string|null}>} resolved
 * @param {string[]} [hubOrder] Optional hub city names in display order
 */
export function buildLocationGroups(resolved, hubOrder = null) {
  const groups = new Map();

  for (const row of resolved) {
    if (!row.cityTitle) continue;
    if (
      row.countyTitle &&
      (row.countyTitle.includes('.') ||
        !/^[A-Z][a-zA-Z .'-]+ County, [A-Za-z ]+$/.test(row.countyTitle))
    ) {
      continue;
    }

    const key = row.city.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, {
        hubCity: row.city,
        state: row.state,
        metro: null,
        county: null,
        cities: [],
      });
    }
    const g = groups.get(key);
    if (row.metroTitle && /(?: metropolitan area| metro area)/i.test(row.metroTitle)) {
      g.metro = { title: row.metroTitle };
    }
    if (row.countyTitle) {
      g.county = { title: row.countyTitle };
    }
    if (!g.cities.some((c) => c.title === row.cityTitle)) {
      g.cities.push({ title: row.cityTitle });
    }
  }

  let list = [...groups.values()];
  if (hubOrder?.length) {
    const orderMap = new Map(
      hubOrder.map((c, i) => [c.toLowerCase(), i])
    );
    list.sort((a, b) => {
      const ai = orderMap.get(a.hubCity.toLowerCase());
      const bi = orderMap.get(b.hubCity.toLowerCase());
      if (ai != null && bi != null) return ai - bi;
      if (ai != null) return -1;
      if (bi != null) return 1;
      return a.hubCity.localeCompare(b.hubCity);
    });
  } else {
    list.sort((a, b) => a.hubCity.localeCompare(b.hubCity));
  }

  return list;
}

/** Metro article title candidates when city/county intros omit MSA name */
function metroTitleCandidates(city, state) {
  const c = [
    `${city} metropolitan area, ${state}`,
    `${city} metropolitan area`,
  ];
  if (city === 'Norfolk' && state === 'Virginia') {
    c.push('Virginia Beach-Norfolk-Newport News metropolitan area');
  }
  if (city === 'Wilmington' && state === 'North Carolina') {
    c.push('Wilmington, North Carolina metropolitan area');
    c.push('Wilmington metropolitan area, North Carolina');
    c.push('Wilmington metropolitan area');
  }
  if (city === 'Norfolk' && state === 'Virginia') {
    c.push('Hampton Roads');
  }
  return c;
}

/**
 * Fill missing metroTitle via direct Wikipedia metro article lookups.
 * @param {Array<{city:string,state:string,metroTitle?:string|null}>} resolved
 */
export async function enrichMetroTitles(resolved) {
  const need = resolved.filter((r) => r.cityTitle && !r.metroTitle);
  if (!need.length) return;

  const titles = new Set();
  const byCity = new Map();
  for (const row of need) {
    const candidates = metroTitleCandidates(row.city, row.state);
    byCity.set(row.city, candidates);
    for (const t of candidates) titles.add(t);
  }

  pauseMs = 200;
  const introMap = await fetchIntroBatch([...titles]);

  for (const row of need) {
    for (const candidate of byCity.get(row.city) || []) {
      const wanted = candidate.toLowerCase();
      let intro =
        introMap.get(wanted) ||
        introMap.get(candidate.replace(/–/g, '-').toLowerCase());
      if (!intro) {
        for (const v of introMap.values()) {
          if (v.title.toLowerCase() === wanted) {
            intro = v;
            break;
          }
        }
      }
      if (!intro?.title) continue;
      const normalized = normalizeMetroName(intro.title);
      if (normalized) {
        row.metroTitle = normalized;
        break;
      }
      if (intro.title === 'Hampton Roads') {
        row.metroTitle = 'Hampton Roads metropolitan area';
        break;
      }
    }
  }

  /** Verified display titles for multi-location brand hubs */
  const displayFallbacks = {
    'winchester|virginia': 'Winchester metropolitan area, Virginia',
    'wilmington|north carolina': 'Wilmington metropolitan area, North Carolina',
    'norfolk|virginia': 'Virginia Beach-Norfolk-Newport News metropolitan area',
  };
  for (const row of resolved) {
    const key = `${row.city}|${row.state}`.toLowerCase();
    if (displayFallbacks[key]) {
      row.metroTitle = displayFallbacks[key];
    }
  }
}

export { wikiUrl, STATE_ABBR };
