---
name: dataforseo-onpage-crawl
disable-model-invocation: true
description: >-
  Run a DataForSEO OnPage domain crawl (task_post → poll → pages) with
  robots.txt + common sitemap/index discovery (/sitemaps.xml, /sitemap_index.xml,
  …), child-sitemap expansion for page budget, crawl_sitemap_only by default,
  canonical host alignment, automatic JS detection, Googlebot WAF bot-block
  retry (browser UA), stuck-at-zero → force_stop → instant fallback, overlapping
  post guard, EMPTY_CONTENT guard, check-task --wait (12–15 min), and lean 7-field
  CSV/XLSX. Local SEO default: full sitemap for service/storefront sites; for
  e-commerce or hybrid catalog sites, crawl scaffold + blogs (categories + core pages
  + blog posts/taxonomy; not individual product PDPs). Always execute via context-mode ctx_batch_execute
  (never Shell). Use when the user asks to crawl a domain with DataForSEO, run an
  OnPage crawl, dataforseo onpage crawl, or invokes this skill with a domain.
---

# DataForSEO OnPage Full Domain Crawl

**Incident learnings:** [docs/solutions/onpage-js-and-stall-fix.md](docs/solutions/onpage-js-and-stall-fix.md) (Summit 2026-06 — JS + polling; Northside Care 2026-07 — Googlebot / sitemap hang; Harborview 2026-08-10 — bot_block / stuck-zero / overlapping posts).

## When to use

Invoke when the operator provides a **domain** and wants the standard OnPage crawl workflow (not single-page Live audits).

**Inputs**

| Input | Required | Default |
|---|---|---|
| `domain` | Yes | — |
| `project_dir` | Strongly recommended | Campaign folder (`--project-dir`); reads `*Dossier.md` from **`01-intake/1.1-docs/`** (legacy root fallback) |
| `max_crawl_pages` | No | Auto from **expanded sitemap URL count** (+10 headroom) or `500` |

If the user says **no max** or **crawl everything**, pass `--max-crawl-pages 250000`.

**Do not cap crawls** for pure **local SEO / service-area / storefront** sites — crawl the **full expanded sitemap**.

**E-commerce or hybrid local + catalog sites:** This crawl is for local SEO, not a full product catalog. When the site sells products online (WooCommerce, Shopify, BigCommerce, etc.) or the expanded sitemap is dominated by individual product URLs, **do not crawl every product page**. Audit only the **site scaffold** — the primary structural frame a local SEO audit cares about.

## Sitemap discovery & expansion (required)

`resolve-site.mjs` **must** discover and expand sitemaps before `task_post`. Do not assume only `/sitemap.xml`.

### Discovery order

1. **`robots.txt` `Sitemap:` lines** (apex + www) — authoritative when present.
2. Common path slugs (apex + www), in order:

| Path | Notes |
|------|--------|
| `/sitemaps.xml` | Common WP / custom index (e.g. Northside Care) |
| `/sitemap_index.xml` | Yoast / RankMath style |
| `/sitemap-index.xml` | Hyphen variant |
| `/sitemap.xml` | Generic; often **redirects** to an index |
| `/wp-sitemap.xml` | Core WordPress |

3. Follow redirects; keep the **final** URL as `sitemap_url`.
4. If the document is a **`<sitemapindex>`**, fetch **every child** `<loc>` and count **page** URLs (skip nested `.xml` locs when tallying pages).

### What “full sitemap” means

The page budget is the **union of all child sitemap page URLs**, not the index file alone.

Example (Northside Care — validated 2026-07-14):

```text
https://getgreaterlifechiropractic.com/sitemaps.xml   ← index
  ├─ /post-sitemap1.xml
  ├─ /page-sitemap1.xml
  ├─ /portfolio-sitemap1.xml
  ├─ /category-sitemap1.xml
  └─ /portfolio_category-sitemap1.xml
→ expanded ≈ 388 page URLs → max_crawl_pages = count + 10, crawl_sitemap_only = true
```

Stderr should show `sitemap=… urls=N sitemap_only=true` and `sitemap_children=…`.

## Local SEO scope — e-commerce / hybrid catalog sites (required)

