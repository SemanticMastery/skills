# Field learnings — entity URL resolution (global)

Client-neutral patterns for **knowsabout-entity-research**. Use with [reference.md](../reference.md) and [scripts/resolve-entity-urls.mjs](../scripts/resolve-entity-urls.mjs).

**Per-client geography, slug maps, and opensearch fixes** belong in:

`{project_dir}/resources/schema/field-learnings.md`

Optional machine-readable overrides for the resolver:

`{project_dir}/resources/schema/entity-url-overrides.json`

Templates: [project-field-learnings.template.md](project-field-learnings.template.md), [entity-url-overrides.template.json](entity-url-overrides.template.json).

**Workflow:** At run start, read project `field-learnings.md` if it exists. When `entity-url-overrides.json` exists, pass `--overrides` on every resolver invocation. Do **not** add client city names to the global script.

---

## Wikipedia opensearch is unreliable (especially arboriculture)

| Query | Wrong opensearch hit | Mitigation |
|-------|----------------------|------------|
| Hazard tree | Rebecca Naylor Hazard | Global `WIKI_SEARCH_QUERY` + token rejection in script |
| Crown thinning | (no opensearch hit) | `search` list API + exact underscore titles |
| Visual tree assessment | (no opensearch hit) | `search` list API |

**Important:** Some display names have **no dedicated en.wikipedia article** (API `missing`). Do not invent URLs. Either swap to a verified related article (document in project field-learnings + Notes) or leave Wikipedia `-`.

**Global script provides:** arboriculture `wikiTitleOverrides` / `wikiSearchQuery`, generic token checks in `opensearchLooksWrong`.

**Project file provides:** place-name overrides, `opensearchReject` rules, preferred entity names for location slugs.

**Agent rule:** Spot-check resolver output before CSV merge; fix rows using project field-learnings, not new global script edits.

---

## Grokipedia slug patterns that work

| Pattern | Example | HTTP |
|---------|---------|------|
| Title Case profession | `Arboriculture` | 200 |
| lowercase same word | `arboriculture` | 404 |
| Wikipedia underscore title | `International_Society_of_Arboriculture` | 200 |
| County with comma | `Grant_County%2C_West_Virginia` | 200 |

Script builds paths with spaces → `_` and commas → `%2C`.

Niche arboriculture terms often have no Grokipedia page (use `-` + Notes).

---

## CLI: commas in entity names

`--names "Grant County, West Virginia"` splits into two entities. **Always use:**

```bash
echo '["Grant County, West Virginia","Example City, Texas"]' | node .../resolve-entity-urls.mjs --stdin --overrides resources/schema/entity-url-overrides.json
```

Or `--file` with one entity per line.

---

## CSV merge workflow (preserve relevance copy)

1. Read project `field-learnings.md` when present.
2. Keep existing **Relevance** text when refreshing URLs (read old CSV first).
3. Run resolver → `resources/schema/_tmp/_resolved-{slug}.json` (stdin payload in `_tmp/_entity-names-{slug}.json`; `--overrides` when project file exists).
4. Merge: Entity Name, Relevance (old), URLs (script), Notes (`grok tried…`, `wiki via …`) → `resources/schema/knowsabout/{slug}-knowsabout.csv`.
5. Regenerate `services/service-*.jsonld` / `locations/location-*.jsonld` from CSV.
6. Delete `_tmp/_entity-names-*.json` and `_tmp/_resolved-*.json` (legacy flat temps under `resources/schema/` too — allowlist §4).

## CSV merge: resolver JSON shape

Stdout is `{ "results": [ ... ] }`, not a bare array. Merge code must use `parsed.results`. Fields: `name`, `wikipedia`, `wikidata`, `grokipedia`, `grokTried`, `wikiResolvedVia`.

---

## Per-entity attempt limit (resolver script)

Hard-to-verify entities (no Wikipedia article, repeated opensearch mismatches) should **not** burn a long probe chain. The script enforces a **shared budget per entity** (default **5** HTTP resolution steps via `MAX_RESOLUTION_ATTEMPTS` or `--max-attempts`).

| Behavior | Default |
|----------|---------|
| Max steps per entity (override lookup, opensearch, title checks, search hits, grok HEAD) | **5** |
| Max Grokipedia probes | **3** (only if Wikipedia resolved) |
| Max search hits to verify | **2** |
| Grokipedia when Wikipedia is `-` | **Skipped** (`grokError: skipped_no_wikipedia`) |

Output includes `resolutionAttempts: { used, max, phases }` and `resolutionSkipped: true` when Wikipedia is `-`, budget exhausted, or title rejected (e.g. **Fort Mulligan** → no article; weak search hits like a person name are rejected). **Drop or swap** that entity in `_entity-names-*.json` — do not re-run the resolver in a loop. Document swaps in project `field-learnings.md`.

Raise limits only for a deliberate refresh: `--max-attempts 8 --max-grok-probes 4`.

## Rate limits

- Sequential resolver only (~1–2 min for 12 entities with default attempt caps).
- Do not parallelize bulk Wikipedia calls without script pacing.
- On 429: script retries; if still failing, pause 60s and resume.

## Grokipedia hit rate expectations

- **Service pages (tree care):** ~75–90% rows with Grokipedia is normal.
- **Location pages:** Varies widely — states/counties/landmarks often resolve; small CDPs may be Wikipedia + Wikidata only. Document per-client norms in project `field-learnings.md`.
