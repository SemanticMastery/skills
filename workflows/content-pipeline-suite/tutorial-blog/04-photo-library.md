# 04 — content-pipeline-photo-library

**Version 1.8.0. After init. Before the writing chat.**

## What it is for

A per-campaign library of real brand photos, tagged with the SiteSwarm allowlist, so stage 3.5 can copy a photo before it ever calls Fal.

Trigger with the campaign path. Init must already have written `02-plan/siteswarm-tag-taxonomy.md`. An existing `04-publish/` copy is only a fallback. Missing both, classify stops. Do not invent tags.

## Four moves

1. **Sources.** `01-resources/image-library/sources.md` lists the Google Business Profile, Facebook, and Instagram to pull. GBP uses the SerpAPI By-owner photo pull (`scripts/gbp-serpapi-owner.mjs`). Facebook and Instagram go through Monid discover, then inspect, then run. JPEG, PNG, WebP, and GIF only.
2. **Ingest.** `node scripts/ingest.mjs --campaign-dir "..." --payloads payloads.json`. The first ingest copies `templates/classify.mjs` into this campaign's `image-library/` when that file is missing. It will not overwrite one you have already edited.
3. **Classify.** Edit that campaign `classify.mjs`: set KEEP and OFF_TOPIC for this business, then `CLASSIFIER_READY = true`. Two campaigns must not share a prompt. Then `node scripts/classify.mjs --campaign-dir "..."`. Needs `GEMINI_API_KEY`. Evergreen candidates land in `review/` and `review-queue.md`. Off-topic, dated promo, and non-images are filtered out. That filter is not an approval.
4. **You approve.** The agent never approves, including when a later run uses `gate_mode auto`.

| You say | What runs |
|---|---|
| approve `{id}` | `apply-review.mjs --approve {id}` |
| reject `{id}` | `--reject {id}` deletes the file and keeps the manifest row so it is not downloaded again |
| retag `{id}` as `{allowlist tags}` | `--retag {id} --tags "..."` |
| requeue `{id}` | `--requeue {id}` |

Approved files are renamed `{topic-slug}_{unique-stem}{ext}` under `approved/`. Example: `tree-pruning_gbp_contrib_AH1DqX.jpg`. County tags stay on the manifest for matching. They are not the filename prefix.

## What the writing team receives

After you approve, these exist under the campaign pipeline, not only inside the skill install:

```text
06-content-pipeline/scripts/match-library.mjs
06-content-pipeline/scripts/fal-generate.mjs
06-content-pipeline/01-resources/image-library/approved/
```

Stage 3.5 uses those campaign scripts. A tag hit is copied onto the post. A miss calls Fal. An empty `approved/` folder is a Fal miss. It is not a failed init, and it is not a reason to start ingest from inside the run.

## Stays out

Fal model and keys, SiteSwarm publish, a company-wide photo pool, and auto-approve. Composites with a logo or promo text in the frame are not approved. Sports, parties, wrecked-vehicle subjects, and dated fundraiser graphics are filtered as not evergreen.
