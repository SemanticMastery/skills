# DataForSEO OnPage: JS requirement, stalls, bot-block, and polling

**Incidents:**

| Date | Site | Theme |
|------|------|--------|
| 2026-06 | DeForest Tree Service (`deforesttrees.com`) | JS + `force_stop` delay |
| 2026-07-13 | Greater Life Chiropractic (`getgreaterlifechiropractic.com`) | Googlebot WAF / `forbidden_http_header` |

---

## Incident A — DeForest (2026-06)

**Resolution:** DataForSEO platform `force_stop` delay fixed; site requires `enable_javascript`; apex target + `respect_sitemap` for full 14-page export.

### Root causes (two separate issues)

#### 1. Platform: `force_stop` → `finished` delay

- **Symptom:** `crawl_progress` stays `in_progress` after `pages_in_queue=0`; `force_stop` returns 20000 but summary unchanged for minutes.
- **Status:** DataForSEO developers fixed (2026-06). Allow extra polls after `force_stop`; use `check-task.mjs --wait` (exits on `finished`).

#### 2. Site: JavaScript-rendered HTML

- **Symptom:** With `enable_javascript: false`, `pages_crawled` stays 0 or very low; `/pages` HTML export is 1 row while summary shows more; looks like a “stuck crawl.”
- **Cause:** Most pages return no usable body without JS (DataForSEO confirmed for deforesttrees.com).
- **Fix:** `enable_javascript: true` and **`load_resources: true`** (API 40501 if `enable_browser_rendering` without `load_resources`).
- **Orphans:** `/service` and `/location` require **`respect_sitemap: true`** (always on in our script).

#### 3. Wrong diagnostics (our side)

- Long fixed shell poll loops after `finished` — use **`check-task --wait`** only.
- Zero-progress for 10 min without trying JS — script now **auto-probes** and enables JS.

### Validated working `task_post` (DeForest)

```json
{
  "target": "deforesttrees.com",
  "max_crawl_pages": 20,
  "enable_javascript": true,
  "respect_sitemap": true
}
```

| Metric | Value |
|--------|--------|
| task_id | `06051433-1841-0216-0000-15169fcb9ed1` |
| Time to `finished` | ~64s |
| `pages_crawled` | 14 |
| `/pages` HTML rows | 14 |

---

## Incident B — Greater Life (2026-07-13)

**Site:** Greater Life Chiropractic — storefront chiropractic, Charlotte NC (`getgreaterlifechiropractic.com`).  
**Primary task id:** `07132147-1841-0216-0000-28d3be80673e`

### What happened

1. `crawl-domain.mjs --post-only` / OnPage `task_post` **succeeded** in ~6s.
2. `check-task --wait` reported `crawl_progress=finished`, **`pages_crawled=0`**, `extended_crawl_status=forbidden_http_header`, `crawl_stop_reason=empty_queue`.
3. JS probe: `js_required=false` — **not** a rendering issue.
4. Root cause: skill hardcoded **Googlebot-Mobile** as `custom_user_agent`; this site’s WAF resets/drops Googlebot. Normal browser UA → 200 OK.
5. Escalation used `sitemap-instant-fallback.mjs` over the **full sitemap (~390 URLs)** — correct completeness for a service site, but ~15–20 min sequential with weak progress UX → looked like a hang in chat.
6. Deliverables eventually wrote to ICM path: `…/Greater-Life-Chiropractic/01-intake/1.2-audit/onpage-crawl-getgreaterlifechiropracticcom-2026-07-13.csv` (+xlsx), `page_count=390`.

### Lesson

| Wrong assumption | Reality |
|------------------|---------|
| “If `task_post` succeeds, crawl is fine” | `task_post` only queues work; finished+0+`forbidden_http_header` is a **first-class failure** |
| “0 pages ⇒ try JS” | Bot/WAF block can look like 0 pages with `js_required=false` |
| Jump to instant_pages immediately | Prefer **one browser-UA `task_post` retry** first (seconds, not 20 min) |
| Silent long fallback | Full-sitemap instant_pages is valid but **must** emit progress + ETA |

### Related (geo coupling — not this skill’s job)

Feeding the full blog-heavy crawl into geographic city extraction produced `city_count=293` blog titles. Pipeline blocked correctly. Storefront audits only need city→county→metro — separate from crawl completeness.

