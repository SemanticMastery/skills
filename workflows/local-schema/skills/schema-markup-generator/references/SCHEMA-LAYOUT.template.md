# Schema artifact layout — [Client Name]

Project: `{project_dir}`  
Layout version: **1.0** (subfolders: `knowsabout/`, `services/`, `locations/`, `_tmp/`)

Full rules: `references/schema-artifact-layout.md`

## This project's folders

| Folder | Files |
|--------|--------|
| `knowsabout/` | `*-knowsabout.csv` |
| `services/` | `service-*.jsonld` |
| `locations/` | `location-*.jsonld` |
| `_tmp/` | `_entity-names-*.json`, `_resolved-*.json` (delete after each slug) |
| *(root)* | `homepage.jsonld`, `*-implementation.md`, `field-learnings.md`, `entity-url-overrides.json`, `knowsabout-batch-manifest.csv` |

## Slug inventory

| Role | Slug | CSV | JSON-LD |
|------|------|-----|---------|
| Service | | `knowsabout/{slug}-knowsabout.csv` | `services/service-{slug}.jsonld` |
| Location | | `knowsabout/{slug}-knowsabout.csv` | `locations/location-{slug}.jsonld` |

## Notes

- 
