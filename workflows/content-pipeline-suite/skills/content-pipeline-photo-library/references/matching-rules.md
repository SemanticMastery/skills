# Matching rules (3.5-images)

`3.5-images` is the matcher. Prefer `{pipeline_dir}/scripts/match-library.mjs` (seeded by this skill). It reads `library-manifest.json` rows with `status=approved`. It does not glob `approved/` for tags.

Fal: prefer `{pipeline_dir}/scripts/fal-generate.mjs`. The companion skill copy under `content-pipeline-run/scripts/` is the source that `seed-helpers.mjs` refreshes when that skill is installed next to this one. Misses call that helper. Never Cursor GenerateImage.

## Post tags

Resolve from `02-plan/editorial-roadmap.md` **Cluster** → `{pipeline_dir}/02-plan/siteswarm-tag-taxonomy.md` primary topic (fallback: existing `04-publish/` copy), plus county when the title/city maps. Do **not** use `active_slot.cluster` when it is null.

Example: Cluster `Hazard & Emergency` + Fairview title → `Emergencies, Summit County`.

## Candidate rule (KTD5)

1. Primary topic = first post tag that is not a `* County` geo tag.
2. A candidate **must** share that primary topic tag on `approved_tags`.
3. County is a **bonus**, never required. A county-only approved photo does not satisfy a topic-tagged post.
4. Rank remaining candidates by token overlap of the placeholder **scene** vs photo `caption` + `scene`. County overlap adds a bonus.
5. Each `[IMAGE: scene | alt: …]` placeholder gets at most one file. The same library file is **not** reused twice in one post. Reuse across posts is allowed.
6. No topic-tag candidate → miss → existing Fal path (`engine: fal`).

## Copy

Hits copy to `03-write/3.5-images/post-{NN}-images/post-{NN}-img-{KK}.png` (jpeg/webp → png as-is, no forced 16:9 crop). Publication markdown stays relative to that folder.

Do **not** silently overwrite an existing `post-01-img-*.png`. Library-first applies to a **new** 3.5 slot or an operator-requested rerun.

## Manifests

- `library-manifest.json` — photo-library index; no `engine` field.
- `post-{NN}-images.md` Image Manifest **Engine** column: `library | fal`.
