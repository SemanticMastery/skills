# Confirm checklist — icm-migrate (propose → confirm → write)

Hard gate: **never write or overwrite ICM harness files before explicit create/update approval**.

## Propose block (must show all three)

1. **File list** — every path to create or update (CONTEXT, project-rules, optional AGENTS, optional hooks, hash file).
2. **Draft outline** — CONTEXT sections + inventory table preview; project-rules bullets.
3. **Short rationale** — why this harness for this root (2–6 bullets).

For **updates** to an existing harness: show a diff-style summary (what will change vs leave alone). Inventory-only refresh does not need full propose if user invoked `/icm-refresh-context` explicitly — still report before/after inventory lines.

## Explicit approval (required for create/overwrite)

Accept clear language, for example:

- `Create it`
- `Confirmed — write harness`
- `Yes, write the ICM files`
- `Approve create`
- `Approve update`

**Not sufficient alone:**

- `Looks good`
- `LGTM`
- `Nice`
- `OK` (ambiguous)

If the user only says "looks good", acknowledge and ask for explicit create/update approval.

## Edits at confirm

If the user changes root, file set, or inventory depth:

1. Update the proposal.
2. Re-show file list + outline + rationale.
3. Wait for explicit approval again.
4. Only then write.

## Write steps

1. Ensure `.cursor/rules/` (and `.cursor/hooks/` if hooks approved) exist.
2. Write files from confirmed templates; replace placeholders.
3. Seed or refresh inventory markers; write `.cursor/icm-inventory.sha256`.
4. Scan for leftover `{{` placeholders.
5. Summarize paths only in chat (do not dump full file bodies).

## Refresh-only path

User said `/icm-refresh-context` or "refresh inventory":

- Update marker interiors + hash only.
- No project-rules edits.
- No full CONTEXT prose rewrite.
- If markers missing: propose inserting markers; wait for approval before editing CONTEXT structure.

## Do not refuse for existing content

Unlike `icm-architect`, a non-empty tree is **normal**. Do not refuse migrate because folders already exist.

Still refuse / stop when:

- User declines create
- Target path is unclear or wrong root
- User asks hooks to auto-edit project-rules (explain non-goal)
