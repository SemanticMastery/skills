# 08 — Troubleshooting

Blog track only. Find the symptom, then the one fix.

## Init

| Symptom | Cause | Fix |
|---|---|---|
| It will not write anything | No campaign path, or the path is ambiguous | Pass one absolute campaign folder and let it repeat the path |
| It asks for keywords and will not infer them | Matrix, Personas, PAA, or fanout is missing | Supply seeds, and a location if PAA is missing. Resume in the same session |
| It will not compose the dossier or crawl the site | Those calls spend money | Approve the dry-run or the crawl explicitly |
| Status stays `init_partial` | A class has no non-empty file in `01-resources/` | Inventory, place or dispatch that class, sync again |
| Roadmap never starts | One of the eight classes or `ai-isms.md` is still missing | Finish the pack first |
| It did not ask 13 or 26 | A roadmap is already on disk | Say you want a rebuild, or keep the existing table |
| Photo classify refuses to start | No `02-plan/siteswarm-tag-taxonomy.md` | Finish init step 7. Clusters come from the roadmap |
| Template path error on a student install | Default template path is not your machine | `--template` or `CONTENT_PIPELINE_ICM_TEMPLATE` |
| Sync will not overwrite a newer product-doc mirror | Resources copy is newer than `01-intake/1.1-docs/Product-Documentation.md` | Reconcile the two dates. Sync reports both and writes neither |

## Photo library

| Symptom | Cause | Fix |
|---|---|---|
| Classify stops immediately | Campaign `classify.mjs` is still the untouched template | Set KEEP / OFF_TOPIC and `CLASSIFIER_READY = true` |
| GBP pull is junk or a single thumbnail | The wrong photo source ran | Use `gbp-serpapi-owner.mjs` (By owner). Facebook and Instagram stay on Monid |
| `.bin` or HTML landed | Payload was not an image | Ingest keeps JPEG, PNG, WebP, GIF only |
| Nothing in `approved/` | You have not approved, or everything was filtered | Approve from `review-queue.md`. Off-topic is a filter, not a queue you approve |
| Run says the library scripts are missing | Ingest or seed did not refresh `{pipeline}/scripts/` | `seed-helpers.mjs --campaign-dir` from the photo-library skill |

## Run

| Symptom | Cause | Fix |
|---|---|---|
| `blocked:need_init_plan` | Roadmap or taxonomy missing | Run init steps 6 and 7. Do not write the plan from the run chat |
| Copy refused | This chat is Claude, or the stored pin is Anthropic | Switch to Grok 4.6 or ChatGPT-5.6 Terra, or pin `cursor-grok-4.6-high-fast` / `gpt-5.6-terra-medium` |
| It stopped before draft and asked a question | Two or more Voice DNA files | Name the one author file. It will not blend them |
| Images are all Fal | `approved/` is empty or tags missed | Approve tagged photos, or accept the Fal miss. Do not ingest from inside the run |
| It stopped after schema | That is the end of the slot | Publish is out of scope. Set a new slot for the next post |
| It started a second post in the same invoke | The one-slot rule was overridden in chat | Leave the next row for a new invoke |
| Story bank feels stale | Series exists and ready-check has not run | `check-ready.mjs` or `bank.mjs --refresh` |
| No story bank, run still proceeds | No series record | Expected. The digest is optional |

## Expert interview and voice

| Symptom | Cause | Fix |
|---|---|---|
| It will not send the calendar invite or the voice link | The skill never messages the spokesperson | You, or the agency contact, send it after you approve the preview |
| Digest missing after a call | Refresh has not run | `bank.mjs --refresh` |
| A story showed up in a draft you did not choose | The brief listed it under `Story bank entries used:` | Edit the brief. Unlisted entries stay out |
| Voice file did not affect the draft | It is not in the top of `01-resources/`, or the name does not match | Land `{author}-voice-dna.json` there, or retire the one you do not want |
| Landing the Voice DNA stopped | Overwrite, under-floor, or speaker check | Pass the matching confirm flag only after you have looked |
