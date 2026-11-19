# Business Dossier — Reference

## Script

`scripts/compose-business-dossier.mjs` (inside this skill package)

### Flags

| Flag | Required | Default |
|---|---|---|
| `--name` | Yes | — |
| `--address` | Yes | Geocoded to lat/long in `[II]` via Nominatim |
| `--latitude` / `--lat` | No | Override latitude (skip Nominatim) |
| `--longitude` / `--lng` | No | Override longitude (skip Nominatim) |
| `--phone` | Yes | — |
| `--website` | Yes | — |
| `--gbp-url` | Yes | Resolved to `https://www.google.com/maps?cid={CID}` (compose stops if CID cannot be resolved) |
| `--project-dir` | Yes | Campaign folder; dossier writes to `01-intake/1.1-docs/` |
| `--output-dir` | No | Override (default: `{project-dir}/01-intake/1.1-docs/`) |
| `--model` | No | `grok-4.5` |
| `--skip-pregather` | No | Run SerpAPI + Firecrawl pre-gather |
| `--skip-firecrawl` | No | SerpAPI only |
| `--keep-artifacts` | No | Keep temp pre-gather scratch dir (debug) |
| `--dry-run` | No | — |

CID helper: `scripts/resolve-maps-cid.mjs` (and `scripts/lib/resolve-maps-cid.mjs`). Input: share / maps.app / `/maps/place/` / raw CID. Output: `cid` + `https://www.google.com/maps?cid={CID}`. Compose calls it before Grok and writes the CID URL into `[II]` / `[V]`.

Place ID helper: `scripts/resolve-place-id.mjs`. A CID URL does not contain the Place ID. The script reads `[II]` **Place ID:** and, when that field is missing, calls SerpAPI `google_maps` with `data_cid`. `--write` stores `**Place ID:**` (`ChIJ…`) after **GBP CID:**. Compose does the same write from the pre-gather bundle, with one `data_cid` lookup only when the bundle has no Place ID. Local Search Grid must send that value as `target_place_id`. A numeric CID is not a Place ID.

Geocode helper: `scripts/lib/geocode-address.mjs`. Converts `--address` to decimal-degree **Latitude:** / **Longitude:** (Nominatim). Fallbacks: CLI `--latitude`/`--longitude`, Maps URL `!3dLAT!4dLNG`, then SerpAPI `gps_coordinates`. Compose writes those labels (plus **Geocode source:** / **Geocoded address:** when known) into `[II]` after Grok.

Legacy alias: `--skip-gbp-enrichment` → same as `--skip-pregather`.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | Success; all seven sections present |
| 1 | Fatal error (missing args, API failure, missing key) |
| 2 | Files written but section validation failed |

## Pre-gather module

`scripts/lib/pregather-dossier.mjs`

### SerpAPI steps

1. `get-gbp-categories.mjs --gbp-url` → NAP, categories, place_id
2. `google_maps&place_id=` → rating, reviews, hours, open_state, sample reviews

### Firecrawl steps (CLI)

Run in a temp scratch dir (`{tmpdir}/business-dossier-{slug}-{timestamp}/`); deleted after success:

| File | Command pattern |
|---|---|
| `website.md` | `firecrawl scrape "{website}" -o ...` |
| `search-reviews.json` | `firecrawl search "{name} {city} reviews yelp google" --scrape --limit 8 --json` |
| `search-owner.json` | `firecrawl search "{name} owner principal linkedin {city}" --limit 6 --json` |
| `search-bbb.json` | `firecrawl search "site:bbb.org \"{name}\" {city}" --limit 5 --json` |
| `search-registry.json` | `firecrawl search "{name} LLC incorporation secretary of state {city}" --limit 5 --json` |

If Firecrawl is not authenticated, SerpAPI pre-gather still runs; warnings appear in stdout JSON.

## xAI API (Grok synthesis)

- **Endpoint:** `POST https://api.x.ai/v1/responses`
- **Auth:** `Authorization: Bearer $GROK_API_KEY`
- **Model:** `grok-4.5`
- **Tools:** `[{ "type": "web_search" }, { "type": "x_search" }]`
- **Timeout:** 600s in script

Docs: [xAI Tools Overview](https://docs.x.ai/docs/guides/tools/overview)

## DOCX generation

`scripts/lib/markdown-dossier-docx.mjs` — standard Aptos dossier layout:

| Element | Format |
|---|---|
| Font | Aptos 12pt (24 half-points) |
| GBP header | Bold + italic lines (name, rating, category, hours) from SerpAPI |
| Intro | TSCR protocol sentence |
| Section headers | Bold `[I]`–`[VII]` (no trailing colon) |
| Body lines | Bold label + normal value |
| Digital ecosystem | 3-column bordered Word table |
| Image | Omitted |

**Platform:** DOCX zip step uses PowerShell `Compress-Archive` (Windows).

## Filename rules

- Display basename: `{Business-Name}-Dossier` (hyphenated slug from business name)
- Slug (temp scratch dirs): lowercase, apostrophes stripped, non-alphanumerics → hyphen
- Default output: `{project}/01-intake/1.1-docs/{Business-Name}-Dossier.md` and `.docx`
- If the campaign is not goldenized, stdout JSON sets `needs_goldenize: true` (still writes to `1.1-docs/`)
