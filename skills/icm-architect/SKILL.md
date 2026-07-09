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

**Agency:** always `01-intake` … `04-archives` plus the **full default module catalog**; then ask “omit any?”; renumber remaining modules sequentially (see `agency-client-direct.md`).  
**WorkFlows:** 3–7 numbered stages from goal; allow rename at confirm.

### 5. Confirm

Wait for explicit create approval. On edits → re-propose full tree → wait again. Never write on ambiguous assent alone.

### 6. Write

Only after confirm:

1. Create folders from the confirmed tree.
2. Fill templates; replace placeholders; no leftover `{{`.
3. Write harness thin entrypoints (ICM CONTEXT + campaign/project PROJECT-RULES stay canonical).
4. Write the handoff file HOW-TO-WORK-THIS-PROJECT.md with teaching blurb + next-steps + attribution.
5. **Agency + root dossier:** copy the dossier into `01-intake/1.1-docs/` (keep the original at scaffold root unless the user asked to move it). Use dossier content when filling CONTEXT routers.

### 7. Handoff → Done

Point the user at the written HOW-TO-WORK-THIS-PROJECT.md handoff. It must include: why-these-stages, first-task checklist, [Clief Notes](https://www.skool.com/cliefnotes), harness notes.

## Out of scope (v1)

- White-label Agency layer
- Migration of messy existing folders
- Campaign workbook `.xlsx` / `One-Off-Orders/`
- Rich per-harness polish (deferred)

## Attribution

ICM by Jake Van Clief — always credit per `references/attribution.md`.
