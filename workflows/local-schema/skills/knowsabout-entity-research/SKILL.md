---
name: knowsabout-entity-research
description: >-
  Researches 10–14 adjacent Schema.org topic entities for a local-business seed
  (service, location, or concept) with Wikipedia, Wikidata, and Grokipedia URLs.
  Writes CSV to resources/schema/knowsabout/ and optional batch manifest. Use when the user
  asks for knowsAbout or about entities, entity tables for schema, Grokipedia
  entity research, or when schema-markup-generator Step 2b finds missing
  *-knowsabout.csv files. Requires verified Grokipedia per row (not bulk-skipped).
disable-model-invocation: true
---

# KnowsAbout / About Entity Research

Produces professional-grade topic-entity tables for **`WebPage.about`** arrays (and optional **`Organization`/`Person` `knowsAbout`**). **Downstream of schema-markup-generator Step 2b** — the schema skill globs for `*-knowsabout.csv` and **must invoke this skill** (read this file + follow) when CSVs are missing, then continues JSON-LD in Step 4.

## Relationship to schema markup

| Page type | Where entities go | Invalid |
|-----------|-------------------|---------|
| Service page | `WebPage.about` → `Thing` objects | `knowsAbout` on `Service` or `WebPage` |
| Location page | `WebPage.about` → `Thing` + `City` + `#localbusiness` `@id` | `hasPart` → `ItemList` |

After CSV is written, use **schema-markup-generator** to build JSON-LD. Map CSV rows to:

```json
{
  "@type": "Thing",
  "@id": "<Wikidata URL if present, else Wikipedia>",
  "name": "<Entity Name>",
  "description": "<Relevance column>",
  "sameAs": ["<each non-empty URL from Wikipedia, Wikidata, Grokipedia>"]
}
```

Omit `-` placeholders from `sameAs`. See [reference.md](reference.md) for slug and URL rules.

## When to run

1. User asks for entity research, knowsAbout/about entities, or a Grokipedia/Wikipedia entity table.
2. **`schema-markup-generator` Step 2b (primary orchestration path):** While generating schema for service/location pages, the schema skill globs `{project_dir}/resources/schema/knowsabout/{slug}-knowsabout.csv` (legacy flat paths: read-only) per [entity-csv-preflight.md](../schema-markup-generator/references/entity-csv-preflight.md) and [schema-artifact-layout.md](../schema-markup-generator/references/schema-artifact-layout.md). When **any** in-scope file is missing or Grokipedia-incomplete, the schema agent **must read this SKILL.md and execute it** before writing JSON-LD — same explicit invocation as Step 0 → `business-dossier` (`disable-model-invocation: true` prevents passive auto-routing).
3. **Grokipedia-only refresh:** CSV exists but every Grokipedia cell is `-` — re-run Grokipedia verification only (keep relevance copy); do not skip because "CSV already exists."

If the CSV already exists with verified Grokipedia URLs and the user did not ask to refresh, **do not** regenerate.

## Inputs

| Input | Required | Notes |
|-------|----------|-------|
| Seed term | Yes (single) or list (batch) | e.g. `Leander Texas`, `deep root fertilization service`, `stump grinding service` |
| Page role | Infer if omitted | `service` vs `location` vs `concept` |
| Entity count | Optional | Default ~12; quality over count (flexible 8–14) |

Confirm ambiguous seeds in one short message before research.

## Project vs global learnings (mandatory)

| Source | Path | Scope |
|--------|------|--------|
| **Global skill** | `references/field-learnings.md` in this skill folder | Arboriculture opensearch, CLI, merge shape, pacing — **all clients** |
| **Project** | `{project_dir}/resources/schema/field-learnings.md` | Slug seeds, local geography, spot-check fixes — **one client** |
| **Project overrides** | `{project_dir}/resources/schema/entity-url-overrides.json` | `wikiTitleOverrides`, `wikiSearchQuery`, `opensearchReject` — loaded via `--overrides` |

At run start: **read project `field-learnings.md` if it exists** (create from [project-field-learnings.template.md](references/project-field-learnings.template.md) on first run). **Never** add client city names to the global `resolve-entity-urls.mjs` script; record fixes in the project files and append to the project run log table.

## URL resolution — mandatory tooling & pacing

**Do not** resolve Wikipedia/Wikidata with parallel burst requests (e.g. 12× `curl` or REST in one `ctx_batch_execute`). That triggers 429 failures and incomplete CSVs.

### Preferred: bundled resolver script

Run from any directory (Node 18+):

```bash
node "{{BUNDLE_ROOT}}/skills/knowsabout-entity-research/scripts/resolve-entity-urls.mjs" --names "Pruning,Arboriculture,Arborist"
```

