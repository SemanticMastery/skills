---
name: icm-architect
description: >-
  Interview wizard that scaffolds Interpretable Context Methodology (ICM)
  folder architecture for greenfield projects. Use when the user invokes
  /icm-architect, or asks to scaffold ICM, set up ICM folders, create a new
  project architecture, or bootstrap WorkFlows or Agency Client Direct
  (Client -> Campaign) trees with propose-then-confirm writes.
disable-model-invocation: true
---

# ICM Architect

Scaffold an Interpretable Context Methodology (ICM) workspace through an adaptive interview. Two modes: **WorkFlows** (ops/automation stages) and **Agency Client Direct** (`Client -> Campaign`). White-label `Client -> Agency -> Campaign` is out of scope.

**Agency semantics:** **Client = human** (owner/signer); **Campaign = company/brand** being marketed. Dossiers seed the campaign, not the client folder. Retainer/subscription = goal/outcome prose — not a campaign slug.

**Hard gates:** greenfield only; **propose → confirm → write** (never scaffold before explicit create approval).

## Progressive disclosure

| Need | Read |
|------|------|
| Interview + greenfield | `setup-interview.md` |
| Question order | `references/interview-standard.md` |
| Go-deeper offer | `references/go-deeper-guidance.md` |
| Agency Direct + catalog | `references/agency-client-direct.md` |
| WorkFlows stages | `references/workflows-mode.md` |
| Harness files | `references/harness-map.md` |
| Confirm gate | `references/confirm-checklist.md` |
| Attribution | `references/attribution.md` |
| Templates | `templates/agency/`, `templates/workflows/`, `templates/harness/` |

Resolve paths relative to this skill folder (authoring: `skills/icm-architect/`; install: `.cursor/skills/icm-architect/`).

## Publish / GitHub (agents: read this before hunting remotes)

| Role | Location |
|------|----------|
| **Authoring source of truth** | This package under the local `icm-architect` project: `skills/icm-architect/` (also mirrored to `C:\Users\bradl\.cursor\skills\icm-architect\`). That authoring git repo often has **no remote** — do not search for one. |
| **Canonical GitHub publish target** | Private catalog **[SemanticMastery/skills](https://github.com/SemanticMastery/skills)** → path **`skills/icm-architect/`** on branch **`master`**. |
| **Student install from GitHub** | Copy `skills/icm-architect/` from that catalog into `<project>/.cursor/skills/icm-architect/`. |

When the user asks to **commit and push** skill updates: (1) commit in the authoring repo if they want a local history snapshot; (2) sync/copy this skill folder into a clone of `SemanticMastery/skills` at `skills/icm-architect/` and **push `master` there**. Do not invent alternate orgs/repos. Details: `INSTALL.md` + authoring repo `docs/student-distribution.md`.

## Procedure (run top to bottom)

### 0. Set expectations

Say early: you will interview, optionally go deeper, propose a full tree + file list, and **not write** until explicit create approval (`Create it` / `Confirmed — scaffold`). "Looks good" alone is not enough. See `references/confirm-checklist.md`.

### 1. Preflight

Follow `setup-interview.md` Phase B (greenfield matrix).

- Trivial (`.git` and/or single README) → soft-warn, may proceed.
- Business dossier(s) at scaffold root (`*dossier*.md` / `*dossier*.docx`) alone or with trivial starters → **allowed**; proceed and use for context.
- No dossier present → suggest adding one (business-dossier skill or existing file); do not block.
- Substantial other content → **refuse writes**; migration deferred. Stop.

### 2. Interview

Shared spine in normative order (`references/interview-standard.md`):

1. Location (here vs named subfolder)
2. Type (WorkFlows | Agency Client)
3. Harness
4. Goal
5. Desired outcome
6. Tools/services

Then branch follow-ups (`setup-interview.md` Phase D + Agency or WorkFlows reference).

### 3. Optional go-deeper

Offer once (`references/go-deeper-guidance.md`). Include Clief Notes pointer. Do not dump a full ICM course.

### 4. Propose

Show **tree + file list + short rationale**. Include harness files from `references/harness-map.md`. Root all paths under the chosen location.

**Agency:** human client folder → company/brand campaign folder; always `01-intake` … `04-archives` plus the **full default module catalog**; then ask “omit any?”; renumber remaining modules sequentially (see `agency-client-direct.md`). Ask for the **human client before** proposing paths; dossier pre-fills **campaign only**.  
**WorkFlows:** 3–7 numbered stages from goal; allow rename at confirm.

### 5. Confirm

Wait for explicit create approval. On edits → re-propose full tree → wait again. Never write on ambiguous assent alone.

### 6. Write

Only after confirm:

1. Create folders from the confirmed tree.
2. Fill templates; replace placeholders; no leftover `{{`.
3. Write harness thin entrypoints (ICM CONTEXT + campaign/project PROJECT-RULES stay canonical).
4. Write the handoff file HOW-TO-WORK-THIS-PROJECT.md with teaching blurb + next-steps + attribution.
5. **Agency + root dossier:** copy the dossier into `{Human-Client}/{Company-Campaign}/01-intake/1.1-docs/` (keep the original at scaffold root unless the user asked to move it). Use dossier content for **campaign** CONTEXT fill — not to name the human client folder.

### 7. Handoff → Done

Point the user at the written HOW-TO-WORK-THIS-PROJECT.md handoff. It must include: why-these-stages, first-task checklist, [Clief Notes](https://www.skool.com/cliefnotes/about?ref=a8a5ace9f3c746e79bf6885aa53eb3ee), harness notes.

## Out of scope (v1)

- White-label Agency layer
- Migration of messy existing folders
- Campaign workbook `.xlsx` / `One-Off-Orders/`
- Rich per-harness polish (deferred)

## Attribution

ICM by Jake Van Clief — always credit per `references/attribution.md`.
