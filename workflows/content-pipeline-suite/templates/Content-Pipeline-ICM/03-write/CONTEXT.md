# 03-write — Stage Context

## Job

Orchestrate piece production for one plan slot at a time through the linear chain: brief → draft → edit → polish → images.

## Inputs

- Active content plan / slot from `02-plan/`
- Source pack from `01-resources/` (read-only), including always-included `ai-isms.md` plus campaign-supplied research
- Which piece/slot to produce (ask if unclear)

## Process

1. Select one plan slot.
2. Run stages in order; do not skip unless the operator overrides:
   - `3.1-brief` → `3.2-draft` → `3.3-edit` → `3.4-polish` → `3.5-images`
3. Each subfolder is a folder-agent: read that subfolder's `CONTEXT.md`, write only its outputs.
4. After images, hard-stop. Hand the candidate to `04-publish/` only when publish is explicitly run (platform remains generic until campaign deploy).

## Outputs

- Routing decision: which `3.x` step is next for the active slot
- Completed produce chain artifacts under `3.1`–`3.5` for that slot. When a post has more than one file in a stage, nest them in `post-{NN}-{stage}/` (polish and images always nest).

## Notes

- Keep this stage focused on orchestration, not writing the article itself.
- Point agents here from the root `CONTEXT.md` task table.
- Prefer one vertical slice (one slot) before batching many weeks.
- `ai-isms.md` must be present for draft / edit / polish; it ships with every template copy.
