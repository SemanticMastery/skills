/**
 * Resolve a Google Maps / GBP share URL to a Company ID (CID) URL.
 *
 * Canonical form (schema hasMap + dossier [V] / [II] GBP URL):
 *   https://www.google.com/maps?cid={CID}
 *
 * Do not ship maps.app.goo.gl or share.google redirects as hasMap — they hide the CID.
 */

const CID_URL_RE = /^https:\/\/www\.google\.com\/maps\?cid=(\d+)$/;
const DIGITS_RE = /^\d{6,}$/;

export function cidUrlFromCid(cid) {
  const n = String(cid || '').trim();
  if (!DIGITS_RE.test(n)) return null;
  return `https://www.google.com/maps?cid=${n}`;
}

export function isCanonicalCidUrl(url) {
  return CID_URL_RE.test(String(url || '').trim());
}

export function isRedirectMapsUrl(url) {
  let host;
  try {
    host = new URL(String(url || '').trim()).hostname.toLowerCase();
  } catch {
    return false;
  }
  return (
    host === 'maps.app.goo.gl' ||
    host === 'goo.gl' ||
    host === 'share.google' ||
    host === 'maps.app.goo.gle'
  );
}

export function decodePlaceName(segment) {
  if (!segment) return null;
  try {
    return decodeURIComponent(segment.replace(/\+/g, ' ')).trim();
  } catch {
    return segment.replace(/\+/g, ' ').trim();
  }
}

export function hexPairToCid(hexPair) {
  const parts = String(hexPair || '').split(':');
  if (parts.length !== 2) return null;
  const second = parts[1];
  if (!/^0x[0-9a-f]+$/i.test(second)) return null;
  try {
    const cid = BigInt(second).toString(10);
    return DIGITS_RE.test(cid) ? cid : null;
  } catch {
    return null;
  }
}

export function extractCoordsFromUrl(url) {
  const at = String(url || '').match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return `${at[1]},${at[2]},500`;
  return null;
}

/**
 * Parse CID / place_id / name from a single Maps URL (no network).
 * @param {string} url
 */
export function extractIdentifiersFromUrl(url) {
  const out = {
    placeId: null,
    cid: null,
    name: null,
    kgmid: null,
    locationCoordinate: extractCoordsFromUrl(url),
    parseNotes: [],
  };

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    out.parseNotes.push('invalid_url');
    return out;
  }

  const placeIdParam = parsed.searchParams.get('place_id');
  if (placeIdParam?.startsWith('ChIJ')) {
    out.placeId = placeIdParam;
    out.parseNotes.push('query_place_id');
  }

  const cidParam = parsed.searchParams.get('cid');
  if (cidParam && /^\d+$/.test(cidParam)) {
    out.cid = cidParam;
    out.parseNotes.push('query_cid');
  }

  const qParam = parsed.searchParams.get('q');
  if (qParam && !out.name) {
    out.name = decodePlaceName(qParam);
    out.parseNotes.push('query_q');
  }

  const kgmid = parsed.searchParams.get('kgmid');
  if (kgmid) {
    out.kgmid = kgmid;
    out.parseNotes.push('query_kgmid');
  }

  const pathPlace = String(url).match(/\/maps\/place\/([^/@?]+)/i);
  if (pathPlace?.[1]) {
    const name = decodePlaceName(pathPlace[1]);
    if (name && name.toLowerCase() !== 'data') {
      out.name = out.name || name;
      out.parseNotes.push('path_place_name');
    }
  }

  const chijInUrl = String(url).match(/!1s(ChIJ[\w-]+)/);
  if (chijInUrl?.[1]) {
    out.placeId = out.placeId || chijInUrl[1];
    out.parseNotes.push('data_place_id');
  }

  const hexPair = String(url).match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (hexPair?.[1]) {
    const cid = hexPairToCid(hexPair[1]);
    if (cid) {
      out.cid = out.cid || cid;
      out.parseNotes.push('data_hex_cid');
    }
  }

  return out;
}

export async function followRedirects(inputUrl, max = 10) {
  let current = inputUrl;
  const chain = [current];
  for (let i = 0; i < max; i++) {
    const res = await fetch(current, {
      redirect: 'manual',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; maps-cid-resolve/1.0)' },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) break;
      current = new URL(loc, current).toString();
      chain.push(current);
      continue;
    }
    return { finalUrl: current, chain };
  }
  return { finalUrl: current, chain };
}

function emptyResolve(input) {
  return {
    ok: false,
    input,
    cid: null,
    cid_url: null,
    final_url: null,
    redirect_chain: [],
    place_id: null,
    name: null,
    parse_notes: [],
  };
}

/**
 * Resolve a confirmed GBP / Maps share / maps.app / place URL (or raw CID) to
 * `https://www.google.com/maps?cid={CID}`.
 *
 * @param {string} input
 * @returns {Promise<object>}
 */
export async function resolveMapsCid(input) {
  const raw = String(input || '').trim();
  const out = emptyResolve(raw);

  if (!raw) {
    out.parse_notes.push('empty_input');
    return out;
  }

  if (DIGITS_RE.test(raw)) {
    out.ok = true;
    out.cid = raw;
    out.cid_url = cidUrlFromCid(raw);
    out.parse_notes.push('raw_cid');
    return out;
  }

  const fromInput = extractIdentifiersFromUrl(raw);
  out.place_id = fromInput.placeId;
  out.name = fromInput.name;
  out.parse_notes.push(...fromInput.parseNotes);
  if (fromInput.cid) {
    out.ok = true;
    out.cid = fromInput.cid;
    out.cid_url = cidUrlFromCid(fromInput.cid);
    out.final_url = raw;
    return out;
  }

  let url;
  try {
    url = new URL(raw).toString();
  } catch {
    out.parse_notes.push('not_a_url');
    return out;
  }

  const { finalUrl, chain } = await followRedirects(url);
  out.final_url = finalUrl;
  out.redirect_chain = chain;

  for (const hop of chain) {
    const extracted = extractIdentifiersFromUrl(hop);
    out.place_id = out.place_id || extracted.placeId;
    out.name = out.name || extracted.name;
    out.parse_notes.push(...extracted.parseNotes);
    if (extracted.cid) {
      out.ok = true;
      out.cid = extracted.cid;
      out.cid_url = cidUrlFromCid(extracted.cid);
      return out;
    }
  }

  out.parse_notes.push('cid_unresolved');
  return out;
}
