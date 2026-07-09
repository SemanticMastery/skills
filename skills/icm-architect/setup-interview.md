# Setup interview — icm-architect

Executable checklist for the agent. Question order is normative — see `references/interview-standard.md`.

## Phase A — Set expectations (say early)

Tell the user before scanning or writing:

> I'll ask a short set of questions, optionally explain why these stages fit your goal, then show a full proposed folder/file tree. I will not create or overwrite anything until you explicitly confirm create (e.g. "Create it" / "Confirmed — scaffold"). "Looks good" alone is not enough.

## Phase B — Greenfield preflight

1. Resolve **scaffold root**:
   - Ask location (here vs named subfolder) as question 1 of the interview, **or** if already known, use it.
   - If named subfolder: all paths are under `{workspace}/{subfolder}/`.
2. List top-level entries in the scaffold root (create the named subfolder only after confirm — for preflight, check parent + whether the named folder already exists).
3. Classify:

| Condition | Action |
|-----------|--------|
| Empty (no files/folders, or only empty dirs you did not create) | Proceed |
| Only `.git` and/or a **single** `README` / `README.md` | Soft-warn: "Target isn't empty but only has trivial starter files; OK to continue?" — then may proceed |
| Any other substantial content (code, multiple docs, existing ICM tree, etc.) | **Refuse writes.** Explain migration is out of scope for v1. Stop. |

Do not write scaffold files if the refuse path triggers.

## Phase C — Shared interview spine

Ask in order (`references/interview-standard.md`):

1. Location (here vs named subfolder + name)
2. Type: WorkFlows | Agency Client
3. Harness (map with `references/harness-map.md`)
4. Goal
5. Desired outcome
6. Tools / services

## Phase D — Branch follow-ups

### Agency Client

Read `references/agency-client-direct.md`. Collect at least:

- Client **display name** and **folder slug** (see slug rules in that reference)
- Campaign **display name** and **folder slug**
- Services / deliverables in scope → map to module catalog (do not invent off-catalog folders)
- Opt-in: `archived-campaigns/` under client? Default **no**

In the proposal tree, show both display names and folder paths (e.g. client `Acme Dental` → folder `Acme-Dental/`).

Always plan stages: `01-intake`, `02-deliverables`, `03-decisions`, `04-archives`. Nested children only from catalog selections.

### WorkFlows

Read `references/workflows-mode.md`. Derive 3–7 numbered stages from goal/outcome. If implied count is outside 3–7, ask or clamp with user confirmation before propose.

## Phase E — Go deeper (optional)

Offer per `references/go-deeper-guidance.md`. Then continue.

## Phase F — Propose → Confirm → Write

Follow `SKILL.md` procedure and `references/confirm-checklist.md`. Never skip confirm.
