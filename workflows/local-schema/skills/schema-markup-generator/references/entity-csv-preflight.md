# Entity CSV preflight (Step 2b)

Run **after** Steps 0–0b (local/contractor only), **Step 1** (silo), and **Step 2** (page role). Run **before** JSON-LD for any **service** or **location** page that uses `WebPage.about` topic entities.

Mirrors **Step 0 → `business-dossier`**: schema-markup-generator **must explicitly invoke** the companion skill when files are missing — passive routing will not run it (`disable-model-invocation: true` on **knowsabout-entity-research**).

## When Step 2b applies

| Scenario | Step 2b |
|----------|---------|
| **Service page** (`WebPage` + `Service`, topic entities on `WebPage.about`) | **Required** |
| **Location page** (Simple Silo: `WebPage` + `ItemList`, topic entities on `WebPage.about`) | **Required** |
| Homepage only (`Corporation` + `LocalBusiness`, no per-page `about` CSV) | **Skip** unless user requests homepage topic CSV |
| FAQ, Article, Product, non-local content | **Skip** |
| User says "refresh entity CSV" / "re-run knowsabout" | Re-run for named slugs even if CSV exists |

## Resolve `project_dir`

- **Campaign folder root** (cwd or user-provided absolute path).
- **Canonical CSV path:** `{project_dir}/02-deliverables/2.4-schema/knowsabout/{slug}-knowsabout.csv`
- **Legacy fallback (read-only):** `{project_dir}/resources/schema/knowsabout/{slug}-knowsabout.csv` → `{project_dir}/resources/schema/{slug}-knowsabout.csv` → `{project_dir}/resources/{slug}-knowsabout.csv` — migrate to `02-deliverables/2.4-schema/knowsabout/` on refresh.
- **Layout:** [schema-artifact-layout.md](schema-artifact-layout.md). Copy [SCHEMA-LAYOUT.template.md](SCHEMA-LAYOUT.template.md) → `{project_dir}/02-deliverables/2.4-schema/SCHEMA-LAYOUT.md` on first run if missing.

## Build the slug checklist

From Step 2 page-role mapping, list every **service** and **location** slug in scope for this run:

| Source (priority) | How to get slugs |
|-------------------|------------------|
| User message | Explicit URLs or slugs (e.g. `/tree-removal`, "all service pages") |
| On-page crawl CSV | `01-intake/1.2-audit/` or `audit/crawl-report/onpage-crawl-*.csv` — filter money-page URLs; slug = path segment |
| Sitemap / implementation doc | e.g. `02-deliverables/2.4-schema/*-implementation.md` or `SCHEMA-LAYOUT.md` slug tables |
| Single-page request | One slug from canonical path (`tree-trimming` from `/tree-trimming`) |

Normalize: lowercase, hyphenated (`mount-storm`, `plant-health-care`). That string is `{slug}` in the filename.

## Check for existing CSVs (glob / skip)

Use `Glob` or `ctx_execute` — do not assume files exist.

**Canonical:**

```
{project_dir}/02-deliverables/2.4-schema/knowsabout/{slug}-knowsabout.csv
{project_dir}/02-deliverables/2.4-schema/knowsabout/*-knowsabout.csv
```

**Legacy (if migrating old projects):**

```
{project_dir}/resources/schema/knowsabout/{slug}-knowsabout.csv
{project_dir}/resources/schema/knowsabout/*-knowsabout.csv
{project_dir}/resources/schema/{slug}-knowsabout.csv
{project_dir}/resources/schema/*-knowsabout.csv
{project_dir}/resources/{slug}-knowsabout.csv
```

For **each** slug in the checklist:

| Condition | Action |
|-----------|--------|
| CSV **missing** at canonical and legacy paths | Add to **invoke list** |
| File **exists**, user did **not** ask refresh, Grokipedia not all `-` | **Skip** — read CSV via `ctx_execute` / `Read` (one file at a time) |
| File **exists**, Grokipedia column **entirely `-`** | Add to invoke list (Grokipedia verification pass) unless user waived Grokipedia |
| User asked **refresh** for that page | Add to invoke list |

**Do not** hand-build entity rows in chat or JSON-LD when the CSV is missing — that bypasses verification and Grokipedia rules.

## Missing or incomplete CSV — invoke companion skill (mandatory)

When the invoke list is non-empty:

