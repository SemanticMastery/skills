/**
 * Resolve a Google Maps Company ID to a Place ID.
 *
 * `https://www.google.com/maps?cid={CID}` does not contain the Place ID.
 * SerpAPI `google_maps` with `data_cid` returns `place_results.place_id`.
 */

import { isGooglePlaceId } from "./place-id.mjs";

const SERPAPI = "https://serpapi.com/search.json";
const CID_RE = /^\d{6,}$/;

export async function resolvePlaceIdFromCid(
  cid,
  { fetchImpl = globalThis.fetch, apiKey = process.env.SERPAPI_API_KEY } = {}
) {
  const n = String(cid || "").trim();
  if (!CID_RE.test(n)) {
    return { ok: false, place_id: null, error: "invalid_cid" };
  }
  if (!apiKey) {
    return { ok: false, place_id: null, error: "missing_serpapi_key" };
  }

  const url = new URL(SERPAPI);
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("data_cid", n);
  url.searchParams.set("api_key", apiKey);

  let json;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) {
      return { ok: false, place_id: null, error: `serpapi_http_${res.status}` };
    }
    json = await res.json();
  } catch (err) {
    return { ok: false, place_id: null, error: err.message || "serpapi_fetch_failed" };
  }

  if (json?.error) {
    return { ok: false, place_id: null, error: `serpapi_${json.error}` };
  }

  const placeId = json?.place_results?.place_id || null;
  if (!isGooglePlaceId(placeId)) {
    return { ok: false, place_id: null, error: "place_id_missing" };
  }

  return {
    ok: true,
    place_id: placeId,
    title: json.place_results.title || null,
    data_cid: String(json.place_results.data_cid || n),
  };
}
