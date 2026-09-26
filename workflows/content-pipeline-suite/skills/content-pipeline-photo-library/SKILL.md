---
name: content-pipeline-photo-library
description: >-
  Ingest, classify, and human-approve a per-campaign photo library so
  3.5-images can copy real brand photos before Fal. Requires campaign_dir.
  Public-page scrape of GBP By-owner photos, Facebook, and Instagram
  into 01-resources/image-library. Skips GBP posts, stock, UGC, off-topic,
  and time-limited promo. HITL approve/reject/retag required. Run after
  content-pipeline-init (roadmap + SiteSwarm taxonomy must exist),
  before handing the campaign to writers for content-pipeline-run.
  Does not wire Fal or SiteSwarm publish.
  (v1.8.0)
metadata:
  version: "1.8.0"
---

# Content Pipeline Photo Library (Orchestrator)

Human-triggered orchestration for **one campaign / project folder**. Builds
a reusable tagged photo library under `06-content-pipeline/` after init has
resources, the Editorial Roadmap, and the SiteSwarm tag taxonomy, **before**
writers run produce.

| Rule | Detail |
|------|--------|
| **Campaign pin** | User must specify `campaign_dir` (or pipeline dir) at invoke time. Confirm absolute path before writes. |
| **Init gate** | Require `content-pipeline-init-manifest.json` `status: init_complete` **and** `02-plan/siteswarm-tag-taxonomy.md` (fallback: existing `04-publish/` copy). Missing taxonomy → hard-stop → finish **content-pipeline-init** Steps 6–7. Do not invent tags. |
| **Library home** | `{pipeline_dir}/01-resources/image-library/` — see [library-contract.md](references/library-contract.md) |
| **Image types** | JPEG, PNG, WebP, GIF only (magic bytes). Never ingest `.bin` or other non-image bytes. |
| **Not the DAM** | `01-intake/1.4-photos/` stays order/marketing dumps. Composites with in-frame logos or promo text are not approved. |
| **Campaign classifier** | `{pipeline_dir}/01-resources/image-library/classify.mjs` only. Missing or unedited template → classify hard-stop. Two campaigns must not share a prompt. |
| **Evergreen** | Defined in that campaign `classify.mjs` (`KEEP` / `OFF_TOPIC`). Shared skill scripts have no business prompt. Skip sports, parties, wrecked-car-as-subject, fundraising graphics, donate/Venmo overlays, and other dated campaign text. Classify omits those from `review/` (filter, not approve). |
| **When in the loop** | After `content-pipeline-init` (`init_complete` includes roadmap + taxonomy), **before** writing-team `content-pipeline-run`. First build is the **setup operator**, not writers. |
| **3.5 consume** | Writer matcher is `{pipeline_dir}/scripts/match-library.mjs` (seeded by this skill). Fal fallback is `{pipeline_dir}/scripts/fal-generate.mjs` (copied from a sibling `content-pipeline-run` install when present). Skill-folder paths stay the development source. |
| **No login scrape** | Stop that source on a login wall. Do not ask for Facebook/Instagram passwords. |
| **Planning files** | Prefer `{campaign_dir}/04-archives/planning/` for task/findings/progress when that tree exists. |

Companion (prerequisite): **`content-pipeline-init`** — fills `01-resources/` and writes `02-plan/` roadmap + SiteSwarm taxonomy. This skill will not classify without that allowlist.

Companion (next): **`content-pipeline-run`** — writers **consume** `approved/` at `3.5-images`. Run does not own ingest / classify / HITL.

## Companion skills (install separately)

| Role | Companion skill (Shareable ZIP when available) |
|------|------------------------------------------------|
| Prerequisite | `content-pipeline-init` (roadmap + SiteSwarm taxonomy) |
| Next (writers) | `content-pipeline-run` (consume `approved/` at `3.5-images`) |

Also install the **Content-Pipeline-ICM** template folder (from `content-pipeline-icm.zip`) so stage CONTEXT prompts and the `06-content-pipeline/` tree exist.

## When to use

