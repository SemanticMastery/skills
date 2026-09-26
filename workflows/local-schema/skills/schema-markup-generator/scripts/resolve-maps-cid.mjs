#!/usr/bin/env node
/**
 * Schema preflight: resolve a Maps / GBP share / maps.app / place URL to
 * https://www.google.com/maps?cid={CID} for hasMap + Maps sameAs.
 *
 * Lives in this skill so schema runs do not depend on business-dossier being open.
 * Algorithm matches business-dossier/scripts/lib/resolve-maps-cid.mjs — keep them in sync.
 *
 * Exit 0 when CID is resolved. Exit 1 when unresolved (stop — do not ship the redirect URL).
 */

const CID_URL_RE = /^https:\/\/www\.google\.com\/maps\?cid=(\d+)$/;
const DIGITS_RE = /^\d{6,}$/;

function cidUrlFromCid(cid) {
  const n = String(cid || '').trim();
  if (!DIGITS_RE.test(n)) return null;
  return `https://www.google.com/maps?cid=${n}`;
}

function hexPairToCid(hexPair) {
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

function decodePlaceName(segment) {
  if (!segment) return null;
  try {
    return decodeURIComponent(segment.replace(/\+/g, ' ')).trim();
  } catch {
    return segment.replace(/\+/g, ' ').trim();
  }
}

function extractIdentifiersFromUrl(url) {
  const out = { placeId: null, cid: null, name: null, parseNotes: [] };
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    out.parseNotes.push('invalid_url');
    return out;
  }

  const cidParam = parsed.searchParams.get('cid');
  if (cidParam && /^\d+$/.test(cidParam)) {
    out.cid = cidParam;
    out.parseNotes.push('query_cid');
  }

  const placeIdParam = parsed.searchParams.get('place_id');
  if (placeIdParam?.startsWith('ChIJ')) {
    out.placeId = placeIdParam;
    out.parseNotes.push('query_place_id');
  }

  const qParam = parsed.searchParams.get('q');
  if (qParam) {
    out.name = decodePlaceName(qParam);
    out.parseNotes.push('query_q');
  }

  const pathPlace = String(url).match(/\/maps\/place\/([^/@?]+)/i);
  if (pathPlace?.[1]) {
    const name = decodePlaceName(pathPlace[1]);
    if (name && name.toLowerCase() !== 'data') {
      out.name = out.name || name;
      out.parseNotes.push('path_place_name');
    }
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

async function followRedirects(inputUrl, max = 10) {
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

async function resolveMapsCid(input) {
  const raw = String(input || '').trim();
  const out = {
    ok: false,
    input: raw,
    cid: null,
    cid_url: null,
    final_url: null,
    redirect_chain: [],
    place_id: null,
    name: null,
    parse_notes: [],
  };

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

  if (CID_URL_RE.test(raw)) {
    out.ok = true;
    out.cid = raw.match(CID_URL_RE)[1];
    out.cid_url = raw;
    out.final_url = raw;
    out.parse_notes.push('already_canonical');
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

function parseArgs(argv) {
  const out = { url: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url' && argv[i + 1]) out.url = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
    else if (!a.startsWith('-') && !out.url) out.url = a;
  }
  return out;
}

function usage() {
  return `Usage:
  node resolve-maps-cid.mjs --url "https://maps.app.goo.gl/..."
  node resolve-maps-cid.mjs --url "https://share.google/..."
  node resolve-maps-cid.mjs --url "https://www.google.com/maps/place/..."

Output JSON: { ok, cid, cid_url, input, final_url, redirect_chain, parse_notes }
Exit 1 if CID cannot be resolved — do not write maps.app / share.google as hasMap or Maps sameAs.`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.url) {
    console.log(usage());
    process.exit(args.help ? 0 : 1);
  }

  const resolved = await resolveMapsCid(args.url);
  console.log(JSON.stringify(resolved, null, 2));
  process.exit(resolved.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
