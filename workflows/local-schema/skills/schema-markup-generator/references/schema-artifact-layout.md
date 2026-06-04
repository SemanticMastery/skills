# Schema artifact layout (canonical paths)

Use this layout for all new client work. Copy to `{project_dir}/resources/schema/SCHEMA-LAYOUT.md` on first schema run (from [SCHEMA-LAYOUT.template.md](SCHEMA-LAYOUT.template.md)).

## Directory map

| Path | Contents |
|------|----------|
| `{project}/resources/schema/` | **Root:** `homepage.jsonld`, `*-implementation.md`, `field-learnings.md`, `entity-url-overrides.json`, `knowsabout-batch-manifest.csv`, `SCHEMA-LAYOUT.md` |
| `{project}/resources/schema/knowsabout/` | `{slug}-knowsabout.csv` — topic entities for `WebPage.about` |
| `{project}/resources/schema/services/` | `service-{slug}.jsonld` |
| `{project}/resources/schema/locations/` | `location-{slug}.jsonld` |
| `{project}/resources/schema/_tmp/` | Ephemeral resolver files — **delete after CSV merge** |

Create subfolders if missing (`knowsabout`, `services`, `locations`, `_tmp`). Add `.gitkeep` in `_tmp` only if the folder would otherwise be empty in git.

## Canonical paths (write here)

| Artifact | Path |
|----------|------|
| Entity CSV | `{project_dir}/resources/schema/knowsabout/{slug}-knowsabout.csv` |
| Service JSON-LD | `{project_dir}/resources/schema/services/service-{slug}.jsonld` |
| Location JSON-LD | `{project_dir}/resources/schema/locations/location-{slug}.jsonld` |
| Homepage JSON-LD | `{project_dir}/resources/schema/homepage.jsonld` |
| Resolver stdin payload | `{project_dir}/resources/schema/_tmp/_entity-names-{slug}.json` |
| Resolver raw output | `{project_dir}/resources/schema/_tmp/_resolved-{slug}.json` |

## Legacy fallbacks (read-only)

When globbing or reading existing projects, check in order:

| Artifact | Legacy path 1 (flat schema root) | Legacy path 2 |
|----------|----------------------------------|---------------|
| Entity CSV | `{project}/resources/schema/{slug}-knowsabout.csv` | `{project}/resources/{slug}-knowsabout.csv` |
| Service JSON-LD | `{project}/resources/schema/service-{slug}.jsonld` | — |
| Location JSON-LD | `{project}/resources/schema/location-{slug}.jsonld` | — |

**Write** always uses canonical subfolders. **Read** may use legacy paths until the user migrates or refreshes that slug.

## Glob patterns (Step 2b / handoff)

```
{project_dir}/resources/schema/knowsabout/*-knowsabout.csv
{project_dir}/resources/schema/knowsabout/{slug}-knowsabout.csv
```

For legacy projects, also glob `{project_dir}/resources/schema/*-knowsabout.csv` and `{project_dir}/resources/*-knowsabout.csv`.

## Manifest `OutputFile` column

Use project-relative paths, e.g. `resources/schema/knowsabout/tree-removal-knowsabout.csv`.

## Related

- [entity-csv-preflight.md](entity-csv-preflight.md) — Step 2b
- `knowsabout-entity-research` SKILL.md — CSV + resolver workflow
