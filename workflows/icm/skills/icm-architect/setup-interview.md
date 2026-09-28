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
3. Detect **business dossier** files at the scaffold root:
   - Treat as dossiers: top-level `*.md` or `*.docx` whose **filename** contains `dossier` (case-insensitive), e.g. `Columbia-Land-Clearing-Dossier.md`, `client-dossier.docx`.
   - Dossiers are **allowed** greenfield companions — they do **not** trigger refuse.
4. Classify:

| Condition | Action |
|-----------|--------|
| Empty (no files/folders, or only empty dirs you did not create) | Proceed; if Agency is chosen (or likely), run **dossier suggest** below |
| Only `.git` and/or a **single** `README` / `README.md` | Soft-warn: "Target isn't empty but only has trivial starter files; OK to continue?" — then may proceed; run **dossier suggest** if no dossier present |
| Only allowed companions: `.git` and/or single README **and/or** one or more business dossier `.md`/`.docx` (and nothing else substantial) | **Proceed.** Note the dossier path(s); plan to use them for client/campaign context and copy into `01-intake/1.1-docs/` at write (Agency). Soft-ack: "Found dossier — OK to scaffold alongside it." |
| Any other substantial content (code, multiple non-dossier docs, existing ICM tree, etc.) | **Refuse writes.** Explain migration is out of scope for v1. Stop. |

Do not write scaffold files if the refuse path triggers.

### Dossier suggest (when none present)

Run once after preflight (and again briefly when the user picks **Agency Client**, if still missing):

> A business dossier (`.md` or `.docx`) in this folder seeds the **campaign (company/brand)** — firmographics for CONTEXT routers. It does **not** replace asking who the **human client** is. If you have a **business-dossier** skill (or an existing dossier), add that file to this project root before or during the interview — then tell me the filename. You can also continue without one and use placeholders.

Do **not** hard-block the interview. If they add a dossier mid-interview, re-scan and use it.

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

Read `references/agency-client-direct.md` (**Client = human**, **Campaign = company/brand**). Collect in this order:

1. **Client (human)** — display name + folder slug; optional relationship (owner, retainer signer, primary contact). **Ask this even when a company dossier is present.** Never default the client folder to the company / dossier name.
2. **Campaign (company / brand)** — display name + folder slug. If a root `*dossier*` exists, **pre-fill campaign** suggestions from the dossier; confirm with the user.
3. Tools / services in scope → **annotate** against the full default catalog (for rationale and routing). Do **not** shrink the tree from this list.
4. **Dossier:** if present, use for **campaign** firmographics / CONTEXT fill only. If none exists, run **dossier suggest** once (do not block).
5. **Billing / retainer:** if the user mentions retainer, subscription, or ongoing monthly work, put that in goal/outcome prose — **do not** create a campaign folder named Retainer / Subscription / Monthly unless they explicitly name a distinct engagement that way.
6. Do **not** ask about `archived-campaigns/` unless the user describes a white-label multi-agency scenario (out of scope for Direct).

In the proposal tree, show both display names and folder paths (e.g. client `Jordan Lee` → `Jordan-Lee/`; campaign `Columbia Land Clearing` → `Jordan-Lee/Columbia-Land-Clearing/`). Include any root dossier in the tree note (stays at root and copied into `{campaign}/01-intake/1.1-docs/` at write).

Always plan stages: `01-intake`, `02-deliverables`, `03-decisions`, `04-archives`, plus the **full default nested catalog**. After showing the full tree, ask **“Omit any of these modules?”** If they omit, renumber remaining modules sequentially within each stage, then re-propose.

### WorkFlows

Read `references/workflows-mode.md`. Derive 3–7 numbered stages from goal/outcome. If implied count is outside 3–7, ask or clamp with user confirmation before propose.

## Phase E — Go deeper (optional)

Offer per `references/go-deeper-guidance.md`. Then continue.

## Phase F — Propose → Confirm → Write

Follow `SKILL.md` procedure and `references/confirm-checklist.md`. Never skip confirm.
