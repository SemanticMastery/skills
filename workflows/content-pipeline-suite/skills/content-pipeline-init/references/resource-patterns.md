# Resource patterns

Filename matching and copy rules for `content-pipeline-init`.

## Search roots (in order)

Scan under `{campaign_dir}` (recursive), preferring these roots when ranking matches:

1. `01-intake/1.1-docs/`
2. `01-intake/1.2-audit/` (and nested folders such as `contentmaxima/`, `paa-queries/`, `fanout-queries/`)
3. `outputs/` (and nested companion folders)
4. Campaign root (legacy)

Exclude: `node_modules/`, `.git/`, `06-content-pipeline/` (except when verifying the destination pack), `_tmp/`.

A class is **present** when ≥1 matching file exists with size > 0.

## Class table

| ID | Match (basename, case-insensitive) | Typical locations |
|----|------------------------------------|-------------------|
| `matrix` | contains `_matrix` | `01-intake/1.2-audit/contentmaxima/*_matrix*` |
| `personas` | contains `_personas` | `01-intake/1.2-audit/contentmaxima/*_personas*` |
| `paa` | starts with `paa-` | `01-intake/1.2-audit/paa-queries/paa-*` |
| `fanout` | starts with `fanout-queries-` | `01-intake/1.2-audit/fanout-queries/fanout-queries-*` |
| `dossier` | matches `*-dossier*` **or** contains `Dossier` / `dossier` with extension `.md` or `.docx` | `01-intake/1.1-docs/*Dossier*` |
| `onpage` | starts with `onpage-crawl-` **or** starts with `On-page` / `on-page` | `01-intake/1.2-audit/onpage-crawl-*` |
| `icp` | basename includes `icp` (any case) | `01-intake/1.1-docs/*ICP*`, `outputs/customer-research/*` |
| `product_doc` | basename includes `product-documentation` or equals `Product-Documentation.md` | Prefer `01-intake/1.1-docs/Product-Documentation.md`. Legacy read: `outputs/product-documentation/` (do not create) |

### Dossier notes

- Presence may be detected via `.md` or `.docx` under intake.
- **Sync into `01-resources/`:** copy **only** `.md`. Do **not** copy `.docx` (agent resource pack; Word stays in `01-intake/1.1-docs/`).
- Ignore unrelated files that merely contain the word "dossier" in body text — match **basename** only.

### ICP notes

- Ridgeline Tree Care example: `Ridgeline-Tree-Care-ICP-Companion.md`
- Customer-research skill may write under `outputs/customer-research/`; inventory accepts either location if basename includes `icp`, **or** an orchestrator override path listed in the manifest after Wave 3 (subagent must produce a file whose basename includes `icp`).

### Product documentation notes

- Canonical name: `Product-Documentation.md`
- Also accept paths whose basename includes `product-documentation`

## Multi-file classes

| Class | Copy policy |
|-------|-------------|
| `paa` | Copy **all** matching files (json/csv/etc.) |
| `fanout` | Copy **all** matching files (json + csv pairs) |
| `onpage` | Copy all matching crawl exports (csv and xlsx) |
| `matrix` / `personas` | Copy all matches (usually one each) |
| `dossier` | Copy **`.md` only** (never `.docx` into `01-resources/`) |
| `icp` / `product_doc` | Copy all matches; prefer markdown |

## Destination

`{campaign_dir}/06-content-pipeline/01-resources/`

Layout follows the Farmers Insurance reference campaign (class subfolders for multi-file research packs):

| Class | Destination |
|-------|-------------|
| `matrix`, `personas`, `paa`, `fanout`, `dossier`, `onpage` | `{dest}/{class_id}/{basename}` — always a class subfolder (required when a class has **>1** file; use the same subfolder even for a single file) |
| `icp`, `product_doc` | `{dest}/{basename}` — root level (canonical single markdown files) |
| `ai-isms.md`, `CONTEXT.md`, `image-library/` | root (template / library; not one of the eight classes) |

- Preserve original basename inside the class folder.
- **After copy:** `sync-resources.mjs` deletes stale duplicates — root copies when the same basename exists under `{class_id}/`, and nested `icp/` / `product_doc/` copies when the canonical root file exists (legacy flat-layout residue).
- Never overwrite a newer destination file with an older source of the same basename without recording `overwritten: true` in the sync report (default: skip if dest exists and is same size+mtime; otherwise overwrite source of truth from campaign intake and note in report).

## Permanent template file

`ai-isms.md` ships with Content-Pipeline-ICM and must remain in `01-resources/`. It is **not** one of the eight campaign-supplied classes.
