# Library contract

Per-campaign photo library used by ingest, classify, HITL, and `3.5-images`.

**Home:** `{pipeline_dir}/01-resources/image-library/`

Legacy path `{pipeline_dir}/04-publish/image-library/` is read-only fallback when that folder already has library files and the canonical home does not. New ingest writes to `01-resources/`.

Do **not** use `01-intake/1.4-photos/` as the approved pool. Do not mix library binaries into `3.5-images/` except copies at consume time.

## Folders

| Folder | Status | Who writes |
|--------|--------|------------|
| `inbox/` | `inbox` | ingest (downloaded bytes) |
| `review/` | `review` | classify (after tagging) |
| `approved/` | `approved` | apply-review (human approve/retag only) |
| `rejected/` | `rejected` | Empty on purpose. Reject / classify-omit **delete** the binary. Manifest row stays. |

Exactly one binary per live item. Approved filenames are `{topic-slug}_{unique-stem}{ext}` (first non-county allowlist tag + platform/media id). Status folders match `status` except purged rejects (`rel_path` empty). `match-library.mjs` reads `library-manifest.json` rows with `status=approved` for tags and paths, then copies the binary from `approved/`. It does **not** glob `approved/` as the tag source.

Missing `image-library/` is an **empty library**, not a crash. `3.5-images` Fal-misses when approved is empty.

## Allowed image types

Ingest writes inbox files only when magic bytes identify a standard image:

| Type | Extension written |
|------|-------------------|
| JPEG | `.jpg` |
| PNG | `.png` |
| WebP | `.webp` |
| GIF | `.gif` |

Do **not** persist `.bin`, HTML, JSON, video, HEIC, or other non-image bytes. Unknown payloads are skipped (`skipped_not_image`), the binary is not written, and the manifest row is `rejected` with `rights_notes: not_image` so refresh does not re-download. Classify omits leftover inbox `.bin` (or other non-image) the same way. Matcher ignores approved rows whose `rel_path` is not an allowed image extension.

## Sidecar files

| File | Role |
|------|------|
| `sources.md` | Operator GBP / Facebook / Instagram (and similar) URLs. Named by this contract; campaign seeding is separate. |
| `classify.mjs` | **Campaign-owned** Gemini prompt (`buildClassifyPrompt`, `CLASSIFIER_READY`). Missing or `CLASSIFIER_READY = false` hard-stops classify. First ingest copies the skill `templates/classify.mjs` once; it never overwrites an existing campaign file. Do not share this file across campaigns. |
| `{pipeline_dir}/scripts/` | **Writer helpers** (`match-library.mjs`, `fal-generate.mjs` when available, `check-helpers.mjs`, `lib/`). Seeded and refreshed by this skill on ingest, HITL, and `seed-helpers.mjs`. Not the classifier. |
| `library-manifest.json` | Source of truth for ids, tags, hashes, status, provenance. |
| `review-queue.md` | Human-readable pending HITL list. Manifest is the checkpoint after `/clear`. |

## `sources.md` shape

```markdown
# Photo library sources

| platform | url | notes |
|----------|-----|-------|
| facebook | https://www.facebook.com/p/Example/ | page-owned posts only |
| instagram | https://www.instagram.com/example | page-authored posts |
| gbp | https://maps.google.com/?cid=… | Photos → By owner only. Not GBP posts. |
```

Missing `sources.md` hard-stops ingest with an operator-facing reason.

## Manifest

```json
{
  "schema_version": 1,
  "skill": "content-pipeline-photo-library",
  "campaign_dir": "/abs/path/to/Campaign",
  "pipeline_dir": "/abs/path/to/Campaign/06-content-pipeline",
  "updated_at": "2026-08-13T15:00:00.000Z",
  "items": []
}
```

### Item fields

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Stable id (`{platform}_{source_media_id}` or hash prefix). |
| `rel_path` | string | Relative to `image-library/`, e.g. `approved/tree-pruning_facebook_122120562308149608.jpg`. Must live under the status folder. Empty when `status=rejected` (binary deleted). |
| `source_url` | string | Page/post URL, not an expiring CDN photo URI as the asset. |
| `source_platform` | string | `instagram` \| `facebook` \| `gbp` \| other. |
| `scraper` | string | Actor/endpoint name (e.g. `instagram-post-scraper`). |
| `photo_category` | string | GBP: `by_owner`. Empty on IG/FB. |
| `downloaded_at` | ISO string | When bytes were persisted. |
| `sha256` | hex | Dedup key. |
| `source_media_id` | string | Platform media/post id. Dedup + rejected skip. |
| `proposed_tags` | string[] | Classifier output, allowlist subset. |
| `approved_tags` | string[] | Set on approve/retag. Matcher uses these. |
| `confidence` | number \| null | Classifier confidence 0–1. |
| `flags` | object | `has_text`, `has_logo`, `likely_ugc`, `has_people`, `off_topic`, `ephemeral_promo` (booleans). Classify omits `off_topic` / `ephemeral_promo` and deletes the binary. |
| `status` | string | `inbox` \| `review` \| `approved` \| `rejected`. |
| `purged_at` | ISO string \| omitted | Set when the rejected binary is deleted. |
| `caption` | string | Source caption/text. |
| `scene` | string | Short scene text for 3.5 ranking. |
| `rights_notes` | string | Page-owned vs skipped UGC notes. |

Tags must be exact strings from `{pipeline_dir}/02-plan/siteswarm-tag-taxonomy.md` (fallback: existing `{pipeline_dir}/04-publish/siteswarm-tag-taxonomy.md`). Invalid tags are dropped or fail validation — never rewritten into near-matches (`Emergency` ≠ `Emergencies`). That allowlist is created by **content-pipeline-init**.

The photo-library index has **no** `engine` field. `engine: library | fal` lives on the `3.5-images` image manifest.

## Dedup

Refresh ingest is additive:

- Same `source_media_id` → skip re-download.
- Same `sha256` → skip re-download (one inbox file).
- `status=rejected` ids stay out of review unless the operator `requeue {id}`.
- Requeue of a purged (no-binary) reject **forgets** the manifest row so the next ingest can refetch. It cannot restore deleted bytes.

## Approved filenames

`{topic-slug}_{unique-stem}{ext}`

| Piece | Rule | Example |
|-------|------|---------|
| topic-slug | First non-county tag in `approved_tags` (`Tree Pruning` → `tree-pruning`) | `tree-pruning` |
| unique-stem | `{platform}_{source_media_id}` unless `source_media_id` already starts with the platform | `facebook_122120562308149608`, `gbp_contrib_AH1DqX-qRzy4Lprf` |

Examples: `tree-pruning_facebook_122120562308149608.jpg`, `tree-care_gbp_contrib_AH1DqX-qRzy4Lprf.jpg`.

`--relabel-approved` renames existing `approved/` files to this contract. `--purge-rejected` deletes leftover files in `rejected/`.

## Isolation

Each campaign has its own `image-library/`. Scripts take `--campaign-dir`. A second campaign directory must not read another campaign's `approved/` files.
