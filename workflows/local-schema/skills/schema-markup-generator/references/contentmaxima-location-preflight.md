# ContentMaxima location preflight (Step 2c)

Run **after Step 2** (page role) and **before Step 2b** (entity CSV / knowsabout) whenever this run includes one or more **dedicated location / city pages**.

This is a **soft stop**: pause and offer to run ContentMaxima Matrix, accept a pasted matrix path, or accept **skip matrix**. Do **not** auto-run ContentMaxima. “Proceed” / “generate schema” / “dossier is ready” do **not** skip the ask.

Mirrors Step 0b (ask and wait) — not Step 2b (auto-invoke when files are missing).

## When Step 2c applies

| Scenario | Step 2c |
|----------|---------|
| **Location / city page** in scope (Simple or Complex Silo; single-GBP SEO city URL or multi-GBP city landing) | **Required ask** unless a matrix is already on disk for that city |
| Homepage only (no dedicated location URLs) | **Skip** |
| Service pages only | **Skip** |
| FAQ, Article, Product, non-local content | **Skip** |
| User already said **skip matrix** in this session for these slugs | **Skip** (do not re-ask) |
| User said **refresh matrix** / **re-run matrix** | Re-run even if a matrix exists |

## Resolve cities

From Step 2 location slugs, build `{City}, {State}` for each dedicated location page (dossier `[III]`, H1, or slug: `knoxville-tn` → `Knoxville, Tennessee`). One ContentMaxima Matrix per city.

## Check for an existing matrix (glob / skip ask)

Use `Glob` or `ctx_execute` — do not assume files exist.

**Canonical:**

```
{project_dir}/02-deliverables/2.4-schema/contentmaxima/*{city-slug}*matrix.xlsx
{project_dir}/02-deliverables/2.4-schema/contentmaxima/*{city-slug}*algorithm_trigger_words.csv
{project_dir}/02-deliverables/2.4-schema/knowsabout/{slug}-geo-triggers.csv
```

Also accept a user-pasted absolute path to any `*_matrix.xlsx` or `*_algorithm_trigger_words.csv`.

| Condition | Action |
|-----------|--------|
| Matrix or `{slug}-geo-triggers.csv` **exists** and user did **not** ask refresh | **Do not re-ask** — extract (if needed) and continue to Step 2b |
| Missing | **Stop** — use the mandatory prompt below |
| User asked **refresh matrix** | Re-run ContentMaxima for that city |

## Ask once (mandatory prompt)

Use this wording (do not paraphrase). List every in-scope city:

> Location pages in scope: `{City, State}`, … I can run **contentmaxima** Matrix for each city to pull Algorithm Trigger Words with **Count ≥ 40** as high-impact geographic entities for location `WebPage.about`.
>
> Reply **run matrix**, paste an existing `*_matrix.xlsx` (or algorithm-trigger CSV) path, or say **skip matrix**.

**Qualifying answers only:**

- **run matrix**
- A file path (`.xlsx` or algorithm-trigger `.csv`)
- **skip matrix**

If 2c was asked earlier in this session and never answered with one of those three, **ask again and stop**.

## If the user says **run matrix**

1. **Read and follow** `contentmaxima/SKILL.md (if installed)` (Matrix workflow) for this session.
2. Keyword is `"{City}, {State}"` — one run per dedicated location page.
3. Windows: from the ContentMaxima skill root, `npx --yes tsx Tools/Matrix.ts "{City}, {State}" --output "{project_dir}/02-deliverables/2.4-schema/contentmaxima"`.
4. Unix: `bun Tools/Matrix.ts` with the same keyword and `--output`.
5. If Playwright / login is blocked, follow ContentMaxima’s degraded-path ask. Use reverse-engineered `*_algorithm_trigger_words.csv` **only after** the user accepts that path.
6. After the file lands, run `scripts/extract-geo-triggers.mjs` (see below).

**Forbidden:** auto-running Matrix because a location page is in scope; inventing algorithm trigger words; substituting a manual SEO list unless the user accepted a degraded path.

## If the user pastes a path

Run the extractor on that file. Copy or leave the source in `contentmaxima/` when it is not already there. Then continue to Step 2b.

## If the user says **skip matrix**

Continue to Step 2b **without** geo-trigger seeds. Do not invent POI rows. Note the skip in `locations-implementation.md`.

## Extractor

```text
node "{skill}/scripts/extract-geo-triggers.mjs" --input "{matrix.xlsx|triggers.csv}" --slug "{slug}" --out "{project_dir}/02-deliverables/2.4-schema/knowsabout"
```

- Official XLSX: sheet name matches `/algorithm\s*trigger\s*words/i`; term = column A; Count = the Count / frequency header; keep **Count ≥ 40**.
- Reverse-engineered CSV: `Term,Count` (or first two columns); same threshold.
- Writes `{project_dir}/02-deliverables/2.4-schema/knowsabout/{slug}-geo-triggers.csv` with headers `term,count`.
- Default threshold is **40**. Override only if the user sets a different floor.

Knoxville fixture (Count ≥ 40): University of Tennessee, Knoxville Zoo, Market Square, Knoxville Museum of Art, Ijams Nature Center, Knoxville Symphony Orchestra, World's Fair Park, Knoxville Convention Center, Knoxville Opera, Neyland Stadium, Tennessee River, Tennessee Theatre, East Tennessee History Center, Knoxville Ice Bears, Knoxville Civic Auditorium and Coliseum, McGhee Tyson Airport.

## Placement (locked)

High-impact terms are **local landmarks / POIs**, not service areas.

| Term kind | Schema home | Not |
|-----------|-------------|-----|
| Stadium, zoo, museum, park, theater, airport, university, river, venue | Location `WebPage.about` as `Place` (or a more specific type after URL resolution: `TouristAttraction`, `CivicStructure`, `Airport`, …) | `areaServed` |
| City, district, or neighborhood the contractor **actually serves** | `areaServed` on homepage `LocalBusiness` / `Service` per [areaserved-types.md](areaserved-types.md) | Do not also dump the same POI list into `areaServed` |

`areaServed` stays on the homepage / Service nodes. Location pages keep geography in `WebPage.about` (LocalBusiness `@id` + target `City` + Thing/Place entities).

**Visible copy:** list the ≥40 terms in `locations-implementation.md` as on-page mentions so schema matches visible content.

**JSON-LD `description`:** never write “ContentMaxima”, “Count ≥ 40”, or trigger counts into `Thing` / `Place` / `WebPage` descriptions. Counts and tool names stay in the implementation table only — see [client-facing-copy.md](client-facing-copy.md).

## Hand off to Step 2b

After extract (or skip):

1. Pass `{slug}-geo-triggers.csv` **term** values as **extra location seeds** to **knowsabout-entity-research** (see [entity-csv-preflight.md](entity-csv-preflight.md)).
2. If `{slug}-knowsabout.csv` already exists, **merge** new geo names and resolve **only the new names** — do not regenerate the whole CSV.
3. Do not invent Wikipedia / Wikidata / Grokipedia URLs for trigger terms. They go through `resolve-entity-urls.mjs` like every other `WebPage.about` entity.

## Related

- [entity-csv-preflight.md](entity-csv-preflight.md) — Step 2b
- [areaserved-types.md](areaserved-types.md) — POIs are not `areaServed`
- [silo-and-page-patterns.md](silo-and-page-patterns.md) — location `WebPage.about`
- [schema-artifact-layout.md](schema-artifact-layout.md) — `contentmaxima/` + `*-geo-triggers.csv`
- Ops ContentMaxima skill: `contentmaxima/SKILL.md (if installed)`
