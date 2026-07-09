# How to work this project — {{CAMPAIGN_NAME}}

## What was scaffolded

Direct Agency Client tree for **{{CLIENT_NAME}}** (person) / **{{CAMPAIGN_NAME}}** (company/brand):

- Client router: `CLIENT-CONTEXT.md` (person-level campaign index)
- Campaign router: `CAMPAIGN-CONTEXT.md` (company engagement)
- Stages: `01-intake`, `02-deliverables`, `03-decisions`, `04-archives`
- Modules: see campaign context (full catalog by default; numbers reflect any omit/renumber)
- Canonical rules: `PROJECT-RULES.mdc`
- Harness: {{HARNESS_NOTE}}

## Folder structure

Visual map of the scaffolded tree (read top-down: person-level client → company campaign → stages/modules):

```text
{{FOLDER_TREE}}
```

## Why these stages

- **01-intake** — one job: gather inputs before production.
- **02-deliverables** — one job: ship work products.
- **03-decisions** — one job: keep decision/comms memory.
- **04-archives** — one job: park inactive or troubleshooting material.

{{WHY_STAGES_BLURB}}

**Client vs campaign:** the outer folder is the **human** account holder; the inner folder is the **company/brand** being marketed. Nested modules are the Agency Direct catalog (docs, audit, logo, photos, links, press, reports, schema, articles, GBP, social, communications, traces, troubleshooting). Empty folders are placeholders for assets that arrive later. Tools named in the interview annotate routing — they do not invent off-catalog folders.

## First-task checklist

1. Skim `CAMPAIGN-CONTEXT.md` task routing table.
2. Drop real intake materials into the matching `01-intake/1.x-*` modules.
3. Start the first deliverable under the matching `02-deliverables/2.x-*` module.
4. Log important choices under `03-decisions/` as you go.
5. Keep harness files as pointers — edit CONTEXT / PROJECT-RULES for real guidance.

## Going deeper on ICM

This project uses Interpretable Context Methodology (ICM) ideas from **Jake Van Clief**.
This skill explained why these stages fit your goal — it is not a full ICM course.
For deeper learning, join [Clief Notes](https://www.skool.com/cliefnotes/about?ref=a8a5ace9f3c746e79bf6885aa53eb3ee) and read the
[ICM repository](https://github.com/RinDig/Interpreted-Context-Methdology).
