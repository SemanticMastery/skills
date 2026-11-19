/**
 * Geocode a physical street address to latitude / longitude.
 *
 * Primary: OpenStreetMap Nominatim (no API key).
 * Fallbacks: CLI overrides, Google Maps URL pin (!3d/!4d), SerpAPI gps_coordinates.
 */

const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'SemanticLinks-business-dossier/1.3.0 (ops; address geocode)';

/** Reject null/empty so Number(null) === 0 is not treated as a coordinate. */
function hasCoordInput(n) {
  if (n == null || n === '') return false;
  if (typeof n === 'string' && !n.trim()) return false;
  return true;
}

/** @param {unknown} n */
export function isValidCoordinate(n) {
  if (!hasCoordInput(n)) return false;
  const x = Number(n);
  return Number.isFinite(x) && Math.abs(x) <= 180;
}

/** @param {unknown} lat @param {unknown} lng */
export function isValidLatLng(lat, lng) {
  if (!hasCoordInput(lat) || !hasCoordInput(lng)) return false;
  const latitude = Number(lat);
  const longitude = Number(lng);
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

/**
 * Format decimal degrees for dossier labels (strip float junk, keep precision).
 * @param {unknown} n
 * @returns {string}
 */
export function formatDecimalDegrees(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '';
  return String(Number(x.toFixed(7)));
}

/**
 * Prefer place pin `!3dLAT!4dLNG` over map-center `@lat,lng`.
 * Same tokens appear in a Maps share URL and in Maps HTML after the pin.
 * @param {string} [text]
 * @returns {{ latitude: number, longitude: number } | null}
 */
export function parseCoordsFromMapsUrl(mapsUrl) {
  const text = String(mapsUrl || '');
  if (!text) return null;

  const pin = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pin && isValidLatLng(pin[1], pin[2])) {
    return { latitude: Number(pin[1]), longitude: Number(pin[2]) };
  }

  const at = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at && isValidLatLng(at[1], at[2])) {
    return { latitude: Number(at[1]), longitude: Number(at[2]) };
  }

  return null;
}

const MAPS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * Follow a GBP / Maps URL and read the pin (`!3d!4d` / `@lat,lng`).
 * Stand-in for right-clicking the Maps pin. Fails for SAB unpublished addresses.
 * @param {string} [mapsUrl]
 * @param {{ timeoutMs?: number }} [opts]
 */
