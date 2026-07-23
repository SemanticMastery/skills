# Schema artifact layout — [Client Name]

Project: `{project_dir}` (campaign folder root)  
Schema root: `02-deliverables/2.4-schema/`  
Layout version: **2.0** (ICM deliverable slot; subfolders: `knowsabout/`, `services/`, `locations/`, `_tmp/`)

Full rules: `C:\Users\bradl\.cursor\skills\schema-markup-generator\references\schema-artifact-layout.md`

## This project's folders

| Folder | Files |
|--------|--------|
| `knowsabout/` | `*-knowsabout.csv` |
| `services/` | `service-*.jsonld` |
| `locations/` | `location-*.jsonld` |
| `_tmp/` | `_entity-names-*.json`, `_resolved-*.json` (delete after each slug) |
| *(root)* | `homepage.jsonld`, `aboutpage.jsonld`, `contactpage.jsonld`, `homepage-implementation.md`, `aboutpage-implementation.md`, `contactpage-implementation.md`, `services-implementation.md`, `locations-implementation.md`, `field-learnings.md`, `entity-url-overrides.json`, `knowsabout-batch-manifest.csv` |

## Slug inventory

| Role | Slug | CSV | JSON-LD |
|------|------|-----|---------|
| Service | | `knowsabout/{slug}-knowsabout.csv` | `services/service-{slug}.jsonld` |
| Location | | `knowsabout/{slug}-knowsabout.csv` | `locations/location-{slug}.jsonld` |

## Notes

- All `*.jsonld` files use the CMS script wrapper — see [jsonld-script-wrapper.md](jsonld-script-wrapper.md).
- About/Contact handoffs use fixed names: `aboutpage-implementation.md`, `contactpage-implementation.md` (paired with `aboutpage.jsonld`, `contactpage.jsonld`).
