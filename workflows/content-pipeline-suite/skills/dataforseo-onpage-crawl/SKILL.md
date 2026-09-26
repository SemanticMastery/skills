---
name: dataforseo-onpage-crawl
description: >-
  Full DataForSEO OnPage domain crawl (task_post → poll → pages) with sitemap
  discovery/expansion, JS detection, Googlebot WAF retry, and lean 7-field
  CSV/XLSX under {project}/outputs/dataforseo-onpage-crawl/. Use for domain
  OnPage crawls via DataForSEO.
---

# DataForSEO OnPage Full Domain Crawl

Operational notes: [docs/solutions/onpage-js-and-stall-fix.md](docs/solutions/onpage-js-and-stall-fix.md)

## When to use

User provides a **domain** (or project with a business dossier) and wants a full OnPage crawl — not single-page Live audits.

## Inputs

| Input | Required | Default |
|---|---|---|
| `domain` | Yes (or dossier website via `--project-dir`) | — |
| `project_dir` | Recommended | Reads `*Dossier.md` from `outputs/business-dossier/` or project root |
| `max_crawl_pages` | No | Auto from expanded sitemap (+10) or `500` |
| `output-dir` | No | `{project}/outputs/dataforseo-onpage-crawl/` |

Pass `--max-crawl-pages 250000` only when the user wants essentially uncapped.

## Auth

Env: `DATAFORSEO_USERNAME`, `DATAFORSEO_PASSWORD`

## Setup (once per machine/project)

```bash
cd path/to/dataforseo-onpage-crawl
npm install
```

## Canonical workflow

| Step | Command |
|------|---------|
| A. Post | `node scripts/crawl-domain.mjs --domain {domain} --project-dir "{project}" --post-only` |
| B. Wait | `node scripts/check-task.mjs --task-id {id} --wait --expected-pages {sitemap_url_count}` |
| C. Deliver | `node scripts/crawl-domain.mjs --task-id {id} --project-dir "{project}" --min-pages {min_pages}` |

cwd for outputs = **project folder**. Scripts path = this skill folder.

### Sitemap discovery

`resolve-site.mjs` must discover sitemaps (robots.txt + common paths including `/sitemaps.xml`, `/sitemap_index.xml`, `/sitemap.xml`, `/wp-sitemap.xml`) and expand sitemap indexes before `task_post`.

Default: `crawl_sitemap_only=true` when a sitemap exists and the site is not JS-required.

### Bot-block / JS

Step A probes for Googlebot blocks and may retry once with a browser UA. JS-rendered sites enable javascript + resources and may disable sitemap-only mode.

## Deliverables

`{project}/outputs/dataforseo-onpage-crawl/onpage-crawl-{slug}-{date}.csv` (+ `.xlsx`)

Lean columns: url, meta_title, h1_count, h1_headings, h2_h6_count, word_count, (+ quality fields as script defines).

## Errors

- Missing credentials → stop and ask user to set env vars.
- 429 / rate limits → stop; do not hammer.
- EMPTY_CONTENT / bot_block → report; consider browser UA or sitemap fallback script.
