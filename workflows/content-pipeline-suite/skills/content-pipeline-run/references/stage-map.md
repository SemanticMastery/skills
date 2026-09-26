# Stage map

Ordered produce stages for `content-pipeline-run` (v1.5). Paths are relative to `{pipeline_dir}` = `{campaign_dir}/06-content-pipeline/`.

`plan` is **init-owned**. This skill consumes `02-plan/editorial-roadmap.md` and `02-plan/siteswarm-tag-taxonomy.md`; it does not create them.

## Stage order

| Order | Stage key | Folder | CONTEXT | Job |
|------:|-----------|--------|---------|-----|
| 0 | `plan` | `02-plan/` | (created by `content-pipeline-init`) | Prerequisite: Editorial Roadmap + SiteSwarm taxonomy already exist |
| 1 | `brief` | `03-write/3.1-brief/` | `03-write/3.1-brief/CONTEXT.md` | Piece brief from one roadmap row |
| 2 | `draft` | `03-write/3.2-draft/` | `03-write/3.2-draft/CONTEXT.md` | First full draft (uses `ai-isms.md`) |
| 3 | `edit` | `03-write/3.3-edit/` | `03-write/3.3-edit/CONTEXT.md` | Structural/editorial pass |
| 4 | `polish` | `03-write/3.4-polish/` | `03-write/3.4-polish/CONTEXT.md` | CMS-ready text package |
| 5 | `images` | `03-write/3.5-images/` | `03-write/3.5-images/CONTEXT.md` | Generate images from polish placeholders |

Parent routers (read for orientation; do not treat as executable stage prompts):

- `{pipeline_dir}/CONTEXT.md` — Layer 1 orchestration habit
- `03-write/CONTEXT.md` — produce routing (one slot at a time)
- `01-resources/CONTEXT.md` — resource inventory rules

**Out of produce:** `04-publish/` posts, `05-archives/`, and creating/rebuilding the roadmap or SiteSwarm taxonomy (`content-pipeline-init`).

## Inputs by stage

### `plan`

Prerequisite only. `content-pipeline-init` already wrote:

- `02-plan/editorial-roadmap.md`
- `02-plan/siteswarm-tag-taxonomy.md` (or a pre-existing `04-publish/` copy)

If either file is missing, hard-stop → run `content-pipeline-init`. Do not execute `02-plan/CONTEXT.md` from this skill.

### `brief`

- Single Editorial Roadmap row for the target post (`02-plan/editorial-roadmap.md`)
- business-dossier, ICP, Matrix, onpage-crawl, product-documentation from `01-resources/`
- Optional: story bank digest (`*story-bank*.md` in `01-resources/`)

### `draft`

- Brief artifact from `3.1-brief`
- `01-resources/ai-isms.md` (required)
- Supporting resources as named in stage CONTEXT
- Optional: story bank digest; use only entries listed on the brief under `Story bank entries used:`

### `edit`

- Draft artifact from `3.2-draft`
- `ai-isms.md` (do not reintroduce banned patterns)

### `polish`

- Edit artifact (Revised Article + Editorial Log) from `3.3-edit`
- `ai-isms.md` final pass
- Business dossier for authorship box when available

**URL Slug convention (Technical Suite):** Keep suggested slugs short and essence-first (~3–5 kebab-case words). Do not append city/location, brand, or service-category tails. Example: `hazardous-tree-over-garage` (not `hazardous-tree-over-garage-leander-emergency-tree-service`). Canonical wording lives in `3.4-polish/CONTEXT.md` Agent prompt (Content-Pipeline-ICM template).

### `images`

- Polish artifact from `3.4-polish/post-{NN}-polish/` (`post-{NN}-polish.md`)
- Optional business-dossier for visual brand cues only
- Engine: approved photo library via `{pipeline_dir}/scripts/match-library.mjs` (seeded by `content-pipeline-photo-library`; primary topic tag required; county bonus; no intra-post reuse; see `3.5-images/CONTEXT.md`) → Fal.ai `fal-ai/flux-2-pro` via `{pipeline_dir}/scripts/fal-generate.mjs` on miss. The library is **built after `content-pipeline-init`** by the setup operator; this stage only consumes `approved/`. Fal images are **outcome/feeling stills**, not mid-job process or physics. Requires `FAL_AI_API_KEY` or `FAL_KEY`. Do not use Cursor GenerateImage. Do not silently overwrite existing `post-01-img-*.png`.

## Outputs by stage

| Stage | Content shape (from CONTEXT `output_format`) | Filename (see artifact-naming) |
|-------|-----------------------------------------------|--------------------------------|
| `plan` (init) | Markdown table only: Week, Post, Cluster, Working Title, Trigger Word, PAA/QFO Linkage, Target Persona, User Intent | `editorial-roadmap.md` (must already exist) |
| `plan` companion (init) | Cluster → condensed SiteSwarm tag allowlist + mapping table | `siteswarm-tag-taxonomy.md` (must already exist) |
| `brief` | Structured Content Brief | `post-{NN}-brief.md` |
| `draft` | Heuristic Summary + Article Draft | `post-{NN}-draft.md` |
| `edit` | Editorial Log + Revised Article | `post-{NN}-edit.md` |
| `polish` | Technical Suite + Final Publication Asset | `post-{NN}-polish/post-{NN}-polish.md` |
| `images` | Image Manifest + Technical Suite + Publication Asset (with images) | `post-{NN}-images/post-{NN}-images.md` + `post-{NN}-img-{KK}.png` |

## Execution rule

For each stage:

1. Read that folder's `CONTEXT.md`.
2. Execute the **Agent prompt** section verbatim.
3. Write only that stage's named artifact into that stage folder.
4. Do not skip ahead of an empty upstream output unless the operator explicitly overrides.