When the business is a **local business** that also runs an online catalog, or when the order is local SEO / GBP audit (not a dedicated e-commerce engagement), **limit the crawl to site scaffold + blog content** — not individual product PDPs.

### Include (keep)

| Page type | Examples |
|-----------|----------|
| Homepage | `/` |
| Top-level / primary nav | `/about/`, `/contact/`, `/locations/`, `/services/` |
| Legal / trust | `/privacy-policy/`, `/terms/` |
| Shop / catalog roots | `/shop/`, `/furniture/`, `/store/` (when they are category hubs, not PDPs) |
| **Product category** archives | WooCommerce `product_cat`, Shopify `/collections/{handle}` |
| **Subcategory** archives | Nested category paths (e.g. `/furniture/living-room/sofas/`) |
| Location / service-area pages | `/service-areas/…`, `/locations/…` |
| **Blog posts** | `/blog/{slug}/`, `/news/…`, `post-sitemap` locs |
| **Blog category / tag archives** | `/category/{slug}/`, `/blog/category/…`, `category-sitemap` locs (when blog taxonomy) |
| **Blog subcategories** | Nested blog taxonomy paths |

**Why blogs stay in:** blog posts and blog taxonomy pages often **compete with top-level service/location pages** in local SEO audits. They must be in the crawl export so cannibalization and overlap can be assessed.

### Exclude (drop)

| Page type | Examples |
|-----------|----------|
| **Individual product detail pages (PDPs)** | WooCommerce `/product/{slug}/`, Shopify `/products/{handle}`, `/collections/…/products/…` |
| Variant / SKU-only URLs | Size/color permalinks, cart, checkout, account |

**Do not** exclude blog child sitemaps (`post-sitemap`, blog `category-sitemap`, etc.) on local SEO / hybrid catalog crawls.

### Detection signals (agent)

Treat as **e-commerce / hybrid** when **any** of:

- Expanded sitemap count **≥ ~200** and child sitemaps include `product`, `products`, or `product-sitemap`
- Dossier categories mention **furniture store, retail, outlet, WooCommerce, Shopify**, etc.
- Manual order is **SEO Audit** on a site with a large product index (not a pure SAB service site)

When detected: **stop** a full-catalog crawl if already running (`force_stop` + clear `.dfs-active-task.json`), then re-post with filters below. Do **not** wait 45+ minutes for thousands of PDPs.

### Script flags (use together)

1. **Skip product child sitemaps** — keeps category/page sitemaps, drops PDP index files:

   ```text
   --exclude-sitemap-child product,products
   ```

   (`product_cat`, `page`, `post`, and blog `category` child sitemaps are kept; only `product-sitemap.xml` / Shopify `products` PDP index is skipped. **Never** pass `blogs` here for local SEO audits.)

2. **Deny PDP path segments** — safety net for stray product locs still in mixed sitemaps:

   ```text
   --deny-url-path /product/ --deny-url-path /products/
   ```

   (`/collections/foo/products/bar` is denied when `/products/` is in the deny list.)

3. **Keep homepage explicitly** when filtering:

   ```text
   --include-home
   ```

4. **Optional allow-list** for known category roots (narrow further if needed):

   ```text
   --allow-url-path /furniture/ --allow-url-path /pages/
   ```

   Only use `--allow-url-path` when the deny + exclude pass still leaves too many PDPs; it is stricter than deny-only.

Path filtering sets `crawl_sitemap_only=false` in scripts (product index children would otherwise burn the budget first). Expect **low hundreds** of URLs (scaffold + blog), not thousands of PDPs.

### Campaign note

Record the filter decision in `{projectFolder}/01-intake/1.2-audit/field-learnings.md`:

```text
crawl_scope: local_seo_scaffold
exclude_sitemap_children: product,products
deny_url_paths: /product/,/products/
```

### Crawl mode

| Condition | `crawl_sitemap_only` | Why |
|-----------|----------------------|-----|
| Sitemap found, not JS-required | **`true` (default)** | Crawl what sitemaps tell bots to crawl; avoids link-queue balloon |
| JS-required (probe) | `false` | Need spider + `respect_sitemap` for orphans |
| No sitemap found | `false` | Live-host spider only (weaker) |

