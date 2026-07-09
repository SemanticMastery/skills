# WorkFlows mode — proposal rules

Use for ops/automation/internal projects (not Agency Client Direct).

## Proposal algorithm (instructional)

1. Read **goal**, **desired outcome**, and **tools/services** from the interview.
2. Draft **3–7 stages**. Each stage = one job (verb-ish folder purpose).
3. Prefer numbered prefixes: `01-{slug}`, `02-{slug}`, …
4. Slugs: `lowercase-with-hyphens`, short, scannable.
5. If the goal implies **fewer than 3** or **more than 7** stages:
   - Ask a clarifying question, **or**
   - Clamp to 3–7 and confirm the clamp with the user **before** Propose.
6. Zero stages is invalid — ask for a clearer outcome; do not propose.
7. At Confirm, user may **rename**, **reorder**, or switch to non-numbered names (allowed after confirm; note ICM preference for numbered stages in the proposal rationale).

## Example (fictional) — client onboarding automation

Goal: automate contractor client onboarding from form → CRM → welcome pack.

Illustrative stages:

```text
01-intake/
02-qualify/
03-provision/
04-welcome-pack/
05-handoff/
```

Do not copy this list blindly — derive from the user's goal.

## Files to create (after confirm)

At WorkFlows project root:

| Path | Source |
|------|--------|
| `CONTEXT.md` | `templates/workflows/CONTEXT.md` |
| `PROJECT-RULES.mdc` | `templates/workflows/PROJECT-RULES.mdc` |
| `HOW-TO-WORK-THIS-PROJECT.md` | `templates/workflows/HOW-TO-WORK-THIS-PROJECT.md` |
| `{NN}-{stage}/CONTEXT.md` | `templates/workflows/stage-CONTEXT.md` (per stage) |
| Harness entrypoints | `references/harness-map.md` |

## Layer 1 CONTEXT

`CONTEXT.md` must include a task table mapping jobs → stages. Fill from the confirmed stage list.

## Per-stage CONTEXT

Each stage `CONTEXT.md` uses Inputs / Process / Outputs stubs. Replace `{{STAGE_NAME}}`, `{{STAGE_JOB}}`, `{{STAGE_INPUTS}}`, `{{STAGE_PROCESS}}`, `{{STAGE_OUTPUTS}}`.

## Go-deeper

Explain why *this* stage list for *this* goal; Clief Notes for principles (`attribution.md`).

## Placeholders (root templates)

`{{PROJECT_NAME}}`, `{{GOAL}}`, `{{OUTCOME}}`, `{{TOOLS_SERVICES}}`, `{{STAGE_TABLE}}`, `{{TASK_ROUTING_TABLE}}`, `{{HARNESS_NOTE}}`, `{{WHY_STAGES_BLURB}}`.