### Fix shipped (2026-07-14)

- Detect bot-block: `finished` + `pages_crawled===0` + `forbidden_http_header` (and similar).
- `--post-only` short probe (~90s) auto-retries **once** with browser Chrome UA.
- `check-task` sets `bot_block: true` + `ua_retry_hint`.
- `sitemap-instant-fallback` defaults to **browser** UA; per-URL progress + ETA heartbeats; **no cap** for service sites.
- Escalation docs updated; geo auto-find also scans `01-intake/1.2-audit/`.
- **EMPTY_CONTENT guard:** refuse CSV/XLSX when row count &gt; 0 but ≥95% of rows lack both title and word_count (Greater Life thin shells). Override: `--allow-empty-content`.

### Fix shipped (2026-07-14b) — sitemap hang / discovery

- **Hang root cause:** large sitemaps used `crawl_sitemap_only=false` → unbounded link queue (browser task hit 399 crawled + 260 queued while WA finished sitemap set in ~3.5m).
- **Default:** `crawl_sitemap_only=true` whenever a sitemap exists (except JS-required sites).
- **Discovery:** robots.txt `Sitemap:` + `/sitemaps.xml`, `/sitemap_index.xml`, `/sitemap-index.xml`, `/sitemap.xml`, `/wp-sitemap.xml`; expand all child sitemaps for page budget.
- **UA retry:** also treat `site_unreachable` and tiny finished vs sitemap budget as bot-block (Googlebot 1-page finish).

---

## Per-client overrides (`field-learnings.md`)

Some sites (including **deforesttrees.com**) serve boilerplate HTML with high plain-text word counts but DataForSEO still needs JS. The HTTP probe may **not** auto-detect these.

When `--project-dir` is set, `crawl-domain.mjs` reads `field-learnings.md` from (first match):

1. `{project_dir}/01-intake/1.2-audit/field-learnings.md` (Golden Image default)
2. `{project_dir}/audit/crawl-report/field-learnings.md` (legacy fallback during transition)

Example blocks:

```text
enable_javascript: true
crawl_target: deforesttrees.com
no_sitemap_only: true
use_apex_target: true
```

```text
user_agent: browser
```

Copy into any client folder after diagnosis confirms JS and/or Googlebot WAF.

## Automated behavior

`resolve-site.mjs` before every new crawl:

1. Resolves live host + sitemap alignment.
2. **JS probe:** plain HTTP fetch of first sitemap URL (or homepage); if visible text &lt; 100 words or SPA shell markers → `jsRequiredRecommended`.
3. If JS required: **auto** `enable_javascript` + `load_resources`; **disable** `crawl_sitemap_only`; **prefer apex** `target` (strip `www.`).
4. `crawl-domain.mjs`: zero-progress fail-fast at 3 min; `force_stop` on idle queue; **bot-block probe + browser UA retry** on `forbidden_http_header`.

## Escalation ladder

| Step | Action |
|------|--------|
| 1 | Default crawl with `--project-dir` (auto JS if probe says so; Googlebot first) |
| 2 | Bot-block probe / `check-task` `bot_block` → re-post `--user-agent browser` (once) |
| 3 | `check-task.mjs --wait` then deliver with `--task-id` |
| 4 | Manual `--enable-javascript` if probe skipped (JS sites) |
| 5 | `sitemap-instant-fallback.mjs` if domain crawl still returns 0 pages (full sitemap, browser UA, progress/ETA) |
| 6 | DataForSEO ticket with `task_id`, probe output, `task_post` body |

## Scripts

| Script | Role |
|--------|------|
| `crawl-domain.mjs` | Post (+ bot probe), poll (exit on `finished`), export CSV/XLSX |
| `check-task.mjs` | Snapshot or `--wait` until `finished`; flags `bot_block` |
| `resolve-site.mjs` | Host + sitemap + JS probe |
| `sitemap-instant-fallback.mjs` | Per-URL `instant_pages` backup (browser UA default) |

## Do not reuse (failed tasks)

- `06042329-1841-0216-0000-48d952092934` — no JS, 1 HTML export row
- `06050039-…`, `06050057-…`, `06050103-…` — no JS / wrong mode
- `07132147-1841-0216-0000-28d3be80673e` — Googlebot blocked (`forbidden_http_header`, 0 pages); use browser UA retry instead