**Never** leave large sitemap sites on unbounded spider mode — that looked like a hang (399 crawled + growing queue) while Website Auditor finished the same set in ~3–4 minutes.

Overrides: `--sitemap-only` / `--no-sitemap-only`; `field-learnings.md` → `no_sitemap_only: true`.

## Canonical workflow (default — do this)

**Never** use a fixed multi-minute shell loop or 11-minute `ctx_batch_execute` just to watch status. **Never** use Shell for the crawl wait — only `ctx_batch_execute`.

**Never** use `--max-wait-minutes 1` (or any wait under 12) when `sitemap_url_count ≥ 20`. Scripts reject it unless `--allow-short-wait`. Short waits caused fake failures (Harborview 2026-08-10).

| Step | Tool | Timeout |
|------|------|---------|
| **A. Post** | `crawl-domain.mjs --post-only` + `--project-dir` | ~180s (bot-block probe; may UA-retry once) |
| **B. Wait** | `check-task.mjs --task-id … --wait --expected-pages {N} --max-wait-minutes 15` | Exits on `finished` or stuck-zero escalate |
| **C. Deliver** | `crawl-domain.mjs --task-id … --project-dir …` (`min_pages` = sitemap loc count; fills gaps via `instant_pages`) | ~60s (+ fill) |

Step A runs **sitemap discovery + JS probe** automatically (`resolve-site.mjs`). If the site is JS-rendered, the script sets `enable_javascript` + `load_resources`, disables `crawl_sitemap_only`, and may use **apex** `target` (DataForSEO guidance for SPAs).

Step A also runs a **short bot-block probe** (~90s): if Googlebot finishes with `forbidden_http_header` / `site_unreachable` / tiny pages vs sitemap budget, **or** `progress=unknown` / 40602 limbo for the full probe window, it **force_stops** the Googlebot task, **auto-retries once** with a browser UA, writes `user_agent: browser` to `field-learnings.md`, and returns that `task_id` (`ua_retried: true`).

Active `task_id` is persisted at `{projectFolder}/01-intake/1.2-audit/.dfs-active-task.json`. A second `--post-only` for the same host is **refused** unless `--force-new-task` (which force_stops the prior task first).

### Step A — post

Confirm JSON includes `sitemap_url`, `sitemap_url_count`, `crawl_sitemap_only: true` (when a sitemap exists and not JS).

```json
{
  "commands": [{
    "label": "post",
    "command": "node \"dataforseo-onpage-crawl\\scripts\\crawl-domain.mjs\" --domain {domain} --project-dir \"{projectFolder}\" --post-only"
  }],
  "queries": ["task_id", "crawl_target", "sitemap_url", "sitemap_url_count", "crawl_sitemap_only", "enable_javascript", "user_agent", "ua_retried", "min_pages", "escalate_to_instant_fallback", "Error", "BOT_BLOCK", "ACTIVE_TASK"],
  "timeout": 240000,
  "concurrency": 1
}
```

### Step B — wait until finished

Pass `--expected-pages` from Step A’s `sitemap_url_count` so tiny finished crawls flag `bot_block`.

```json
{
  "commands": [{
    "label": "wait",
    "command": "node \"dataforseo-onpage-crawl\\scripts\\check-task.mjs\" --task-id {TASK_ID} --wait --poll-seconds 15 --max-wait-minutes 15 --expected-pages {sitemap_url_count} --html-count --project-dir \"{projectFolder}\""
  }],
  "queries": ["finished", "pages_crawled", "wait_complete", "bot_block", "stuck_zero", "escalate_to_instant_fallback", "extended_crawl_status", "Error", "WAIT_BUDGET"],
  "timeout": 960000,
  "concurrency": 1
}
```

Stops **immediately** when `crawl_progress=finished` (not a fixed poll count). Stderr heartbeats include `elapsed=` and `remain~`.

**If `bot_block: true` and `ua_retried` was false:** do **not** deliver. Re-run Step A with `--user-agent browser` (once).  
**If `stuck_zero` / `escalate_to_instant_fallback`:** do **not** `task_post` again. Run `sitemap-instant-fallback.mjs` (it force_stops the zombie / clears host lock first).  
**If `ACTIVE_TASK` error:** wait on the existing `task_id` — do not open a parallel crawl.

