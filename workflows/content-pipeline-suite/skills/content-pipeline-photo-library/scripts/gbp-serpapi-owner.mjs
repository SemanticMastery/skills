#!/usr/bin/env node
/**
 * Fetch GBP Photos → By owner via SerpAPI (the known-working path).
 *
 * Usage:
 *   node gbp-serpapi-owner.mjs --campaign-dir "C:\\...\\Campaign"
 *   node gbp-serpapi-owner.mjs --campaign-dir "..." --data-id "0x...:0x..."
 *   node gbp-serpapi-owner.mjs --campaign-dir "..." --q "Brand Name" --ll "@36.73,-76.10,12z"
 *
 * Requires User env SERPAPI_API_KEY. Writes payload under
 * {pipeline}/01-resources/image-library/_ingest-payloads/
 * then print JSON. Agent runs ingest.mjs --payloads on that file.
 */
import fs from "node:fs";
import path from "node:path";
import { parseCampaignArgs, requireCampaignDir } from "./lib/campaign.mjs";
import { libraryDir } from "./lib/library.mjs";
import {
  gbpUrlFromSourcesMarkdown,
  parseCidFromUrl,
  parseDataIdLike,
  pickOwnerCategory,
  recordFromPhoto,
} from "./lib/gbp-serpapi.mjs";

const MAX_PAGES_DEFAULT = 12;

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

async function serpapi(apiKey, engine, params) {
  const q = new URLSearchParams({
    engine,
    hl: "en",
    api_key: apiKey,
    no_cache: "true",
    ...params,
  });
  const res = await fetch(`https://serpapi.com/search.json?${q}`);
  return res.json();
}

function photosFrom(page) {
  return Array.isArray(page?.photos) ? page.photos : [];
}

function placeResults(page) {
  if (page?.place_results) return [page.place_results];
  return Array.isArray(page?.local_results) ? page.local_results : [];
}

async function resolveDataId(apiKey, { dataId, q, ll, cid }) {
  if (dataId) return { dataId, searches: 0, probe: [{ given: dataId }] };
  const probe = [];
  let searches = 0;
  if (!q) {
    return { dataId: null, searches, probe, error: "need --data-id or --q to resolve listing" };
  }
  const params = { q, type: "search" };
  if (ll) params.ll = ll;
  searches += 1;
  const maps = await serpapi(apiKey, "google_maps", params);
  const places = placeResults(maps);
  const byCid = cid
    ? places.find((p) => String(p.cid || "") === String(cid) || String(p.data_cid || "") === String(cid))
    : null;
  const byName = places.find((p) =>
    new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(p.title || p.name || ""),
  );
  const hit = byCid || byName || places.find((p) => p.data_id) || null;
  probe.push({
    maps_search: true,
    error: maps.error || null,
    place_titles: places.slice(0, 8).map((p) => p.title || p.name || null),
    hit_data_id: hit?.data_id || null,
  });
  return { dataId: hit?.data_id || null, searches, probe, error: maps.error || null };
}

async function main() {
  const args = parseCampaignArgs(process.argv);
  if (args.help) {
    console.log(
      "node gbp-serpapi-owner.mjs --campaign-dir <abs> [--data-id 0x..:0x..] [--q brand] [--ll @lat,lng,12z] [--source-url url] [--caption text]",
    );
    process.exit(0);
  }
  const { campaignDir, pipelineDir } = requireCampaignDir(args);
  const apiKey = process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.error(JSON.stringify({ ok: false, error: "missing SERPAPI_API_KEY" }));
    process.exit(1);
  }

  const libDir = libraryDir(pipelineDir);
  const sourcesPath = path.join(libDir, "sources.md");
  const sourcesMd = fs.existsSync(sourcesPath) ? fs.readFileSync(sourcesPath, "utf8") : "";
  const sourceUrl = args.extra["source-url"] || gbpUrlFromSourcesMarkdown(sourcesMd);
  if (!sourceUrl) {
    console.error(JSON.stringify({ ok: false, error: "no GBP url — add sources.md gbp row or --source-url" }));
    process.exit(1);
  }

  const dataIdArg = parseDataIdLike(args.extra["data-id"] || args.extra.fid);
  const q = args.extra.q || null;
  const ll = args.extra.ll || null;
  const cid = args.extra.cid || parseCidFromUrl(sourceUrl);
  const caption = args.extra.caption || "";
  const maxPages = Number(args.extra["max-pages"] || MAX_PAGES_DEFAULT);

  const resolved = await resolveDataId(apiKey, { dataId: dataIdArg, q, ll, cid });
  let searches = resolved.searches;
  const probe = resolved.probe || [];
  if (!resolved.dataId) {
    console.error(
      JSON.stringify({
        ok: false,
        error: resolved.error || "could not resolve data_id — pass --data-id from a Maps listing",
        probe,
      }),
    );
    process.exit(1);
  }
  const dataId = resolved.dataId;

  searches += 1;
  let first = await serpapi(apiKey, "google_maps_photos", { data_id: dataId });
  const categories = Array.isArray(first.categories)
    ? first.categories.map((c) => ({ title: c.title, id: c.id }))
    : [];
  const ownerCat = pickOwnerCategory(categories);

  first = await serpapi(apiKey, "google_maps_photos", {
    data_id: dataId,
    category_id: ownerCat.id,
  });
  searches += 1;
  if (first.error) {
    console.error(JSON.stringify({ ok: false, error: first.error, data_id: dataId, categories, probe }));
    process.exit(1);
  }

  const pages = [first];
  let token = first?.serpapi_pagination?.next_page_token || null;
  while (token && pages.length < maxPages) {
    const page = await serpapi(apiKey, "google_maps_photos", {
      data_id: dataId,
      category_id: ownerCat.id,
      next_page_token: token,
    });
    searches += 1;
    if (page.error) break;
    pages.push(page);
    token = page?.serpapi_pagination?.next_page_token || null;
    await new Promise((r) => setTimeout(r, 250));
  }

  const seen = new Set();
  const records = [];
  let skippedGeougc = 0;
  let skippedOther = 0;
  for (const page of pages) {
    for (const ph of photosFrom(page)) {
      const rec = recordFromPhoto(ph, { sourceUrl, caption });
      if (!rec) {
        const u = ph.image || ph.thumbnail || "";
        if (/geougc/i.test(u)) skippedGeougc += 1;
        else skippedOther += 1;
        continue;
      }
      if (seen.has(rec.source_media_id)) continue;
      seen.add(rec.source_media_id);
      records.push(rec);
    }
  }

  const destDir = path.join(libDir, "_ingest-payloads");
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, `gbp-serpapi-owner-${todayStamp()}.json`);
  fs.writeFileSync(dest, `${JSON.stringify({ records }, null, 2)}\n`);

  console.log(
    JSON.stringify({
      ok: true,
      campaign_dir: campaignDir,
      data_id: dataId,
      owner_category: ownerCat,
      categories,
      searches,
      pages: pages.length,
      more: Boolean(token),
      records: records.length,
      skippedGeougc,
      skippedOther,
      payload: dest,
      probe,
    }),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }));
  process.exit(1);
});
