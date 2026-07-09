# Confirm checklist — propose → confirm → write

Use before any scaffold write. Hard gate: **never write before explicit create approval**.

## Propose block (must show all three)

1. **Tree** — full folder tree rooted at the scaffold location (here or named subfolder).
2. **File list** — every file to create (CONTEXT, rules, harness, handoff, stage CONTEXT files, etc.).
3. **Short rationale** — why these stages/modules for this goal (2–6 bullets).

Optional: note renames/edits the user can request.

## Explicit create approval (required)

Accept only clear create language, for example:

- `Create it`
- `Confirmed — scaffold`
- `Yes, create the folders`
- `Approve create`

**Not sufficient alone:**

- `Looks good`
- `LGTM`
- `Nice`
- `OK` (ambiguous)

If the user only says "looks good", reply: acknowledge and ask for explicit create approval before writing.

## Edits at confirm

If the user changes a stage name, module, path, or harness:

1. Update the proposal.
2. **Re-show** the full tree + file list + rationale.
3. Wait for explicit create approval again.
4. Only then write.

## Write steps

1. Create directories from the **confirmed** tree.
2. Copy templates; replace all `{{PLACEHOLDERS}}`.
3. Write harness files per `harness-map.md`.
4. Write `HOW-TO-WORK-THIS-PROJECT.md` with attribution (`attribution.md`).
5. Scan written files for leftover `{{` — fix any misses before declaring done.
6. Summarize what was created (paths only; do not dump full file bodies in chat).

## Refuse paths

- Substantial non-empty target → no writes; migration deferred.
- User declines create → stop; keep proposal in chat for later.