**Telemetry note:** `html_total_count` during wait may lag or stay at `1` while `pages_crawled` increases. Use the **deliver** step's `pages_returned` / written CSV row count as the completion truth — not wait-phase HTML totals alone. DataForSEO `empty_queue` can finish one loc short of our sitemap parse (TLC 2026-09-18: 20/21). Deliver re-resolves the sitemap and fills a missing loc with one `instant_pages` call. A loc that redirects to a URL already crawled is covered; do not start `sitemap-instant-fallback` for that gap (it fetches every sitemap URL again). Unique HTML rows may be below the sitemap loc count when those redirects share a row. Write the report in that case. A loc still missing after the fill is named in `sitemap_missing` and the report is still written.

### Step C — deliver

```json
{
  "commands": [{
    "label": "deliver",
    "command": "node \"dataforseo-onpage-crawl\\scripts\\crawl-domain.mjs\" --task-id {TASK_ID} --domain {crawl_target} --project-dir \"{projectFolder}\" --max-wait-minutes 2"
  }],
  "queries": ["pages_returned", "sitemap_url_count", "sitemap_filled", "sitemap_missing", "written", "content_quality", "EMPTY_CONTENT", "SITEMAP_INCOMPLETE", "Error"],
  "timeout": 120000,
  "concurrency": 1
}
```

## Pre-flight (automatic)

`resolve-site.mjs` before `task_post`:

1. Dossier **Official Website** host hint.
2. Live redirect chain.
3. **Sitemap discovery** (robots + path slugs above) → expand index children → `sitemap_url_count`.
4. Set `crawl_sitemap_only` / `max_crawl_pages` / `min_pages` from expanded count. `min_pages` is the sitemap loc count, never a 60% floor. Missing locs are filled with `instant_pages`. `pages_returned` may be below `sitemap_url_count` when locs redirect onto a page already crawled, or when a loc stays unresolved. Unresolved locs are `sitemap_missing`. The report is still written. Zero HTML rows is a failure and does not write.
5. **JS probe** — plain fetch of first sitemap URL; low visible text ⇒ auto JS (override with `--no-auto-javascript`).
6. If JS required: apex `target`, `crawl_sitemap_only: false`, `respect_sitemap: true` (orphans e.g. `/service`, `/location`).

Stderr: `crawl_target`, `sitemap=… urls=N sitemap_only=…`, `sitemap_children=…`, `js_probe … js_required=…`.

## JavaScript-required sites

| Without JS | With auto JS (default when probe fires) |
|---|---|
| `pages_crawled` 0 or tiny | Full sitemap count in ~1–3 min (SMB) |
| `/pages` 1 row vs many crawled | HTML rows match `pages_crawled` |
| Looks like “API stall” | Normal `finished` |

Manual override: `--enable-javascript` or `--no-auto-javascript`.

API rule: `enable_javascript: true` requires **`load_resources: true`** (script sets both). Do not set `enable_browser_rendering` without `load_resources` (40501).

## Googlebot WAF / bot-block

**First-class failure modes** (Northside Care 2026-07, Harborview 2026-08-10): `task_post` **succeeds** but crawl is useless:

| Signal | Meaning |
|---|---|
| `finished` + `pages_crawled===0` + `forbidden_http_header` | Bot/WAF block |
| `finished` + `site_unreachable` + tiny pages | Same class — retry browser UA |
| `finished` + pages ≪ sitemap budget | Tiny crawl — treat as bot_block when `--expected-pages` set |
| Bot-probe `progress=unknown` / status `40602` for full ~90s | Soft-fail → force_stop → browser UA (not limbo) |
| `finished` + pages ≈ sitemap + `no_errors` | Success path |

**Default UA** remains Googlebot-Mobile (SEO-realistic). On bot-block, scripts auto-retry **once** with a Chrome browser UA (force_stopping the Googlebot task first), then auto-append `user_agent: browser` to campaign `field-learnings.md`. Do **not** open a third overlapping `task_post`.

