# How to work this project — Content-Pipeline-ICM

## What was scaffolded

WorkFlows ICM **campaign template** for **Content-Pipeline-ICM**:

- Layer 1 router: `CONTEXT.md` (template + resource classes)
- Canonical rules: `PROJECT-RULES.mdc`
- Stages with hard-coded Agent prompts: `02-plan`, `3.1`–`3.5`
- Permanent resource: `01-resources/ai-isms.md`
- Harness: Cursor — `AGENTS.md` + `.cursor/rules/project-rules.mdc` (thin pointers)

Duplicate this entire folder for each campaign. Fill campaign-supplied files under `01-resources/`. Customize `04-publish` only when the publishing platform is known.

## Folder structure

Visual map of the scaffolded tree (read top-down: routers and harness at root, then numbered stages):

```text
Content-Pipeline-ICM/
├── CONTEXT.md
├── PROJECT-RULES.mdc
├── HOW-TO-WORK-THIS-PROJECT.md
├── AGENTS.md
├── .cursor/
│   └── rules/
│       └── project-rules.mdc
├── 01-resources/
│   ├── CONTEXT.md
│   └── ai-isms.md          # always included
├── 02-plan/
│   └── CONTEXT.md
├── 03-write/
│   ├── CONTEXT.md
│   ├── 3.1-brief/
│   │   └── CONTEXT.md
│   ├── 3.2-draft/
│   │   └── CONTEXT.md
│   ├── 3.3-edit/
│   │   └── CONTEXT.md
│   ├── 3.4-polish/
│   │   └── CONTEXT.md
│   └── 3.5-images/
│       └── CONTEXT.md
├── 04-publish/
│   └── CONTEXT.md          # platform-generic until campaign deploy
└── 05-archives/
    └── CONTEXT.md
```

## Why these stages

- **`01-resources`** — permanent `ai-isms.md` plus campaign research pack so plan/produce agents share one source vault.
- **`02-plan`** — one planning job for a 13- or 26-week Editorial Roadmap before any piece work.
- **`03-write` + 3.1–3.5** — linear folder-agents (brief → draft → edit → polish → images); parent CONTEXT routes which step runs next.
- **`04-publish`** — CMS-ready assets + images; platform wiring is campaign-specific.
- **`05-archives`** — completed plans/runs stay out of the live pipeline.

## First-task checklist

1. Duplicate this template for the campaign (if not already a campaign copy).
2. Read root `CONTEXT.md` and confirm the resource table + task → stage map.
3. Confirm `01-resources/ai-isms.md` is present; drop campaign-supplied research files into `01-resources/`.
4. Run `02-plan` (13 or 26 weeks), then one vertical slice through 3.1→3.5 (hard-stop after images); run `04-publish` when ready.
5. When the campaign’s CMS/platform is known, update `04-publish/CONTEXT.md` only — leave earlier stages alone unless forking intentionally.
6. Log durable rules in `PROJECT-RULES.mdc`; keep harness files as pointers.

## Going deeper on ICM

This project uses Interpretable Context Methodology (ICM) ideas from **Jake Van Clief**.
This skill explained why these stages fit your goal — it is not a full ICM course.
For deeper learning, join [Clief Notes](https://www.skool.com/cliefnotes/about?ref=a8a5ace9f3c746e79bf6885aa53eb3ee) and read the
[ICM repository](https://github.com/RinDig/Interpreted-Context-Methdology).
