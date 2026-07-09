# Confirm checklist — propose → confirm → write

Use before any scaffold write. Hard gate: **never write before explicit create approval**.

## Propose block (must show all three)

1. **Tree** — full folder tree rooted at the scaffold location (here or named subfolder).
2. **File list** — every file to create (CONTEXT, rules, harness, handoff, stage CONTEXT files, etc.).
3. **Short rationale** — why these stages/modules for this goal (2–6 bullets).

### Agency Direct — omit pass (before create)

After the first full-catalog proposal:

1. Ask **“Omit any of these modules?”** (opt-out).
2. If they omit any: drop those folders, **renumber remaining modules sequentially** within each stage (`1.x` / `2.x` / `3.x`), keep slugs, re-show tree + file list + rationale.
3. Only then wait for explicit create approval.

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

If the user changes a stage name, module, path, harness, or omits/adds modules:

1. Update the proposal (Agency: apply sequential renumber after omit/add).
2. **Re-show** the full tree + file list + rationale.
3. Wait for explicit create approval again.
4. Only then write.

## Write steps

1. Create directories from the **confirmed** tree.
2. Copy templates; replace all `{{PLACEHOLDERS}}`.
3. Write harness files per `harness-map.md`.
4. Write `HOW-TO-WORK-THIS-PROJECT.md` with the **confirmed folder tree** in `{{FOLDER_TREE}}` (same `text` diagram from the propose/confirm block — include key files, harness paths, stages/modules, and notable `data/` or `scripts/` subfolders) plus attribution (`attribution.md`).
5. Scan written files for leftover `{{` — fix any misses before declaring done.
6. Summarize what was created (paths only; do not dump full file bodies in chat).

## Refuse paths

- Substantial non-empty target → no writes; migration deferred.
- **Exception:** top-level business dossier files (`*dossier*.md` / `*dossier*.docx`), alone or with `.git` / single README, are **not** refuse triggers — scaffold alongside them (see `setup-interview.md` Phase B).
- User declines create → stop; keep proposal in chat for later.
