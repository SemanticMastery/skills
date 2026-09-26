# Schema artifact layout (canonical paths)

Use this layout for all new campaign work. Copy to `{project_dir}/02-deliverables/2.4-schema/SCHEMA-LAYOUT.md` on first schema run (from [SCHEMA-LAYOUT.template.md](SCHEMA-LAYOUT.template.md)).

**`project_dir`** = campaign folder root (e.g. `Blue-Wash-Cleaning/`).

**Intake prerequisites (Ops / Golden Image ICM):** always resolve local-business inputs from `{project_dir}/01-intake/1.1-docs/` first (`*Dossier.md`, optional EntityMap / Product-Documentation). See [dossier-preflight.md](dossier-preflight.md). Schema **outputs** still write under `02-deliverables/2.4-schema/` below.

## Directory map

| Path | Contents |
|------|----------|
| `{project}/02-deliverables/2.4-schema/` | **Root:** `homepage.jsonld`, `aboutpage.jsonld`, `contactpage.jsonld`, `homepage-implementation.md`, `aboutpage-implementation.md`, `contactpage-implementation.md`, `services-implementation.md`, `locations-implementation.md`, `field-learnings.md`, `entity-url-overrides.json`, `knowsabout-batch-manifest.csv`, `SCHEMA-LAYOUT.md` |
| `{project}/02-deliverables/2.4-schema/knowsabout/` | `{slug}-knowsabout.csv` — topic entities for `WebPage.about`; `{slug}-geo-triggers.csv` — ContentMaxima Count ≥ 40 terms (location pages, Step 2c) |
| `{project}/02-deliverables/2.4-schema/contentmaxima/` | Official `*_matrix.xlsx` or reverse-engineered `*_algorithm_trigger_words.csv` per city |
| `{project}/02-deliverables/2.4-schema/services/` | `service-{slug}.jsonld` |
| `{project}/02-deliverables/2.4-schema/locations/` | `location-{slug}.jsonld` |
| `{project}/02-deliverables/2.4-schema/_tmp/` | Ephemeral resolver files — **delete after CSV merge** |

Create subfolders if missing (`knowsabout`, `contentmaxima`, `services`, `locations`, `_tmp`). Add `.gitkeep` in `_tmp` only if the folder would otherwise be empty in git.

## File format (`*.jsonld`)

All client deliverables must be **CMS copy-paste ready**: wrap JSON-LD in `<script type="application/ld+json">` … `</script>`. See [jsonld-script-wrapper.md](jsonld-script-wrapper.md). Bare JSON in `.jsonld` files is invalid for new writes unless the user requests raw JSON.

## Canonical paths (write here)

| Artifact | Path |
|----------|------|
| Entity CSV | `{project_dir}/02-deliverables/2.4-schema/knowsabout/{slug}-knowsabout.csv` |
| Geo-trigger CSV | `{project_dir}/02-deliverables/2.4-schema/knowsabout/{slug}-geo-triggers.csv` |
| ContentMaxima matrix | `{project_dir}/02-deliverables/2.4-schema/contentmaxima/*_matrix.xlsx` (or `*_algorithm_trigger_words.csv`) |
| Service JSON-LD | `{project_dir}/02-deliverables/2.4-schema/services/service-{slug}.jsonld` |
| Location JSON-LD | `{project_dir}/02-deliverables/2.4-schema/locations/location-{slug}.jsonld` |
| Homepage JSON-LD | `{project_dir}/02-deliverables/2.4-schema/homepage.jsonld` |
| Homepage implementation | `{project_dir}/02-deliverables/2.4-schema/homepage-implementation.md` |
| About page JSON-LD | `{project_dir}/02-deliverables/2.4-schema/aboutpage.jsonld` |
| About page implementation | `{project_dir}/02-deliverables/2.4-schema/aboutpage-implementation.md` |
| Contact page JSON-LD | `{project_dir}/02-deliverables/2.4-schema/contactpage.jsonld` |
| Contact page implementation | `{project_dir}/02-deliverables/2.4-schema/contactpage-implementation.md` |
| Services batch handoff | `{project_dir}/02-deliverables/2.4-schema/services-implementation.md` |
| Locations batch handoff | `{project_dir}/02-deliverables/2.4-schema/locations-implementation.md` |
| Resolver stdin payload | `{project_dir}/02-deliverables/2.4-schema/_tmp/_entity-names-{slug}.json` |
| Resolver raw output | `{project_dir}/02-deliverables/2.4-schema/_tmp/_resolved-{slug}.json` |

