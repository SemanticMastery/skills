# Scraper routing

Public-page scraping is the pilot ingest path. Official APIs are allowed when they are simpler and the brand owns the account. **Do not** log into Facebook or Instagram. A login wall stops that source.

## Agent sequence (every live ingest)

1. Read `{pipeline_dir}/01-resources/image-library/sources.md`. Missing file → hard-stop.
2. **GBP first (dedicated):** `node scripts/gbp-serpapi-owner.mjs --campaign-dir "{campaign_dir}" --q "{brand}"` (optional `--data-id`, `--ll`). Uses User env `SERPAPI_API_KEY`. Do **not** start GBP with a generic “maps photos” discover query.
3. **Facebook / Instagram:** discover → inspect → run (short queries below). If Monid is installed, use that sequence.
4. Persist bytes immediately. Never store expiring GBP `googleUrl` / Places `photoUri` / Instagram `media_url` as the library asset.
5. Write a payload JSON the Node ingest script can normalize (`--payloads`), then run `scripts/ingest.mjs`.
6. Pin all scraper output under the **campaign** `image-library/` tree. Never write scraper caches outside the campaign folder.

## GBP — known-working path (do this first)

A live tree-care campaign produced **100+ By-owner** stills this way. Failed first attempts (do not start here):

| Step | What |
|------|------|
| Auth | `SERPAPI_API_KEY` (User env) |
| Engine | `https://serpapi.com/search.json?engine=google_maps_photos` |
| Listing id | `data_id` (`0x…:0x…`). Resolve with `engine=google_maps` + brand `--q` if you only have a cid / maps URL. Damilo `fid` is this hex pair when you already have one. |
| Category | Read `categories[]`, pick title **By owner**. Known id `CgIgARICEAE` is the fallback hint (validated on a live listing). |
| Pages | Follow `serpapi_pagination.next_page_token` (cap ~12). |
| Keep | `lh3.googleusercontent.com` stills. Rewrite `=s1600`. `photo_category: "by_owner"`. `scraper: "serpapi-google-maps-photos"`. |
| Drop | `/geougc/` (GBP posts), Street View / pano, Maps UI chrome. |

Script: `scripts/gbp-serpapi-owner.mjs` → `{image-library}/_ingest-payloads/gbp-serpapi-owner-{date}.json` → `ingest.mjs --payloads`.

### GBP — do not start with these (failed first attempts)

| Attempt | Why it fails |
|---------|----------------|
| Monid discover `google maps photos by owner` | Returns reviews/local-listing actors, not Photos → By owner. SerpAPI Maps Photos is **not** in Monid. |
| context.dev `/web/scrape/images` on `maps.google.com/?cid=` or a listing URL | Infinite-scroll Maps chrome: logos, tiles, Street View, `/geougc/` posts. Not a By-owner gallery. |
| Apify `damilo/google-maps-scraper` by cid | One listing `thumbnailUrl`, not the owner gallery. |
| DataForSEO `my_business_updates` | GBP **posts**, not Photos → By owner. Ingest already skips these. |

context.dev `/web/scrape/images` stays valid for **static** pages only (for example a contrib `/maps/contrib/…/photos` HTML page after SerpAPI), never a Maps listing grid.

## Facebook / Instagram discover queries

| Source | Discover query | Named actor / endpoint |
|--------|----------------|------------------------|
| Instagram | `instagram posts` / `instagram post scraper` | Apify `instagram-post-scraper` (media URLs on posts) |
| Facebook | `facebook posts` | A **photos/posts** actor (`cleansyntax/facebook-profile-posts-scraper`). Do **not** use `facebook-pages-scraper` (cover/profile only). Disable tagged-in photos. Cap `max_posts`. |

## Page-owned definition (normalizer)

Keep:

- GBP listing photos in the **By owner** category (SerpAPI Maps Photos category, or the listing owner’s `/maps/contrib/…/photos` stills)
- Facebook/Instagram posts **authored by the page**
- **Evergreen job/site stills** — crew at work, equipment on a job, pruning/removal/disease/pests/land clearing, or a finished yard that can illustrate a post years later

Skip at ingest (HITL is the backstop for remaining evergreen candidates):

- **GBP posts / Google Updates** (`search.google.com/local/posts`, DataForSEO `my_business_updates`, `lh3` `/geougc/` URLs). Those are marketing posts, not the Photos → By owner gallery.
- **Stock** (`is_stock`, `photo_category: stock`)
- GBP **By customers**, Street View, videos, and other non-owner photo categories
- Tagged-in customer photos
- Review-author photos
- Other-people’s UGC (`is_ugc`, `is_tagged_in`, `is_review_author`)
- **Off-topic** (`is_off_topic`) — sports teams, parties, wrecked cars as the subject, anything outside **this campaign's** `image-library/classify.mjs` KEEP / OFF_TOPIC
- **Ephemeral promo** (`is_ephemeral_promo`, or captions with donate/Venmo/GoFundMe/fundrais/limited-time). Fundraising overlays and dated campaign flyers do not belong in the library.

Classify also omits `off_topic` / `ephemeral_promo` flags and **deletes** those binaries so they never enter the HITL queue. Manifest rows stay `rejected` so ingest does not re-download them.

GBP payload must set `photo_category: "by_owner"` (or equivalent). Missing category is allowed only for contrib `/photos` URLs; do not infer By owner from a GBP post caption.

## Payload shape for `ingest.mjs --payloads`

```json
{
  "records": [
    {
      "source_platform": "gbp",
      "scraper": "serpapi-google-maps-photos",
      "source_url": "https://www.google.com/maps?cid=0000000000000000000",
      "source_media_id": "gbp_owner_AHRPTWabc…",
      "media_url": "https://lh3.googleusercontent.com/gps-cs-s/AHRPTW…=s1600",
      "caption": "Example Tree Service",
      "photo_category": "by_owner",
      "is_ugc": false,
      "is_tagged_in": false,
      "is_review_author": false,
      "is_stock": false,
      "is_gbp_post": false,
      "login_wall": false
    }
  ]
}
```

`login_wall: true` skips that source and prints an operator-facing stop (no password prompt).
