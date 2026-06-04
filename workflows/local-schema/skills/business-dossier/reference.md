# Business Dossier — Reference

## Script

`{{BUNDLE_ROOT}}/scripts/seo/compose-business-dossier.mjs`

### Flags

| Flag | Required | Default |
|---|---|---|
| `--name` | Yes | — |
| `--address` | Yes | — |
| `--phone` | Yes | — |
| `--website` | Yes | — |
| `--gbp-url` | Yes | — |
| `--project-dir` | Yes | — |
| `--model` | No | `grok-4.3` |
| `--skip-pregather` | No | Run SerpAPI + Firecrawl pre-gather |
| `--skip-firecrawl` | No | SerpAPI only |
| `--keep-artifacts` | No | Keep temp pre-gather scratch dir (debug) |
| `--dry-run` | No | — |

Legacy alias: `--skip-gbp-enrichment` → same as `--skip-pregather`.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | Success; all seven sections present |
| 1 | Fatal error (missing args, API failure, missing key) |
| 2 | Files written but section validation failed |

## Pre-gather module

`{{BUNDLE_ROOT}}/scripts/seo/lib/pregather-dossier.mjs`

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
- **Model:** `grok-4.3`
- **Tools:** `[{ "type": "web_search" }, { "type": "x_search" }]`
- **Timeout:** 600s in script

Docs: [xAI Tools Overview](https://docs.x.ai/docs/guides/tools/overview)

## DOCX generation

`scripts/seo/lib/markdown-dossier-docx.mjs` — matches **Box Tree Care Dossier.docx** layout:

| Element | Format |
|---|---|
| Font | Aptos 12pt (24 half-points) |
| GBP header | Bold + italic lines (name, rating, category, hours) from SerpAPI |
| Intro | TSCR protocol sentence |
| Section headers | Bold `[I]`–`[VII]` (no trailing colon) |
| Body lines | Bold label + normal value |
| Digital ecosystem | 3-column bordered Word table |
| Image | Omitted (optional in future) |

Reference file: `Semantic Links\...\Box Tree Care\Box Tree Care Dossier.docx`

## Optional grok-mcp supplement

If `[V] DIGITAL ECOSYSTEM` needs deeper X/Twitter shadow data after the script run:

1. `health_check` on grok-mcp
2. `search_users` / `search_posts` for owner name + company name
3. Append findings to dossier **only** with Bradley approval

## Filename rules

- Display basename: `{name.trim()} Dossier`
- Slug (temp scratch dirs): lowercase, apostrophes stripped, non-alphanumerics → hyphen
- Project folder receives **only** `{name} Dossier.md` and `{name} Dossier.docx`