For entity names that contain commas (e.g. `Grant County, West Virginia`), use `--stdin` with a JSON array or `--file` (one name per line)—not `--names`, which splits on commas.

Or pipe a JSON array of entity names via `--stdin`.

When `{project_dir}/resources/schema/entity-url-overrides.json` exists:

```bash
Get-Content "resources/schema/_tmp/_entity-names-{slug}.json" -Raw | node ".../resolve-entity-urls.mjs" --stdin --overrides "{project_dir}/resources/schema/entity-url-overrides.json"
```

The script:

- Uses a descriptive **User-Agent** (`SemanticLinks-KnowsAboutResearch/1.0`)
- Waits **500 ms** after each Wikipedia/Wikidata API call (`WIKI_DELAY_MS`, overridable)
- Waits **350 ms** after each Grokipedia HEAD probe (`GROK_DELAY_MS`, overridable)
- Retries **429** with backoff (2s → 5s → 10s) or `Retry-After`
- **Per-entity attempt budget** (default **5** shared steps; **3** Grokipedia probes max, only after Wikipedia resolves). Hard mismatches stop early — see global field-learnings § attempt limit.
- Env/cli: `MAX_RESOLUTION_ATTEMPTS`, `MAX_GROK_PROBES`, `--max-attempts`, `--max-grok-probes`

Merge script JSON output into CSV rows. When `resolutionSkipped: true` or `wikiError: attempt_limit`, **swap the entity name** (project field-learnings) rather than re-running the resolver in a loop. Write **Notes** when Grokipedia stays `-` (list slugs tried or `skipped_no_wikipedia`).

### Alternative: `ctx_execute` with same delays