export async function resolveCoordsFromMapsPage(mapsUrl, { timeoutMs = 15000 } = {}) {
  const raw = String(mapsUrl || '').trim();
  if (!raw) return { ok: false, error: 'empty maps url' };

  const fromInput = parseCoordsFromMapsUrl(raw);
  if (fromInput) {
    return { ok: true, ...fromInput, source: 'maps-url' };
  }

  let current;
  try {
    current = new URL(raw).toString();
  } catch {
    return { ok: false, error: 'not a url' };
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    for (let i = 0; i < 8; i++) {
      const res = await fetch(current, {
        redirect: 'manual',
        headers: { 'User-Agent': MAPS_UA, Accept: 'text/html,*/*' },
        signal: ac.signal,
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) break;
        current = new URL(loc, current).toString();
        const hop = parseCoordsFromMapsUrl(current);
        if (hop) return { ok: true, ...hop, source: 'maps-page' };
        continue;
      }
      const html = await res.text();
      const fromHtml = parseCoordsFromMapsUrl(html);
      if (fromHtml) return { ok: true, ...fromHtml, source: 'maps-page' };
      break;
    }
    return { ok: false, error: 'maps page had no pin coords' };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'maps page timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {object} [placeDetails]
 * @returns {{ latitude: number, longitude: number } | null}
 */
export function parseSerpGps(placeDetails) {
  const gps = placeDetails?.gps_coordinates || placeDetails?.gpsCoordinates;
  if (!gps) return null;
  if (isValidLatLng(gps.latitude, gps.longitude)) {
    return { latitude: Number(gps.latitude), longitude: Number(gps.longitude) };
  }
  return null;
}

/**
 * Suite / unit tokens break Nominatim. Strip them and a trailing country.
 * @param {string} [address]
 */
export function streetForGeocode(address) {
  return String(address || '')
    .replace(/,?\s*\bUnited States\b\.?/gi, '')
    .replace(/\s+\b(?:suite|ste|unit|apt)\.?\s+[\w-]+/gi, '')
    .replace(/\s+#\s*[\w-]+/gi, '')
    .replace(/\s*,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*$/g, '')
    .trim();
}

export async function geocodeNominatim(address, { timeoutMs = 15000 } = {}) {
  const q = String(address || '').trim();
  if (!q) return { ok: false, error: 'empty address' };
  const cleaned = streetForGeocode(q);
  const attempts = cleaned && cleaned !== q ? [q, cleaned] : [q];
  let last = { ok: false, error: 'empty address' };
  for (const attempt of attempts) {
    last = await geocodeNominatimOnce(attempt, { timeoutMs });
    if (last.ok) return last;
  }
  return last;
}

async function geocodeNominatimOnce(q, { timeoutMs = 15000 } = {}) {
  const url = `${NOMINATIM_SEARCH}?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      signal: ac.signal,
    });
    if (!res.ok) {
      return { ok: false, error: `Nominatim HTTP ${res.status}` };
    }
    const rows = await res.json();
    const hit = Array.isArray(rows) ? rows[0] : null;
    if (!hit || !isValidLatLng(hit.lat, hit.lon)) {
      return { ok: false, error: 'Nominatim returned no coordinates' };
    }
    return {
      ok: true,
      latitude: Number(hit.lat),
      longitude: Number(hit.lon),
      display_name: hit.display_name || '',
      source: 'nominatim',
      address: q,
    };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'Nominatim timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve lat/long for an intake address.
 *
 * Precedence: CLI overrides → Maps URL pin → Maps page pin → Nominatim(address).
 *
 * @param {string} address
 * @param {{ latitude?: unknown, longitude?: unknown, mapsUrl?: string, timeoutMs?: number }} [opts]
 */
export async function geocodeAddress(address, { latitude, longitude, mapsUrl, timeoutMs } = {}) {
  const trimmed = String(address || '').trim();

  if (isValidLatLng(latitude, longitude)) {
    return {
      ok: true,
      latitude: Number(latitude),
      longitude: Number(longitude),
      display_name: '',
      source: 'cli',
      address: trimmed,
    };
  }

  const fromUrl = parseCoordsFromMapsUrl(mapsUrl);
  if (fromUrl) {
    return {
      ok: true,
      ...fromUrl,
      display_name: '',
      source: 'maps-url',
      address: trimmed,
    };
  }

  if (mapsUrl) {
    const fromPage = await resolveCoordsFromMapsPage(mapsUrl, { timeoutMs });
    if (fromPage.ok) {
      return {
        ok: true,
        latitude: fromPage.latitude,
        longitude: fromPage.longitude,
        display_name: '',
        source: fromPage.source || 'maps-page',
        address: trimmed,
      };
    }
    if (!trimmed) return { ok: false, error: fromPage.error, address: trimmed };
  }

  if (trimmed) {
    const nominatim = await geocodeNominatim(trimmed, { timeoutMs });
    if (nominatim.ok) return nominatim;
    return { ok: false, error: nominatim.error || 'geocode failed', address: trimmed };
  }

  return { ok: false, error: 'empty address', address: trimmed };
}

/**
 * If geocode is still unresolved, use SerpAPI place GPS.
 * @param {object} geo
 * @param {object} [placeDetails]
 */
export function applySerpGpsFallback(geo, placeDetails) {
  if (geo?.ok) return geo;
  const gps = parseSerpGps(placeDetails);
  if (!gps) return geo || { ok: false, error: 'no serp gps' };
  return {
    ok: true,
    ...gps,
    display_name: placeDetails?.title || '',
    source: 'serpapi',
    address: geo?.address || '',
    warning: geo?.error,
  };
}

const SOURCE_LABELS = {
  nominatim: 'OpenStreetMap Nominatim',
  cli: 'CLI override',
  'maps-url': 'Google Maps URL',
  'maps-page': 'Google Maps pin',
  serpapi: 'SerpAPI Google Maps',
};

/** @param {string} [source] */
export function geocodeSourceLabel(source) {
  if (!source) return '';
  return SOURCE_LABELS[source] || source;
}

/**
 * Compact object for dossier labels + stdout JSON.
 * @param {object} geo
 */
export function geoForOutput(geo) {
  if (!geo?.ok) {
    return {
      ok: false,
      latitude: null,
      longitude: null,
      source: null,
      display_name: null,
      error: geo?.error || 'unresolved',
    };
  }
  return {
    ok: true,
    latitude: formatDecimalDegrees(geo.latitude),
    longitude: formatDecimalDegrees(geo.longitude),
    source: geo.source || null,
    source_label: geocodeSourceLabel(geo.source),
    display_name: geo.display_name || null,
  };
}
