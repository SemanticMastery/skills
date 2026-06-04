# Reference: Entity research & URL patterns

## Slug from seed term

| Seed | Slug | Output file |
|------|------|-------------|
| Leander Texas | `leander-texas` | `leander-texas-knowsabout.csv` |
| deep root fertilization service | `deep-root-fertilization` | `deep-root-fertilization-knowsabout.csv` |
| arborist services | `arborist-services` | `arborist-services-knowsabout.csv` |

Rules: lowercase, drop filler words (`service`, `company`) only when redundant with slug convention, hyphens not underscores, no trailing `-knowsabout` in slug (suffix is on filename).

## Grokipedia URL patterns (required — verify every row)

**Mandatory:** Each entity row must have a verified Grokipedia URL or documented failed attempts in **Notes**. Agents must not skip the column for speed, API friction, or "Wikipedia is enough."

Base: `https://grokipedia.com/page/{slug}`

| Entity type | Typical slug pattern | Example |
|-------------|---------------------|---------|
| US city | `{City}_{State}` | `Leander,_Texas` → often `leander_texas` or page-specific; **fetch to confirm** |
| County | `{Name}_County,_State` | `Grant_County,_West_Virginia`, `Williamson_County,_Texas` |
| Profession / field | **Title Case** first | `Arboriculture` (200), `arboriculture` (often 404) |
| Multi-word | Underscores from Wikipedia title | `International_Society_of_Arboriculture` |
| Station / POI | snake_case variant | `leander_station` |

**Resolution order per entity:**

1. Try Title Case entity name.
2. Try Wikipedia article title with underscores.
3. Try lowercase / snake_case variants.
4. Only then write `-` and log tried URLs in **Notes**.

Use [scripts/resolve-entity-urls.mjs](scripts/resolve-entity-urls.mjs) (up to 4 candidates, paced HEAD requests). If Grokipedia returns 404 for all candidates, mark `-` — never invent slugs from memory.

## API pacing (Wikipedia & Wikidata)

Wikipedia and Wikidata rate-limit burst traffic. **Always resolve entities sequentially** with delays.

| Setting | Default | Env override |
|---------|---------|--------------|
| Delay after each Wikipedia/Wikidata API call | **500 ms** | `WIKI_DELAY_MS` |
| Delay after each Grokipedia HEAD | **350 ms** | `GROK_DELAY_MS` |
| 429 retry backoff | 2s → 5s → 10s (or `Retry-After`) | — |
| Max parallel Wikipedia API calls | **1** (no batch curl for 10+ entities) | — |
| User-Agent | `SemanticLinks-KnowsAboutResearch/1.0 (...)` | required on all requests |

**Do:**

- Run `node .../scripts/resolve-entity-urls.mjs --names "A,B,C"` for the full entity list.
- Or `ctx_execute` a loop with `await sleep(500)` between wiki/wikidata fetches.

**Do not:**

- Fire 10+ Wikipedia REST calls in one `ctx_batch_execute` without delays.
- Pre-fill Q-IDs or Grokipedia URLs from training data without HTTP verification.
- Proceed to schema JSON-LD when Grokipedia column is all `-` (unless user explicitly waived).

## Wikipedia & Wikidata

1. Resolve English Wikipedia article for entity name — **prefer `resolve-entity-urls.mjs`** (opensearch + exact-title fallback + override table for tree-care terms).
2. On Wikipedia page, use Wikidata item link from `pageprops.wikibase_item` for `https://www.wikidata.org/wiki/Q{id}`.
3. Prefer stable Q-IDs for JSON-LD `@id`; use Wikipedia URL as `@id` only when no Wikidata item exists.

**Do not trust opensearch alone** for multi-word or place-name queries; see global [field-learnings.md](field-learnings.md) and project `resources/schema/field-learnings.md`.

## Field learnings (production)

→ [field-learnings.md](field-learnings.md) (global) + `{project}/resources/schema/field-learnings.md` (client) — opensearch fixes, Grokipedia patterns, `--stdin`, `--overrides`, CSV merge.

## Location entity checklist (pick what fits the city)

- City (primary)
- County / counties
- Metro or CSA
- State (if not only inside `City.containedInPlace` in JSON-LD)
- Rail/transit, major roads, airports (if notable)
- School district, flagship schools
- Parks, lakes, historic sites
- Regional history or archaeology (if locally notable)
- Growth / suburb context (with real Wikipedia article)

## Service entity checklist

- Named service or core technique
- Arboriculture / trade
- Arborist / ISA
- Tools, methods (felling, limbing, grinding, injection, etc.)
- Conditions treated (disease, compaction, wilt)
- Soil/plant science (rhizosphere, mycorrhiza, nutrition)
- Safety, regulation, standards (ANSI, OSHA when relevant)
- Related equipment or materials

## CSV column guidance

| Column | Content |
|--------|---------|
| Entity Name | Canonical short name |
| Relevance to … | One sentence: why this entity belongs on **this** page |
| Wikipedia URL | Full `https://en.wikipedia.org/wiki/...` or `-` |
| Wikidata URL | Full `https://www.wikidata.org/wiki/Q...` or `-` |
| Grokipedia URL | Full `https://grokipedia.com/page/...` or `-` **only after verified attempts** |
| Notes | Pop facts, disambiguation, **Grokipedia slugs tried → status**, ISA refs |

## URL verification (either_best)

1. Build candidate URL from patterns above.
2. `ctx_fetch_and_index` (preferred) or Firecrawl — confirm 200 and title matches entity.
3. If redirect, store final canonical URL in CSV.
4. Never dump raw HTML into chat; only log pass/fail and corrected URL in Notes if needed.

## schema-markup-generator integration

Orchestrated by **Step 2b** — [entity-csv-preflight.md](../schema-markup-generator/references/entity-csv-preflight.md):

1. Schema skill globs `resources/schema/knowsabout/{slug}-knowsabout.csv` (legacy flat paths: read-only) for each service/location slug in scope.
2. If missing **or** Grokipedia column is all `-` (and user did not waive) → schema agent **reads and runs** **knowsabout-entity-research** (this skill) to completion before JSON-LD.
3. Confirm `GrokipediaResolved` ≥ 1 in batch manifest or per-file spot-check before schema Step 4.
4. Schema skill reads CSV → emits `WebPage.about` `Thing` nodes per row; include Grokipedia in `sameAs` when cell is not `-`.
5. Location pages: also include `City` + `mainEntity` / `mentions` / `ItemList` per silo templates in schema-markup-generator `references/schema-templates.md`.

## Artifact paths

Canonical: `resources/schema/knowsabout/{slug}-knowsabout.csv`. See [schema-artifact-layout.md](../schema-markup-generator/references/schema-artifact-layout.md).

**Legacy (read-only):** `resources/schema/{slug}-knowsabout.csv`, then `resources/{slug}-knowsabout.csv`. On refresh, write to `knowsabout/` and update manifest `OutputFile` column.