- **Default:** immediately after `content-pipeline-init` reports `init_complete` (resources + editorial roadmap + SiteSwarm taxonomy), before handing the campaign to the writing team
- Missing taxonomy → hard-stop and tell the operator to finish **content-pipeline-init** Steps 6–7. Do not invent tags.
- Operator says **photo library**, **ingest campaign photos**, **approve library photos**, or **refresh image library**
- Setup operator still owns HITL; do not assign first-library ingest to writers unless the operator says they are ready
- Later refresh of an existing library (same skill). `content-pipeline-run` only **consumes** `approved/` at `3.5-images` — it must not start ingest/HITL just because approved is empty (Fal-miss instead)

## References

1. [references/library-contract.md](references/library-contract.md)
2. [references/scraper-routing.md](references/scraper-routing.md)
3. [references/matching-rules.md](references/matching-rules.md)
4. [references/reseed-campaign-helpers.md](references/reseed-campaign-helpers.md) — one-time backfill for campaigns HITL’d before v1.8.0

## Scripts

Skill root = this folder (next to `SKILL.md`).

| Script | Purpose |
|--------|---------|
| `scripts/gbp-serpapi-owner.mjs` | **GBP first path** — SerpAPI Maps Photos → By owner. Do not start GBP with a generic Maps-image scrape. |
| `scripts/ingest.mjs` | Read `sources.md`, persist inbox JPEG/PNG/WebP/GIF + provenance |
| `scripts/classify.mjs` | **Dispatch only.** Loads the campaign `image-library/classify.mjs` prompt, then runs Gemini. Hard-stops if that file is missing. |
| `{pipeline_dir}/01-resources/image-library/classify.mjs` | **Campaign-owned** `buildClassifyPrompt`. Copy from `templates/classify.mjs` and edit KEEP/OFF_TOPIC. |
| `scripts/apply-review.mjs` | approve / reject / retag / requeue; `--relabel-approved`; `--purge-rejected` |
| `scripts/match-library.mjs` | Pick approved photos for `3.5-images` placeholders |
| `scripts/seed-helpers.mjs` | Copy matcher + Fal helper into `{pipeline_dir}/scripts/` (also runs on ingest / HITL) |
| `scripts/check-helpers.mjs` | Print campaign helper paths + approved-photo count |
| `{pipeline_dir}/scripts/` | **Campaign-owned copies** writers run. Refreshed from this skill. |

Run with **Node.js 20+**. cwd may be anywhere; pass absolute `--campaign-dir`.

```bash
node scripts/gbp-serpapi-owner.mjs --campaign-dir "/abs/path/to/campaign" --q "Brand Name"
node scripts/ingest.mjs --campaign-dir "/abs/path/to/campaign"
node scripts/classify.mjs --campaign-dir "/abs/path/to/campaign"
node scripts/apply-review.mjs --campaign-dir "/abs/path/to/campaign" --approve ig_123
node scripts/apply-review.mjs --campaign-dir "/abs/path/to/campaign" --relabel-approved --purge-rejected
node scripts/seed-helpers.mjs --campaign-dir "/abs/path/to/campaign"
node scripts/match-library.mjs --campaign-dir "/abs/path/to/campaign" --post-tags "Emergencies, Summit County" --scenes-json scenes.json --out-dir "/abs/path/to/3.5-images" --post 2
```

---

## Step 0 — Resolve and confirm

1. Require explicit `campaign_dir` (folder containing `06-content-pipeline/`, or the pipeline folder itself).
2. Confirm absolute path before writes.
3. Verify init is complete enough for classify: SiteSwarm taxonomy exists at `02-plan/siteswarm-tag-taxonomy.md` (fallback: existing `04-publish/` copy). Else hard-stop → **content-pipeline-init** Steps 6–7.
4. Optionally create a planning trio under `04-archives/planning/` for long HITL runs.

## Step 1 — Inputs

1. Confirm `{pipeline_dir}/01-resources/image-library/sources.md` (GBP / Facebook / Instagram). Missing `sources.md` hard-stops ingest.
2. Confirm `{pipeline_dir}/01-resources/image-library/classify.mjs`. Missing or `CLASSIFIER_READY = false` hard-stops classify — copy `templates/classify.mjs`, edit KEEP/OFF_TOPIC for this business, set `CLASSIFIER_READY = true`.
3. Never write a business prompt into the shared skill scripts. Taxonomy SoT is `{pipeline_dir}/02-plan/siteswarm-tag-taxonomy.md`.

## Step 2 — Extract

