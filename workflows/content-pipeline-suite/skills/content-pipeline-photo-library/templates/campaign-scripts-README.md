# Campaign image helpers

Skill-owned copies for `3.5-images`. `content-pipeline-photo-library` refreshes this folder on ingest, HITL, and `seed-helpers.mjs`.

| Script | Job |
|--------|-----|
| `match-library.mjs` | Copy HITL-approved brand photos from `01-resources/image-library/approved/` |
| `fal-generate.mjs` | Generate a miss via Fal.ai FLUX.2 Pro (`FAL_AI_API_KEY` or `FAL_KEY`) |
| `check-helpers.mjs` | Print helper paths + approved-photo count |

Live library: `01-resources/image-library/`. Do not look in `04-publish/image-library/` unless that folder is the only existing library.

```text
node "{pipeline}/scripts/check-helpers.mjs"
node "{pipeline}/scripts/match-library.mjs" --campaign-dir "{campaign}" --post-tags "AC Repair" --scenes-json "{stage}/_scenes.json" --out-dir "{stage}" --post 2
node "{pipeline}/scripts/fal-generate.mjs" --prompt "…" --out "{stage}/post-02-img-01.png" --aspect 16:9
```

The installed skill folder is the development source. These campaign copies are the writer contract so `{skill_root}` / `{ops_skill_root}` are not required.
