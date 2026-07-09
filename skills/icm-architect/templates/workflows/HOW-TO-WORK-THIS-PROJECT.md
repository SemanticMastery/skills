# How to work this project — {{PROJECT_NAME}}

## What was scaffolded

WorkFlows ICM tree for **{{PROJECT_NAME}}**:

- Layer 1 router: `CONTEXT.md`
- Canonical rules: `PROJECT-RULES.mdc`
- Stages: see `CONTEXT.md`
- Harness: {{HARNESS_NOTE}}

## Why these stages

{{WHY_STAGES_BLURB}}

## First-task checklist

1. Read root `CONTEXT.md` and confirm the task → stage map matches how you work.
2. Fill the first stage's Inputs in `01-*/CONTEXT.md` (or your first confirmed stage).
3. Run one thin vertical slice through the pipeline before expanding every stage.
4. Log durable rules in `PROJECT-RULES.mdc`; keep harness files as pointers.
5. When a stage's job changes, rename/reorder only after a fresh propose → confirm.

## Going deeper on ICM

This project uses Interpretable Context Methodology (ICM) ideas from **Jake Van Clief**.
This skill explained why these stages fit your goal — it is not a full ICM course.
For deeper learning, join [Clief Notes](https://www.skool.com/cliefnotes/about?ref=a8a5ace9f3c746e79bf6885aa53eb3ee) and read the
[ICM repository](https://github.com/RinDig/Interpreted-Context-Methdology).
