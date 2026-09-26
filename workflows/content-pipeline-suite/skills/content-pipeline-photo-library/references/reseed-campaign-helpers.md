# Reseed campaign image helpers (v1.8.0)

After v1.8.0, writers consume `{pipeline_dir}/scripts/` instead of `{skill_root}` / `{ops_skill_root}`. Campaigns that already finished photo-library HITL were **not** seeded automatically. **Do not re-ingest, re-classify, or re-HITL.** Copy helpers + retarget that campaign’s `3.5-images/CONTEXT.md`.

## What changed

| Area | Before | After (v1.8.0) |
|------|--------|----------------|
| Writer matcher | Skill-folder `content-pipeline-photo-library/scripts/match-library.mjs` | `{pipeline_dir}/scripts/match-library.mjs` |
| Writer Fal | Skill-folder `content-pipeline-run/scripts/fal-generate.mjs` | `{pipeline_dir}/scripts/fal-generate.mjs` |
| Seed | Classifier template only | Ingest, HITL, and `seed-helpers.mjs` also refresh `{pipeline_dir}/scripts/` |
| Already-HITL campaigns | No `{pipeline}/scripts/` | Run this reseed once |

Host project/user skills still load when the workspace root contains this skill. Campaign copies exist so a writer following stage CONTEXT (or a nested-folder workspace) does not report “helpers not installed.”

Approved photos stay in `01-resources/image-library/`. That is the live library, not `04-publish/image-library/` unless the legacy folder is the only existing library.

## Do / do not

| Do | Do not |
|----|--------|
| Run `seed-helpers.mjs` per campaign | Re-run ingest / classify / Gemini |
| Retarget that campaign’s `3.5-images/CONTEXT.md` | Self-approve or retag photos |
| Run `check-helpers.mjs` and confirm `approved_count` | Use Cursor GenerateImage |
| Update the run-manifest only if `next_action` is `restore_image_generator…` | Publish or rewrite polish/draft |
| Write planning under `{campaign}/04-archives/planning/` when that tree exists | Invent a new library path |

`fal-generate.mjs` copies only when `content-pipeline-run` is installed next to this skill (`../content-pipeline-run/scripts/fal-generate.mjs`). Install that companion first, then reseed, if writers need Fal fallback.

## Per-campaign steps

Node 20+. Pin `campaign_dir`.

```text
node "{skill}/scripts/seed-helpers.mjs" --campaign-dir "{campaign_dir}"
node "{campaign_dir}/06-content-pipeline/scripts/check-helpers.mjs"
```

`seed-helpers.mjs` overwrites skill-owned copies only (`match-library.mjs`, `fal-generate.mjs` when present, `check-helpers.mjs`, `lib/`, `README.md`). It does **not** touch `image-library/classify.mjs` or `approved/`.

Then edit **this campaign’s** `06-content-pipeline/03-write/3.5-images/CONTEXT.md`:

1. Matcher path → `{pipeline_dir}/scripts/match-library.mjs`
2. Fal command → `{pipeline_dir}/scripts/fal-generate.mjs`
3. Note: missing host skills folder is not a hard-stop; live library is `01-resources/image-library/`
4. Optional: same pointer on pipeline `CONTEXT.md`, `03-write/CONTEXT.md`, `AGENTS.md`

If `content-pipeline-run-manifest.json` `next_action` is `restore_image_generator_and_rerun:…`, set it to `rerun:images_post_NN` and note that helpers were seeded. Do not mark images complete unless PNGs already exist.

`check-helpers.mjs` must print helper paths and `approved_count`. `ok: true` requires `fal-generate.mjs` as well; if that file is missing, install `content-pipeline-run` beside this skill and reseed.

## Starting prompt (paste into a new chat)

```text
Pin the campaign I name.

Task: reseed campaign-local 3.5-images helpers for a campaign that already finished content-pipeline-photo-library HITL. This is content-pipeline-photo-library v1.8.0. Read the skill file references/reseed-campaign-helpers.md and follow it.

Do NOT re-ingest, classify, or HITL. Do NOT publish. Do NOT use Cursor GenerateImage. Do NOT regenerate post images unless I ask.

For this campaign:
1. Confirm campaign_dir and that 01-resources/image-library/library-manifest.json exists with approved rows.
2. Run seed-helpers.mjs from the installed photo-library skill with --campaign-dir (absolute).
3. Run {pipeline}/scripts/check-helpers.mjs. Report approved_count and helper paths.
4. Retarget 06-content-pipeline/03-write/3.5-images/CONTEXT.md to {pipeline_dir}/scripts/match-library.mjs and fal-generate.mjs. Add a short pointer on pipeline CONTEXT.md, 03-write/CONTEXT.md, and AGENTS.md if those files exist.
5. If the run-manifest next_action is restore_image_generator_and_rerun, change it to rerun:images for the blocked slot and add a note. Leave images incomplete unless PNGs already exist.
6. Planning trio only under {campaign}/04-archives/planning/ when that tree exists.

First campaign: {PASTE campaign_dir HERE}

When this one is done, stop and wait. I will name the next campaign.
```