## Legacy fallbacks (read-only)

When globbing or reading existing projects, check in order:

| Artifact | Legacy path 1 (`resources/schema/`) | Legacy path 2 |
|----------|-------------------------------------|---------------|
| Entity CSV | `{project}/resources/schema/knowsabout/{slug}-knowsabout.csv` | `{project}/resources/schema/{slug}-knowsabout.csv` then `{project}/resources/{slug}-knowsabout.csv` |
| Service JSON-LD | `{project}/resources/schema/services/service-{slug}.jsonld` | `{project}/resources/schema/service-{slug}.jsonld` |
| Location JSON-LD | `{project}/resources/schema/locations/location-{slug}.jsonld` | `{project}/resources/schema/location-{slug}.jsonld` |
| Homepage / handoffs | `{project}/resources/schema/homepage.jsonld`, `field-learnings.md`, etc. | — |
| About page JSON-LD | `{project}/02-deliverables/2.4-schema/about-*.jsonld` or `{project}/resources/schema/about-*.jsonld` | — |
| Contact page JSON-LD | `{project}/02-deliverables/2.4-schema/contact-*.jsonld` or `{project}/resources/schema/contact-*.jsonld` | — |
| About implementation | `{project}/02-deliverables/2.4-schema/about-*-implementation.md` | — |
| Contact implementation | `{project}/02-deliverables/2.4-schema/contact-*-implementation.md` | — |

**Write** always uses `02-deliverables/2.4-schema/`. **Read** may use legacy `resources/schema/` paths until the user migrates or refreshes that slug.

## Glob patterns (Step 2b / handoff)

**Canonical:**

```
{project_dir}/02-deliverables/2.4-schema/knowsabout/*-knowsabout.csv
{project_dir}/02-deliverables/2.4-schema/knowsabout/{slug}-knowsabout.csv
{project_dir}/02-deliverables/2.4-schema/knowsabout/{slug}-geo-triggers.csv
{project_dir}/02-deliverables/2.4-schema/contentmaxima/*matrix.xlsx
{project_dir}/02-deliverables/2.4-schema/contentmaxima/*algorithm_trigger_words.csv
```

**Legacy (if migrating old projects):**

```
{project_dir}/resources/schema/knowsabout/{slug}-knowsabout.csv
{project_dir}/resources/schema/knowsabout/*-knowsabout.csv
{project_dir}/resources/schema/{slug}-knowsabout.csv
{project_dir}/resources/schema/*-knowsabout.csv
{project_dir}/resources/{slug}-knowsabout.csv
```

## Manifest `OutputFile` column

Use project-relative paths, e.g. `02-deliverables/2.4-schema/knowsabout/tree-removal-knowsabout.csv`.

## Naming convention

- **New files and folders:** hyphenated slugs (e.g. `Blue-Wash-Cleaning-Dossier.md`, `tree-removal-knowsabout.csv`, `service-tree-removal.jsonld`).
- **Fixed page artifacts (not slug-based):** `homepage.jsonld`, `aboutpage.jsonld`, `contactpage.jsonld` and paired handoffs `homepage-implementation.md`, `aboutpage-implementation.md`, `contactpage-implementation.md` — one JSON-LD + one implementation file per page type regardless of URL slug (`/about-us/`, `/contact/`, etc.).
- **Legacy reads:** spaced filenames (e.g. `Example Tree Care Dossier.md`) and slug-prefixed about/contact files (`about-{slug}.jsonld`, `contact-{slug}.jsonld`, `about-{slug}-implementation.md`, `contact-{slug}-implementation.md`) remain valid fallbacks until migrated.

## Related

- [entity-csv-preflight.md](entity-csv-preflight.md) — Step 2b
- [contentmaxima-location-preflight.md](contentmaxima-location-preflight.md) — Step 2c
- [client-facing-copy.md](client-facing-copy.md) — no skill/tooling strings in `*.jsonld` descriptions
- [dossier-preflight.md](dossier-preflight.md) — dossier at `01-intake/1.1-docs/`
- `knowsabout-entity-research` SKILL.md — CSV + resolver workflow
