# Artifact naming

CONTEXT prompts define content shape, not filenames. `content-pipeline-run` uses these deterministic paths under `{pipeline_dir}`.

## Plan (init-owned; consume only)

| Artifact | Path |
|----------|------|
| Editorial roadmap | `02-plan/editorial-roadmap.md` |
| SiteSwarm tag taxonomy | `02-plan/siteswarm-tag-taxonomy.md` |

Created by **content-pipeline-init**. This skill does not write either file. Missing → hard-stop back to init. A pre-existing `{pipeline_dir}/04-publish/siteswarm-tag-taxonomy.md` is a valid consume fallback.

## Produce (per slot)

`{NN}` = zero-padded Post number from the roadmap row (minimum 2 digits: `01`, `02`, … `39`, `78`).

**Per-post subdirectory:** when a post has **more than one artifact** in a stage folder, nest them under `{stage}/post-{NN}-{stage}/`. `3.4-polish` and `3.5-images` always nest (they accrue extras). Single-file brief/draft/edit stay flat until a second file appears. `CONTEXT.md` and `_*.json` temps stay at the stage root.

| Stage | Path |
|-------|------|
| brief | `03-write/3.1-brief/post-{NN}-brief.md` (flat while it is the only file) |
| draft | `03-write/3.2-draft/post-{NN}-draft.md` |
| edit | `03-write/3.3-edit/post-{NN}-edit.md` |
| polish | `03-write/3.4-polish/post-{NN}-polish/post-{NN}-polish.md` (+ `.html` / `.docx` in the same folder) |
| images | `03-write/3.5-images/post-{NN}-images/post-{NN}-images.md` |
| images (PNG) | `03-write/3.5-images/post-{NN}-images/post-{NN}-img-{KK}.png` (`01`, `02`, …) |

Examples:

- Post 1 brief (one file) → `3.1-brief/post-01-brief.md`
- Post 1 polish → `3.4-polish/post-01-polish/post-01-polish.md`
- Post 1 images → `3.5-images/post-01-images/post-01-images.md` + `post-01-img-01.png` …

Readers accept the nested path first, then the older flat path. New writes for polish/images go in the subdirectory.

To nest an existing campaign: `node scripts/nest-post-artifacts.mjs --campaign-dir "..." --execute`

## Slot metadata (manifest)

When a slot is selected, record at least:

| Field | Source |
|-------|--------|
| `post` | Roadmap `Post` column (integer) |
| `week` | Roadmap `Week` column |
| `working_title` | Roadmap `Working Title` |
| `trigger_word` | Roadmap `Trigger Word` |
| `cluster` | Roadmap `Cluster` (optional) |
| `target_persona` | Roadmap `Target Persona` (optional) |

## Rewrite policy

- Completing a stage **overwrites** that stage's named file for the active slot.
- Do not delete upstream artifacts when rewriting a later stage.
- Plan rebuild is `content-pipeline-init`, not this skill. Reuse `editorial-roadmap.md` if present.
