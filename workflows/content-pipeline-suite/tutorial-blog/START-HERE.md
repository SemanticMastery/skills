# Content Pipeline — blog course

**Semantic Mastery Mastermind** — Bradley Benner  
**License:** Semantic Mastery Member License. See LICENSE-MEMBERS.md at the repository root.

This course is the blog track: one campaign research pack, a photo library, and one post at a time through schema. A recurring expert interview can feed a story bank beside that path. Voice DNA is how a draft sounds like a person.

The earlier combined course is still at [https://docshare.us/content-pipeline-suite-course/](https://docshare.us/content-pipeline-suite-course/). It is the previous lesson set. This course is the current blog lesson.

## The one-paragraph version

Run **`content-pipeline-init`** once per campaign (version 1.3.4). It scaffolds `06-content-pipeline/`, fills eight research classes, and writes an editorial roadmap plus a SiteSwarm tag taxonomy. Then **`content-pipeline-photo-library`** (1.8.0) ingests real photos and waits for you to approve them. Then **`content-pipeline-run`** (1.6.3) produces **one roadmap slot** from brief through schema. **`expert-interview`** (0.1.1) keeps a story bank current on a cadence. **`voice-interview`** (0.1.1) lands a Voice DNA file the draft step can use. A missing story bank or a missing Voice DNA file does not block the first post.

## Read in this order

| # | File | What you get |
|---|------|--------------|
| — | This file | What this course covers, and how to install |
| 00 | [00-map.md](00-map.md) | The order. Read this before a skill. |
| 01 | [01-gates.md](01-gates.md) | The stops, and what clears each one |
| 02 | [02-icm-tree.md](02-icm-tree.md) | The `06-content-pipeline/` folder tree |
| 03 | [03-init.md](03-init.md) | content-pipeline-init |
| 04 | [04-photo-library.md](04-photo-library.md) | content-pipeline-photo-library |
| 05 | [05-run.md](05-run.md) | content-pipeline-run, brief through schema |
| 06 | [06-expert-interview.md](06-expert-interview.md) | Recurring stories and the story bank |
| 07 | [07-voice.md](07-voice.md) | Voice DNA |
| 08 | [08-troubleshooting.md](08-troubleshooting.md) | Symptom, cause, fix |
| 09 | [09-glossary.md](09-glossary.md) | Terms used in this course |

If you only have twenty minutes: read 00, then 01, then the first-post sequence at the bottom of this page.

## What you install for this course

| Skill | Version in this lesson | Role |
|---|---|---|
| `content-pipeline-init` | 1.3.4 | Research pack, roadmap, tags |
| `content-pipeline-photo-library` | 1.8.0 | Real photos, you approve |
| `content-pipeline-run` | 1.6.3 | One post: brief through schema |
| `expert-interview` | 0.1.1 | Recurring story series |
| `voice-interview` | 0.1.1 | Spoken-source Voice DNA |
| `contentmaxima` | bundled | Matrix and Personas exports |
| `voice-extractor` | companion | Turns a voice transcript into Voice DNA |

Init also calls these when a class is missing: `business-dossier`, `dataforseo-onpage-crawl`, `dataforseo-paa-queries`, `dataforseo-fanout-queries`, `product-documentation`, `customer-research`. Install them, or drop the finished files in yourself. Init checks that a real file landed. It does not invent the research.

Each ZIP in the suite `skills/` folder is named `<skill>-v<version>.zip`. Unzip into a folder named for the skill **without** the version. Hosts load a skill only when that folder name matches `name:` in `SKILL.md`.

| Host | Skills directory |
|------|------------------|
| Cursor (project) | `{project}/.cursor/skills/` |
| Cursor (user) | `~/.cursor/skills/` |
| Claude Code / Desktop | `.claude/skills/` or `~/.claude/skills/` |
| Codex / OpenAI agents | `.agents/skills/` or your host's skills path |

Catalog clone: open `workflows/content-pipeline-suite/` and run its INSTALL flatten, then restart the host. `git pull` does not refresh a flatten.

`contentmaxima` drives a browser. Follow the `INSTALL.md` inside that skill, then set `CONTENT_MAXIMA_SKILL_ROOT`. The Content Maxima account is yours.

Unzip `templates/Content-Pipeline-ICM/` somewhere local. Pass it on every init with `--template`, or set `CONTENT_PIPELINE_ICM_TEMPLATE`.

## Requirements

| Requirement | Notes |
|-------------|-------|
| **Node.js 20+** | The skills run `.mjs` scripts. |
| An agent host that loads Agent Skills | Anything that reads `SKILL.md`. |
| A non-Anthropic model for copy | Grok 4.6 or ChatGPT-5.6 Terra. See [01-gates.md](01-gates.md). |
| API accounts | Only for the step you are actually running. Named on the gates page. |

## Worked example

Every example in this course is **Ridgeline Tree Care** in **Greater Denver**, phone `(555) 010-4477`. The spokesperson in the interview pages is **Morgan Hale**.

## Your first post

1. Read [00-map.md](00-map.md).
2. Install the skills above. Confirm the host lists them.
3. Pick one campaign folder. Have the website URL ready. Have two or three seed keywords ready, and a city or region for People Also Ask.
4. `/content-pipeline-init` on that folder. Let it stop when it asks. When it asks 13 weeks or 26, pick **13** the first time.
5. When the manifest says `init_complete`, run the photo library and approve at least a few real photos.
6. Open a chat on **Grok 4.6** or **ChatGPT-5.6 Terra**. Run `content-pipeline-run` with `gate_mode review` for **one** roadmap row. It stops after schema. It does not publish.

```text
/content-pipeline-init on C:\work\clients\ridgeline-tree-care
content pipeline run — campaign C:\work\clients\ridgeline-tree-care — gate_mode review
```

Name the campaign path every time. Let the skill stop. After a context reset, read the JSON manifest in `06-content-pipeline/`, not the old transcript.