Follow [scraper-routing.md](references/scraper-routing.md).

1. **GBP is a dedicated path.** Run `scripts/gbp-serpapi-owner.mjs` (SerpAPI `google_maps_photos`, category **By owner**) and ingest that payload. Do not start GBP with a generic Maps listing image scrape (those return chrome / one thumbnail / wrong actors).
2. **Facebook / Instagram:** discover → inspect → run a photos/posts actor (see scraper-routing). If Monid is installed, use discover → inspect → run with the short queries in that reference.
3. Persist JPEG/PNG/WebP/GIF bytes immediately — skip HTML, video, empty, or other non-image payloads (do not write `.bin`).
4. Run ingest:

```bash
node scripts/ingest.mjs --campaign-dir "..." --payloads payloads.json
```

First ingest copies `templates/classify.mjs` into this campaign's `image-library/` if missing — it will not overwrite an edited campaign file. Every ingest also refreshes `{pipeline_dir}/scripts/` (matcher, Fal helper when a sibling `content-pipeline-run` is installed, README) so writers do not need `{skill_root}`.

## Step 3 — Classify

```bash
node scripts/classify.mjs --campaign-dir "..."
```

Needs `GEMINI_API_KEY` (default model `gemini-2.5-flash`, override with `PHOTO_LIBRARY_GEMINI_MODEL`). That command only dispatches; the Gemini prompt is the campaign `image-library/classify.mjs`.

Evergreen candidates move to `review/` + `review-queue.md`. Off-topic, ephemeral-promo, and non-image (`.bin` / failed magic) items are omitted (binary **deleted**, manifest row stays `rejected`) — that is a filter, not HITL. County tags come from caption/city map, not from the model guessing foliage.

## Step 4 — Approve (HITL)

The operator decides. The agent **never self-approves**, including when `content-pipeline-run` was invoked with `gate_mode=auto`.

| Phrase | Script |
|--------|--------|
| approve `{id}` | `node scripts/apply-review.mjs --campaign-dir "..." --approve {id}` |
| reject `{id}` | `... --reject {id}` |
| retag `{id}` as `{allowlist tags}` | `... --retag {id} --tags "Tree Pruning, Summit County"` |
| requeue `{id}` | `... --requeue {id}` |

After `/clear`, pending ids live in `library-manifest.json` (`status=review`) and `review-queue.md`. Rewrite the queue with `--rewrite-queue` if the markdown was lost.

Approve and retag both move `review/` → `approved/`, set `approved_tags` (retag overrides proposed tags), and name the file `{topic-slug}_{unique-stem}{ext}` — e.g. `tree-pruning_facebook_122120562308149608.jpg`, `tree-care_gbp_contrib_AH1DqX-qRzy4Lprf.jpg`. County tags stay on the manifest for matching; they are not the filename prefix.

Reject deletes the binary and keeps the manifest row (`status=rejected`, empty `rel_path`) so ingest does not re-download junk. Classify omits `off_topic` / `ephemeral_promo` / `not_image` the same way — that is a filter, not an approve. Requeue of a purged item **forgets** the hold so the next ingest can refetch; it cannot restore deleted bytes. Classify cannot set `approved`.

`--relabel-approved` backfills existing approved names; `--purge-rejected` deletes leftover `rejected/` files.

## Step 5 — Handoff

After HITL, confirm `{pipeline_dir}/scripts/match-library.mjs` exists (`seed-helpers.mjs` / apply-review already writes it; `fal-generate.mjs` copies when `content-pipeline-run` is installed next to this skill). The writing team runs those **campaign** paths at `3.5-images`. They only consume `approved/` (matcher copies hits to `post-{NN}-img-{KK}.png` with `engine: library`; misses use Fal). Do not silently overwrite `post-01-img-*.png`. Do not tell writers they are blocked because they cannot resolve `{skill_root}` or a host skills folder.

## Out of scope

- Changing Fal (`fal-generate.mjs`, keys, model)
- SiteSwarm `create_post` / draft publish
- Editorial roadmap or SiteSwarm tag taxonomy create/rebuild (that is `content-pipeline-init`)
- Produce stages 3.1-brief → 3.5-images (that is `content-pipeline-run`)
- n8n orchestration
- Auto-approve classification
- A company-wide shared photo pool