If not using the script, implement **identical pacing** in sandbox code: sequential loop, `await sleep(500)` after each `en.wikipedia.org` / `wikidata.org` call, `await sleep(350)` after each `grokipedia.com` probe, same User-Agent and 429 retry policy. See [reference.md § API pacing](reference.md#api-pacing-wikipedia--wikidata).

**Forbidden:** Filling Wikipedia/Wikidata from memory without API check; marking all Grokipedia `-` to save time; parallelizing entity URL resolution across >2 hosts.

## Research rules

- **Adjacency only** — entities directly related to the seed; no generic filler.
- **Per-entity order (script):** (1) Wikipedia (+ Wikidata via pageprops, with opensearch + exact-title fallbacks) → (2) Grokipedia slug candidates from resolved title → HEAD verify. See global [references/field-learnings.md](references/field-learnings.md) and project `resources/schema/field-learnings.md` for opensearch pitfalls.
- **Locations:** county, metro, transport, schools, parks, history, culture, growth context when relevant.
- **Services:** practices, tools, processes, certifications, biology/soil concepts professionals use.
- **Verify URLs** before writing cells: `ctx_fetch_and_index`, Firecrawl, or `resolve-entity-urls.mjs`; treat 404 as `-` only after exhausting candidates. Do not invent Q-IDs or Grokipedia paths.
- **Research details:** [reference.md](reference.md) (Grokipedia patterns, location vs service checklists).

## Grokipedia — mandatory (not optional)

Grokipedia is a **required** third `sameAs` source, equal to Wikipedia and Wikidata—not a nice-to-have.

| Rule | Requirement |
|------|-------------|
| Attempt | Every CSV row must have Grokipedia resolution attempted before handoff |
| Candidates | Minimum **2** slug patterns per entity (see [reference.md](reference.md)); script tries **4** |
| `-` allowed | Only when all candidates return non-2xx after fetch/HEAD |
| Notes | If `-`, Notes column must record slug attempts (e.g. `grok: Arboriculture, arboriculture → 404`) |
| Bulk skip | **Never** leave entire Grokipedia column `-` without user explicitly saying "skip Grokipedia for this project" |
| Handoff block | Do not emit the required handoff line if Grokipedia was skipped for time/API pressure—finish verification or report blocker |

**schema-markup-generator** must reject incomplete CSVs (all Grokipedia `-`) and route back here.

## Output (every run)

### 1. Markdown table (chat)

Columns (exact):

| Entity Name | Relevance to [Seed Term] | Wikipedia URL | Wikidata URL | Grokipedia URL | Notes |

Use full seed term in the relevance header (e.g. `Relevance to Leander, Texas`).

### 2. CSV file (disk)

- **Directory:** `{project_root}/resources/schema/knowsabout/` — create if missing (see [schema-artifact-layout.md](../schema-markup-generator/references/schema-artifact-layout.md)).
- **Filename:** `{slug}-knowsabout.csv` where `slug` is lowercase, hyphenated from seed (e.g. `leander-texas`, `deep-root-fertilization`, `stump-grinding`).
- **Legacy read:** `{project_root}/resources/schema/{slug}-knowsabout.csv` or `{project_root}/resources/{slug}-knowsabout.csv` — migrate to `knowsabout/` on refresh.
- **Format:** UTF-8 CSV, header row, quoted fields when commas appear; use `-` for missing URLs (match existing Box Tree Care CSVs).

### 3. Batch manifest (batch runs only)

When the user supplies multiple seeds in one task, also write:

`resources/schema/knowsabout-batch-manifest.csv`

Columns: `RunDate`, `SeedTerm`, `Slug`, `OutputFile`, `EntityCount`, `GrokipediaResolved`, `Notes`

`GrokipediaResolved` = count of rows with non-`-` Grokipedia URL.

## Batch workflow

```
1. Read {project_dir}/resources/schema/field-learnings.md (create/update if first run for client).
2. Ensure knowsabout/, _tmp/ exist; copy SCHEMA-LAYOUT.template.md → SCHEMA-LAYOUT.md if missing.
3. Parse seed list (explicit list, location cities from implementation doc / SCHEMA-LAYOUT.md / sitemap / onpage-crawl CSV).
4. Per slug: draft ~12 entity names (reference.md checklists + project field-learnings slug table).
5. Write resources/schema/_tmp/_entity-names-{slug}.json (JSON array — required when names contain commas).
6. node .../resolve-entity-urls.mjs --stdin (+ --overrides entity-url-overrides.json when present) → _tmp/_resolved-{slug}.json
7. Merge into resources/schema/knowsabout/{slug}-knowsabout.csv (preserve Relevance if refreshing). Parser uses **`results`** array — see global field-learnings.md.
8. Spot-check rows; fix per project field-learnings; append project run log.
9. Delete _tmp/_entity-names-* and _tmp/_resolved-* (allowlist §4).
10. Append knowsabout-batch-manifest.csv (OutputFile = knowsabout/{slug}-knowsabout.csv); report Grokipedia hit rate per file.
```

## Quality checklist (all required before handoff)

- [ ] ~12 strong entities (flexible 8–14; no padding)
- [ ] Wikipedia/Wikidata resolved via **paced** API or script (not memory-only)
- [ ] **Every row:** Grokipedia attempted when Wikipedia resolved; Notes explain `-` or `skipped_no_wikipedia`
- [ ] Rows with `resolutionSkipped` / `attempt_limit` reviewed — weak entities swapped out of `_entity-names-*.json`, not endlessly re-probed
- [ ] Grokipedia column is not entirely `-` unless user waived Grokipedia for this project
- [ ] Wikidata preferred for `@id` when Q-item exists
- [ ] Relevance column is specific (usable as `Thing.description`)
- [ ] CSV path reported in chat handoff for schema-markup-generator

## Handoff line (required)

End with:

`Entity CSV: resources/schema/knowsabout/{slug}-knowsabout.csv — ready for schema-markup-generator WebPage.about array. Grokipedia: {resolved}/{total} rows.`

## Examples

**Single:** Seed `oak wilt treatment` → `resources/schema/knowsabout/oak-wilt-treatment-knowsabout.csv`

**Batch:** Seeds for Cedar Park, Round Rock, Georgetown TX → three CSVs under `knowsabout/` + manifest update

**Legacy migration:** Older projects may have flat `resources/schema/{slug}-knowsabout.csv` or `resources/{slug}-knowsabout.csv`. On refresh, write to `knowsabout/` and note migration in chat.

## Scripts

| File | Purpose |
|------|---------|
| [scripts/resolve-entity-urls.mjs](scripts/resolve-entity-urls.mjs) | Paced resolver; global arboriculture overrides; `--overrides` for per-client JSON |
| [references/field-learnings.md](references/field-learnings.md) | Global patterns (client-neutral) |
| [references/project-field-learnings.template.md](references/project-field-learnings.template.md) | Copy to `{project}/resources/schema/field-learnings.md` |
| [references/entity-url-overrides.template.json](references/entity-url-overrides.template.json) | Copy to `{project}/resources/schema/entity-url-overrides.json` when needed |

## Temp file cleanup (pre-approved)

After CSV (and schema JSON-LD, if applicable) is written, delete resolver temps in the project:

- `resources/schema/_tmp/_entity-names-{slug}.json`
- `resources/schema/_tmp/_resolved-{slug}.json`

**Legacy temps** at flat `resources/schema/_entity-names-*` / `_resolved-*` — delete if present from older runs.

Pre-approved per `.cursor/rules/agent-file-allowlist.mdc` §4 — no user prompt required.

## Layout reference

- [schema-artifact-layout.md](../schema-markup-generator/references/schema-artifact-layout.md) — canonical paths and legacy fallbacks
