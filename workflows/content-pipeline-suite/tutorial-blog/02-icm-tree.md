# 02 — The ICM folder tree

`content-pipeline-init` copies the **Content-Pipeline-ICM** template into:

`{campaign}/06-content-pipeline/`

Point init at your unzipped template with `--template`, or set `CONTENT_PIPELINE_ICM_TEMPLATE`. The copy fills **missing** files only. It does not copy `AGENTS.md` or `.cursor/rules/`. It does not overwrite research you already placed under `01-resources/`, and it does not overwrite stage outputs that already exist. It does make sure `01-resources/ai-isms.md` exists.

## Tree

```text
06-content-pipeline/
  CONTEXT.md
  content-pipeline-init-manifest.json
  content-pipeline-run-manifest.json
  01-resources/
    ai-isms.md
    Product-Documentation.md
    image-library/
    dossier files, and subfolders matrix/ personas/ paa/ fanout/ onpage/
  02-plan/
    CONTEXT.md
    editorial-roadmap.md
    siteswarm-tag-taxonomy.md
  03-write/
    CONTEXT.md
    3.1-brief/
    3.2-draft/
    3.3-edit/
    3.4-polish/
    3.5-images/
    3.6-schema/
  04-publish/
  05-archives/
  06-pages/
  07-claims-audit/
```

Manifests appear when those skills run. Research subfolders appear when sync copies files in.

## What each blog folder is for

| Folder | Job in this course |
|---|---|
| `01-resources/` | The pack produce reads. Sources stay in `01-intake/`. This folder holds copies. |
| `01-resources/ai-isms.md` | Banned language for draft, edit, and polish. Ships with the template. |
| `01-resources/image-library/` | Photo library home. Taxonomy must exist before classify. |
| `02-plan/` | Editorial roadmap and SiteSwarm tags. Init writes both. Run only reads them. |
| `03-write/3.1-brief` through `3.4-polish` | One slot's copy. Each stage has its own `CONTEXT.md`. The agent follows that prompt. |
| `03-write/3.5-images` | Approved photos first. Fal when the library misses. |
| `03-write/3.6-schema` | Blog JSON-LD after images. Reuses the campaign schema graph when `02-deliverables/2.4-schema/` already exists. Writes `post-{NN}-schema/` and `blog/blogpost-{slug}.jsonld`. The post URL keeps `/blog/{slug}`. `schema-publish-kit` inserts it after the post is live. |
| `04-publish/` | Publish-ready holding area. Run does not write it. |
| `05-archives/` | Cold storage. Run does not write it. |

`06-pages/` is the service-page tree. `07-claims-audit/` is the claims ledger tree. Both copy in with the template. Procedures for those folders are later courses.

## Where the eight classes land

| Class | In `01-resources/` |
|---|---|
| `dossier` | The `.md` dossier only. The Word file stays in intake. |
| `onpage` | Matching `.csv` and `.xlsx` |
| `matrix` | `matrix/` |
| `personas` | `personas/` |
| `paa` | `paa/` |
| `fanout` | `fanout/` |
| `product_doc` | `Product-Documentation.md` at the resources root. A mirror. The canonical file stays in `01-intake/1.1-docs/`. |
| `icp` | An ICP markdown at the resources root |

Optional extras in the same resources folder: a Voice DNA file, and `{Company}-story-bank.md` when an expert series exists.

## Stage habit

One stage folder at a time. Read that folder's `CONTEXT.md`. Write only where that prompt says to write. Do not skip an empty upstream artifact unless you explicitly override.

Campaign planning notes (`task_plan.md` and the rest) go in `{campaign}/04-archives/planning/`.
