/** Google Place IDs used as Embed My Reviews `target_place_id`. */

export const GOOGLE_PLACE_ID_RE = /^ChIJ[A-Za-z0-9_-]{10,120}$/;

export function isGooglePlaceId(value) {
  return GOOGLE_PLACE_ID_RE.test(String(value || "").trim());
}