Flags: `--user-agent googlebot|browser|<custom>`, `--no-probe-bot-block`, `--no-ua-retry`, `--force-new-task`.  
`field-learnings.md` may already set `user_agent: browser` for known WAF sites.

## Stuck `in_progress`

| Stall pattern | Script behavior |
|---|---|
| `pages_crawled > 0`, queue empty, idle 3 polls | `force_stop` → poll until `finished` |
| `pages_crawled === 0`, queue empty for **3 min** | `force_stop` → `stuck_zero` + `escalate_to_instant_fallback` (no third `task_post`) |
| **40602** queue only during full crawl wait | Fail after **5 min** |
| Bot-probe unknown/40602 full window | Soft-fail → browser UA (see above) |
| After `force_stop` | Platform may delay `finished` (fixed 2026-06); keep `--wait` polling |
| Growing queue with `crawl_sitemap_only=false` on a large sitemap | Wrong mode — abort / re-post with sitemap-only (default now) |
| Overlapping `--post-only` same host | Refused (`ACTIVE_TASK`) unless `--force-new-task` |

**Do not write deliverables** until `finished` and rows ≥ `--min-pages`, and content guard passes.

## Deliverable (on disk)

| Rule | Detail |
|---|---|
| **Path** | `{projectFolder}/01-intake/1.2-audit/` (default when `--project-dir` is set; override with `--output-dir` for legacy `audit/crawl-report/`) |
| **Files** | `onpage-crawl-{domain-slug}-{YYYY-MM-DD}.csv` and `.xlsx` |
| **Per-client notes** | Optional `{projectFolder}/01-intake/1.2-audit/field-learnings.md` (legacy: `audit/crawl-report/field-learnings.md` still read if present) |
| **Content guard** | Refuse write when `pages_returned > 0` but ≥95% of rows lack **both** `meta_title` and `word_count` (`EMPTY_CONTENT`). Override only with `--allow-empty-content` (debug). |

**Downstream geo note:** `build-geographic-locations.mjs` auto-finds crawl CSVs under `01-intake/1.2-audit/` first, then legacy `audit/crawl-report/`. Callers may still pass `--crawl-csv` explicitly.

When auto JS probe misses a site (boilerplate HTML), add to `{projectFolder}/01-intake/1.2-audit/field-learnings.md`:

```text
enable_javascript: true
crawl_target: summittrees.example
no_sitemap_only: true
```

Known Googlebot WAF:

```text
user_agent: browser
```

The script reads these lines when `--project-dir` is set (see [onpage-js-and-stall-fix.md](docs/solutions/onpage-js-and-stall-fix.md)).

## REST, not MCP

Full crawls: DataForSEO REST (`DATAFORSEO_USERNAME`, `DATAFORSEO_PASSWORD`). MCP Live = single URL only.

## Execution: context-mode only (never Shell)

| Script | Purpose |
|--------|---------|
| `scripts/resolve-site.mjs` | Host + **sitemap discovery/expansion** + JS probe |
| `scripts/crawl-domain.mjs` | Post (+ bot-block probe), overlap guard, poll, export |
| `scripts/check-task.mjs` | Status snapshot or `--wait` (flags `bot_block`, stuck-zero escalate) |
| `scripts/active-task.mjs` | Persist/clear `.dfs-active-task.json` + field-learnings write-through |
| `scripts/sitemap-instant-fallback.mjs` | Last resort per-URL `instant_pages` (force_stops zombie first; browser UA; progress/ETA) |
| `scripts/regenerate-deliverables.mjs` | Rebuild CSV/XLSX from existing CSV |
| `scripts/content-quality.mjs` | EMPTY_CONTENT guard |

## `task_post` body (script defaults)

| Field | Default | JS probe auto | Bot-block retry |
|---|---|---|---|
| `target` | Resolved www/sitemap host | Apex if JS required | unchanged |
| `respect_sitemap` | `true` | `true` | unchanged |
| `crawl_sitemap_only` | **`true` if sitemap found** | `false` | unchanged |
| `enable_javascript` | `false` | `true` | unchanged |
| `load_resources` | `false` | `true` | unchanged |
| `custom_user_agent` | Googlebot-Mobile | unchanged | **browser Chrome UA** |
| `max_crawl_pages` | expanded sitemap count + 10 | same | unchanged |

