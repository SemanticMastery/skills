# 01-resources — Stage Context

## Job

Hold and inventory the content source pack for this **campaign template copy**. Normalize naming/placement only—do not rewrite research or invent missing research in this stage.

## Inputs

### Always included (ships with the template)

- `ai-isms.md` — banned-language / AI-ism reference used by `3.2-draft`, `3.3-edit`, and `3.4-polish`

### Campaign-supplied (required before running `02-plan`)

- Content Maxima Matrix File(s)
- Content Maxima Personas File(s)
- dataforseo-paa-queries
- dataforseo-fanout-queries
- business-dossier
- dataforseo-onpage-crawl
- customer-research (ICPs)
- product-documentation

### Optional

- Voice DNA (`*voice-dna*`, brand-voice, author-voice) and any other campaign extras referenced by produce stages
- `image-library/` — HITL-approved brand photos for `3.5-images` (setup operator via `content-pipeline-photo-library`). Not a ninth init hard-gate. Empty approved is a Fal miss.

## Process

1. Confirm `ai-isms.md` is present (template permanent file).
2. Confirm which campaign-supplied files are present vs missing.
3. Keep originals intact; note gaps for the operator rather than fabricating sources.
4. List stable paths so `02-plan` and `03-write` can reference them.

## Outputs

- Inventory split by class: always-included / campaign-supplied / optional
- Clear gap list for anything still missing (especially before `02-plan`)

## Notes

- Keep this stage focused on its one job.
- Point agents here from the root `CONTEXT.md` task table.
- Later stages read from here; they should not mutate source files in place.
- When this template is duplicated for a campaign, `ai-isms.md` must travel with the copy; campaign research is filled per engagement.
