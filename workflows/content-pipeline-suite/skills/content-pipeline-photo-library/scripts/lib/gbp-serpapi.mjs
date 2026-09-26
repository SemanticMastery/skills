/**
 * SerpAPI Google Maps Photos helpers.
 * Canonical GBP By-owner path. Do not use context.dev / damilo on Maps listing URLs.
 */

export const OWNER_CATEGORY_HINT = "CgIgARICEAE";
export const SCRAPER = "serpapi-google-maps-photos";

export function mediaTok(s) {
  const x = String(s || "");
  const m = x.match(
    /(AH1DqX[A-Za-z0-9_-]{8,}|AHRPTW[A-Za-z0-9_-]{8,}|AF1Qip[A-Za-z0-9_-]{8,}|AciI[A-Za-z0-9_-]{8,})/,
  );
  return m ? m[1].replace(/=.*$/, "").slice(0, 28) : null;
}

export function hiResUrl(u) {
  const raw = String(u || "");
  if (!raw) return raw;
  return `${raw.split("=")[0]}=s1600`;
}

export function keepOwnerPhotoUrl(u) {
  const s = String(u || "");
  if (!/lh3\.googleusercontent\.com/i.test(s)) return false;
  if (/geougc/i.test(s)) return false;
  if (/streetview|pano/i.test(s)) return false;
  return true;
}

export function pickOwnerCategory(categories) {
  const list = Array.isArray(categories) ? categories : [];
  const hit = list.find((c) => /by owner/i.test(c.title || ""));
  return hit || { title: "By owner", id: OWNER_CATEGORY_HINT };
}

export function parseCidFromUrl(url) {
  const s = String(url || "");
  const m = s.match(/[?&]cid=(\d+)/i);
  return m ? m[1] : null;
}

export function parseDataIdLike(value) {
  const s = String(value || "").trim();
  if (/^0x[0-9a-f]+:0x[0-9a-f]+$/i.test(s)) return s;
  return null;
}

/** Read the first `gbp` row URL from sources.md. */
export function gbpUrlFromSourcesMarkdown(md) {
  for (const line of String(md || "").split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cols = line.split("|").map((c) => c.trim());
    const platform = (cols[1] || "").toLowerCase();
    if (platform === "gbp" && /^https?:\/\//i.test(cols[2] || "")) return cols[2];
  }
  return null;
}

export function recordFromPhoto(ph, { sourceUrl, caption }) {
  const u = ph.image || ph.thumbnail || "";
  if (!keepOwnerPhotoUrl(u)) return null;
  const tok = mediaTok(u) || mediaTok(ph.thumbnail);
  if (!tok) return null;
  return {
    source_platform: "gbp",
    scraper: SCRAPER,
    source_url: sourceUrl,
    source_media_id: `gbp_owner_${tok}`,
    media_url: hiResUrl(u),
    caption: caption || "",
    photo_category: "by_owner",
    is_ugc: false,
    is_tagged_in: false,
    is_review_author: false,
    is_stock: false,
    is_gbp_post: false,
    login_wall: false,
  };
}