## Script flags

| Flag | Purpose |
|---|---|
| `--domain` | Required on new crawls |
| `--project-dir` | Campaign folder; dossier from `01-intake/1.1-docs/` + default output to `01-intake/1.2-audit/` |
| `--post-only` | Post task, bot-block probe (~90s), print JSON, exit |
| `--force-new-task` | Allow new post while same-host task active (force_stops it first) |
| `--user-agent` | `googlebot` (default) \| `browser` \| custom string |
| `--no-probe-bot-block` | Skip post-only bot-block probe / auto UA retry |
| `--no-ua-retry` | Never auto-repost with browser UA |
| `--allow-empty-content` | Bypass empty title/words guard (debug only) |
| `--allow-short-wait` | Permit `--max-wait-minutes` &lt; 12 with known sitemap budget (not recommended) |
| `--task-id` | Wait/deliver only (no new charge) |
| `--output-dir` | Write CSV + XLSX (defaults to `{project-dir}/01-intake/1.2-audit/`) |
| `--enable-javascript` | Force JS on |
| `--no-auto-javascript` | Ignore JS probe |
| `--sitemap-only` / `--no-sitemap-only` | Override sitemap-only |
| `--allow-url-path` | Repeatable. Keep locs whose path contains this (`/pages/`, `/collections/`) |
| `--deny-url-path` | Repeatable. Drop locs whose path contains this (`/products/` also drops `/collections/*/products/`) |
| `--include-home` | Keep `/`; set `start_url` + `priority_urls` to the homepage |
| `--exclude-sitemap-child` | Skip child sitemaps by token — **local SEO hybrid:** `product,products` only (keep blog/post/category sitemaps; do not pass `blogs`) |
| `--max-zero-progress-minutes` | Default **3** → force_stop + escalate |
| `--max-wait-minutes` | Default **15** (min **12** when sitemap budget ≥ 20) |
| `--no-resolve-canonical` | Pin `--domain` as target |
| `--expected-pages` | (`check-task` only) sitemap budget for tiny-crawl `bot_block` |
| `--stop-task-id` | (`sitemap-instant-fallback`) force_stop this zombie before instant_pages |

## Escalation ladder

`task_post` HTTP success is **not** crawl success. One clean path — no overlapping posts.

| Step | Action |
|------|--------|
| 1 | Default `--post-only` with `--project-dir` (sitemap discovery + auto JS + Googlebot; bot-block probe may switch to browser UA once) |
| 2 | `check-task --wait --expected-pages N --max-wait-minutes 15` (never 1-min waits) |
| 3 | If `bot_block` and no `ua_retried`, re-post with `--user-agent browser` **once** (script usually did this already) |
| 4 | If `stuck_zero` / browser UA also fails → `sitemap-instant-fallback.mjs` (force_stops zombie; clears host lock). **No third `task_post`.** |
| 5 | Deliver with `--task-id` when every sitemap loc has a row (`pages_returned` ≥ `sitemap_url_count`) and `content_quality.content_ratio` is healthy |
| 6 | Manual `--enable-javascript` if probe skipped (JS sites) |
| 7 | DataForSEO ticket — see [onpage-js-and-stall-fix.md](docs/solutions/onpage-js-and-stall-fix.md) |

## Lean output fields

| Field | Source |
|---|---|
| `url` | `item.url` |
| `meta_title` | `meta.meta_title ?? meta.title` |
| `h1_count` | `htags.h1.length` |
| `h1_headings` | h1 array or single string |
| `h2_h6_count` | h2–h6 count |
| `word_count` | `meta.content.plain_text_word_count` |
| `is_orphan_page` | `item.is_orphan_page` |

## When invoked by seo-audit-pipeline

Return **only** this JSON:

```json
{
  "step": 2,
  "step_key": "2_onpage_crawl",
  "skill": "dataforseo-onpage-crawl",
  "status": "complete",
  "artifacts": ["absolute paths to crawl CSV and xlsx if produced"],
  "extracted_fields": {
    "domain": "",
    "crawl_target": "",
    "crawl_csv": "",
    "page_count": 0
  },
  "errors": [],
  "cost_notes": []
}
```