1. **Read and follow** `C:\Users\bradl\.cursor\skills\knowsabout-entity-research\SKILL.md` in full for this session (same as explicitly running `/knowsabout-entity-research`).
2. Pass each seed: H1/service name + page role (`service` vs `location`) + `project_dir`.
3. Use `scripts/resolve-entity-urls.mjs` per that skill (paced Wikipedia/Wikidata/Grokipedia).
4. Write `{project_dir}/02-deliverables/2.4-schema/knowsabout/{slug}-knowsabout.csv` and update `knowsabout-batch-manifest.csv` on batch runs.
5. **Wait** until every invoke-list slug has a CSV on disk before Step 4 JSON-LD.

**Forbidden:**

- Continuing to `services/service-*.jsonld` / `locations/location-*.jsonld` while any in-scope slug lacks a CSV.
- Inline `Thing` entities copied from memory or Wikipedia without the CSV pipeline.
- Saying "I'll add entities later" in the implementation handoff.

**Chat (one line when triggering):**

> Missing entity CSVs for: `{slug1}`, `{slug2}`, … — running **knowsabout-entity-research** before schema JSON-LD.

## After companion skill completes

1. Re-glob canonical (and legacy) paths for each slug — confirm files exist.
2. Spot-check: header row present; Grokipedia column not entirely `-` (unless user waived).
3. Continue schema-markup-generator **Step 4** — write JSON-LD under `02-deliverables/2.4-schema/services/` or `locations/` per [schema-artifact-layout.md](schema-artifact-layout.md); map CSV rows to `WebPage.about` per [schema-templates.md § Service page](schema-templates.md#service-page-simple-silo-contractor-sites--validated-pattern).

## Slug → seed term hints

| Page role | Seed term (for knowsabout skill) |
|-----------|----------------------------------|
| Service | H1 or service name + "service" if ambiguous (e.g. `Tree Removal Service`, `plant health care service`) |
| Location | `{City}, West Virginia` in resolver **stdin JSON** (e.g. `Cabins, West Virginia`) — never `--names` with commas |

**Location slugs:** from sitemap / `*-implementation.md` / `SCHEMA-LAYOUT.md` / onpage crawl — one `{slug}-knowsabout.csv` each. Client-specific seeds and opensearch fixes: **`{project_dir}/02-deliverables/2.4-schema/field-learnings.md`** (legacy read: `resources/schema/field-learnings.md`).

## Resolver invocation (Step 2b handoff)

When invoking **knowsabout-entity-research**:

1. `Glob` missing CSV at canonical + legacy paths.
2. Read `knowsabout-entity-research` SKILL.md + project `02-deliverables/2.4-schema/field-learnings.md` (if present; legacy: `resources/schema/field-learnings.md`) + global [field-learnings.md](../../knowsabout-entity-research/references/field-learnings.md).
3. Run `resolve-entity-urls.mjs` with **`--stdin`** and **`--overrides 02-deliverables/2.4-schema/entity-url-overrides.json`** when that file exists. Temps under `02-deliverables/2.4-schema/_tmp/`.
4. Merge results; write JSON-LD under `services/` or `locations/`; do not inline `Thing` entities from memory.

## Integration

| Skill | Relationship |
|-------|----------------|
| **`knowsabout-entity-research`** | Upstream for service/location `WebPage.about` — produces `knowsabout/{slug}-knowsabout.csv` |
| **`business-dossier`** | Independent Step 0 gate (NAP/entity); run before 2b on local sites |
| **`schema-markup-generator`** | Orchestrator — Step 2b calls knowsabout when CSVs missing |

## Quick decision flow

```text
Step 2 identified service/location page(s)?
  → no → skip Step 2b → Step 3
  → yes → build slug checklist
      → for each slug: glob 02-deliverables/2.4-schema/knowsabout/{slug}-knowsabout.csv (+ legacy paths)
          → all present + complete → Step 3
          → any missing/incomplete → READ knowsabout-entity-research SKILL.md → run to completion
              → re-glob all slugs → Step 3
```

## Related gates

- **Step 0** — [dossier-preflight.md](dossier-preflight.md)
- **Step 0b** — [sameas-intake.md](sameas-intake.md)
- **Step 2b** — this file (entity CSV / knowsabout)
- **Paths** — [schema-artifact-layout.md](schema-artifact-layout.md)
