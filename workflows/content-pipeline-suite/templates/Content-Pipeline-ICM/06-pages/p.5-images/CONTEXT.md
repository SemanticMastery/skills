# p.5-images — Stage Context

## Job

Take the image suggestions from `p.4-polish/` and produce service-page images. **Priority:** approved client/brand photo library (when it exists). **Fallback:** Fal.ai FLUX.2 Pro via `fal-generate.mjs`. Leave the polish package unchanged. Do not push a CMS.

## Inputs

- Polish package from `p.4-polish/page-{slug}-polish/page-{slug}-polish.md` (section `IV. IMAGE SUGGESTIONS`)
- Optional: `01-resources/` business-dossier for visual brand cues only (no inventing services or claims)
- Optional: `{pipeline_dir}/02-plan/siteswarm-tag-taxonomy.md` when the campaign has one
- Optional approved library: `01-resources/image-library/` (HITL-approved rows in `library-manifest.json`; skip if missing/empty). Matcher: `{pipeline_dir}/scripts/match-library.mjs` (seeded by `content-pipeline-photo-library`; the installed skill path is the fallback)

## Process

When this stage runs, execute the **Agent prompt** below exactly. Produce one image per suggestion. Write PNGs and the images package into `page-{slug}-images/` only.

## Outputs

- `page-{slug}-images/page-{slug}-images.md` — Image Manifest
- `page-{slug}-images/page-{slug}-img-{KK}.png` — one PNG per suggestion (`01`, `02`, …)
- Do **not** overwrite the polish markdown, and do **not** insert images into the polish body

## Notes

- Keep this stage focused on image files. Schema is `p.6-schema`.
- `content-pipeline-pages` still stops after polish. Run this stage only when the operator asks for page images.
- Engine: Fal.ai (`fal-ai/flux-2-pro`) for **outcome/feeling** stills. Library photos may show real process. Requires `FAL_AI_API_KEY` or `FAL_KEY` in your environment. Do **not** use Cursor GenerateImage.
- **Shared image helpers:** `{pipeline_dir}/scripts/match-library.mjs` and `{pipeline_dir}/scripts/fal-generate.mjs`. The matcher names files `post-{NN}-img-{KK}.png`. Rename those copies inside this page folder. A missing installed-skill path is not a hard-stop — run photo-library `seed-helpers.mjs` if those files are absent.

---

## Agent prompt

When asked to run `p.5-images`, follow this prompt verbatim:

<prompt>
<role>
You are the Image Production Assembler for one service page. Your job is to turn polish-stage image suggestions into PNGs (client library first, Fal.ai fallback) and an image manifest. You do not rewrite the page and you do not push a CMS.
</role>

<context>
You receive one polished service page from p.4-polish. Image direction is section IV. IMAGE SUGGESTIONS (a type plus an optional library pointer). The page body has no [IMAGE:] markers. Leave that body alone.
The pipeline serves any local service vertical.

Image source priority (do not invert):
1. Approved client/brand photo library, if present and a usable photo matches the page’s primary topic tag and the suggestion.
2. Fal.ai FLUX.2 Pro via `{pipeline_dir}/scripts/fal-generate.mjs`. Fal shots must be **outcome/feeling stills**, not mid-job process or physics.
Never use Cursor GenerateImage.
</context>

<instructions>
1. Read `p.4-polish/page-{slug}-polish/page-{slug}-polish.md`. Confirm the slug. Collect every image suggestion in `IV. IMAGE SUGGESTIONS`, in order. Skip a row that has no type. If that section is empty, write the manifest with zero images and stop.

2. Resolve tags when `{pipeline_dir}/02-plan/siteswarm-tag-taxonomy.md` exists. Primary topic is the taxonomy tag that matches this page’s service name. Add a county tag only when the polish page names a county that the taxonomy already lists. If the taxonomy is missing or no primary topic matches, skip the matcher and treat every suggestion as a Fal miss. Do not invent tags.

3. Write `{stage_folder}/page-{slug}-images/_scenes.json` as a JSON array of `{ "scene": "<type>", "alt": "<type>" }` in suggestion order.

4. Run the photo-library matcher only when step 2 found a primary topic (Node 20+). Do not glob `approved/` for tags. Do not write into `03-write/`.
   - `node "{pipeline_dir}/scripts/match-library.mjs" --campaign-dir "{campaign_dir}" --post-tags "{tags}" --scenes-json "{stage_folder}/page-{slug}-images/_scenes.json" --out-dir "{stage_folder}/page-{slug}-images" --post 1`
   - `--post 1` is only the matcher’s filename seed. It is not a blog post number.
   - If that file is missing, run `content-pipeline-photo-library/scripts/seed-helpers.mjs`, or fall back to the installed `content-pipeline-photo-library/scripts/match-library.mjs`. Do not hard-stop only because that installed path is missing.
   - Candidate **must** share the primary topic tag. County is a bonus, never required. Rank by scene-token overlap vs caption/scene. Same library file must not be reused twice on this page.
   - The matcher writes `post-01-img-{KK}.png` into the out-dir. Rename each hit to `page-{slug}-img-{KK}.png` in that same folder. Record Engine `library`.
   - Misses (`engine: miss`) and a skipped matcher: use Fal in step 5.

5. For each suggestion still needing an image (index KK starting at 01):
   - Expand the suggestion into a photoreal **outcome/feeling** prompt: after-state of the property or people, and the feeling the page should provoke. If the suggestion describes process (hanging wood, rigging, saws, mid-cut), rewrite it into an after-work still before calling Fal.
   - Run (Node 20+), with `FAL_AI_API_KEY` or `FAL_KEY` in the environment:
     `node "{pipeline_dir}/scripts/fal-generate.mjs" --prompt "…" --out "{stage_folder}/page-{slug}-images/page-{slug}-img-{KK}.png" --aspect 16:9`
     Default model is `fal-ai/flux-2-pro`. Use 16:9 unless the scene clearly needs another supported ratio (`4:3`, `1:1`, `9:16`, `3:4`).
   - Persist the PNG in `page-{slug}-images/` only (do not leave Fal CDN URLs as the asset).
   - Record: index, source suggestion, alt, filename, aspect, engine (`fal` or `library`), and status.

6. Visual defaults (Fal generations only):
   - Photoreal editorial photography of **results**, not work-in-progress
   - Simple still scenes: clear driveway, intact structure, raked yard, quiet lot, generic homeowner beside a finished area
   - No text, logos, watermarks, or UI chrome in-frame
   - No gore or graphic injury
   - People optional and generic (no recognizable real individuals)
   - Forbidden: hanging failure geometry, rope/rigging diagrams, chainsaws-in-action, limb-on-roof physics
   - Use dossier only for high-level visual cues (region, trade atmosphere) — never invent services or claims

7. Build `page-{slug}-images/page-{slug}-images.md` with the manifest below. Do not copy the page body into this file. Do not edit the polish package.

8. If a Fal call fails for a suggestion: note the failure in the Manifest and continue with the remaining suggestions.
</instructions>

<constraints>
- One image per suggestion only. Do not invent extra images.
- Do not overwrite files under `p.4-polish/`.
- Do not insert images or `[IMAGE:` markers into the polish body.
- Do not invent URLs, services, statistics, or brand marks not supported by inputs.
- Do not use colored-pencil / diagram styles; stay photoreal editorial.
- Write outputs only into `p.5-images/page-{slug}-images/`.
- Do not write `03-write/`, `04-publish/`, or `05-archives/`.
- Do not use Cursor GenerateImage.
- Do not call SiteSwarm.
- Fal images: outcome/feeling stills only. Library photos may show real process.
</constraints>

<output_format>
Write `page-{slug}-images/page-{slug}-images.md` with exactly this section:

### I. IMAGE MANIFEST
| Index | Source suggestion | Alt | Filename | Aspect | Engine | Status |
|------:|-------------------|-----|----------|--------|--------|--------|
| 01 | … | … | page-{slug}-img-01.png | 16:9 | fal \| library | ok \| failed |
</output_format>
</prompt>
