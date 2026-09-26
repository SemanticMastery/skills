# Content Pipeline Suite — start here

**Semantic Mastery Mastermind** — Bradley Benner  
**License:** For enrolled students only. Not for public resale or redistribution outside the program.

Eight agent skills that take one local business campaign from raw research to publishable blog posts and service pages, without the agent inventing facts about the business.

## The one-paragraph version

You run **`content-pipeline-init`** once per campaign. It gathers eight classes of research into one folder and writes an editorial roadmap plus a tag taxonomy. From that single pack, two tracks run independently: the **blog track** builds a photo library then produces posts one slot at a time, and the **service page track** reconciles the site's real pages against the offering catalog, runs a keyword Matrix per page, then produces pages one slug at a time. Three sibling interview skills capture different things: **`owner-interview`** (facts) when a page cannot be written honestly, **`expert-interview`** (stories) on a calendar after those facts exist, and **`voice-interview`** (how they sound) when the blog draft needs a spoken-source Voice DNA.

## Read in this order

| # | File | What you get |
|---|------|--------------|
| — | This file | Install, prerequisites, first 30 minutes |
| 00 | [00-suite-map.md](00-suite-map.md) | The mental model. Read this before touching a skill. |
| 01 | [01-sequencing-and-gates.md](01-sequencing-and-gates.md) | Every hard stop and what clears it |
| 02 | [02-init.md](02-init.md) | content-pipeline-init |
| 03 | [03-photo-library.md](03-photo-library.md) | content-pipeline-photo-library |
| 04 | [04-run.md](04-run.md) | content-pipeline-run |
| 05 | [05-pages-init.md](05-pages-init.md) | pipeline-pages-init |
| 06 | [06-pages.md](06-pages.md) | content-pipeline-pages |
| 07 | [07-owner-interview.md](07-owner-interview.md) | owner-interview (facts) |
| 07b | [07b-expert-interview.md](07b-expert-interview.md) | expert-interview (stories) |
| 07c | [07c-voice-interview.md](07c-voice-interview.md) | voice-interview (how they sound) |
| 08 | [08-shared-contracts.md](08-shared-contracts.md) | The rules every skill obeys |
| 09 | [09-retell-voice-setup.md](09-retell-voice-setup.md) | Optional: deploy your own voice interviewer |
| 10 | [10-external-dependencies.md](10-external-dependencies.md) | Accounts, keys, and what each one costs |
| 11 | [11-troubleshooting.md](11-troubleshooting.md) | Symptom to cause to fix |
| 12 | [12-glossary.md](12-glossary.md) | Terms used across all eight skills |
| 13 | [13-walkthrough.md](13-walkthrough.md) | One campaign, start to finish, both tracks |

If you only have twenty minutes: read 00, then 01, then the walkthrough in 13.

## What is in this package

```text
content-pipeline-suite/
  README.md            install matrix and suite order
  tutorial/            this curriculum
  diagrams/            1920x1080 PNGs for slides and screen-shares
  skills/              one <skill>-v<version>.zip per skill (eight + contentmaxima)
  templates/           Content-Pipeline-ICM (the blog folder tree + stage prompts)
  voice-host/          optional Cloudflare Worker for owner + expert + voice interviews
```

## Requirements

| Requirement | Notes |
|-------------|-------|
| **Node.js 20+** | Every skill ships deterministic `.mjs` scripts. LTS recommended. |
| An agent host that loads Agent Skills | Cursor, Claude Code, Claude Desktop, Codex, OpenCode — anything that reads `SKILL.md` |
| A non-Anthropic model for copy stages | Grok 4.6 or ChatGPT-5.6 Terra recommended. See below. |
| API accounts | Only for the research you actually run. See [10-external-dependencies.md](10-external-dependencies.md). |

### Anthropic models are refused for copy stages

`content-pipeline-run` and `content-pipeline-pages` will not write brief, draft, edit, or polish on Claude / Sonnet / Opus / Haiku — including `inherit` when the chat itself is Claude. Anthropic watermarks generated text. Switch the chat to **Grok 4.6** (`cursor-grok-4.6-high-fast`) or **ChatGPT-5.6 Terra** (`gpt-5.6-terra-medium`), or pin any other non-Anthropic id.

You can still *orchestrate* on any model. The refusal is specific to the stages that produce client-facing prose.

## Install

Each file in `skills/` is a ZIP named for the skill and its version, such as `content-pipeline-init-v1.1.0.zip`. The version in the name is how you know which release you have. Unzip each one into your host's skills directory, into a folder named for the skill **without** the version (`content-pipeline-init/`). Hosts only load a skill when its folder name matches the `name:` in its `SKILL.md`, which sits at the top of every ZIP. On Claude.ai or Claude Desktop, upload the ZIPs as they are. The suite `README.md` has a one-line command that installs all nine.

| Host | Skills directory |
|------|------------------|
| Cursor (project) | `{project}/.cursor/skills/` |
| Cursor (user) | `~/.cursor/skills/` |
| Claude Code / Desktop | `.claude/skills/` or `~/.claude/skills/` |
| Codex / OpenAI agents | `.agents/skills/` or your host's skills path |
| OpenCode and other Agent Skills hosts | Project or user `skills/` folder that loads `SKILL.md` |

Catalog clone: open `workflows/content-pipeline-suite/` and run its INSTALL flatten. That copies every suite skill and every nested companion, including `voice-extractor` beside `voice-interview`, into the host skills root. Pointing the host at the suite folder does not load them. `git pull` does not refresh a flatten; run flatten again and restart the host. The zip steps below are the same end layout.

Result:

```text
.cursor/skills/
  content-pipeline-init/
  content-pipeline-photo-library/
  content-pipeline-run/
  pipeline-pages-init/
  content-pipeline-pages/
  owner-interview/
  expert-interview/
  voice-interview/
  contentmaxima/
```

`contentmaxima` is the odd one out: it drives a real browser, so it needs its own install pass — Bun, Playwright Chromium, and credentials. Unzip it like the others, follow the `INSTALL.md` inside, then set `CONTENT_MAXIMA_SKILL_ROOT` to where you installed it. The Content Maxima **account** is still yours to buy; the skill only automates the exports.

### Install all eight, even if you only want one track

They cite each other rather than duplicating shared rules:

- `content-pipeline-pages` reads `gate-modes.md`, `copywriting-model.md`, and `voice-dna.md` from the installed **`content-pipeline-run`** folder.
- `owner-interview` hands off to **`product-documentation`** and re-syncs through **`content-pipeline-init`**'s `sync-resources.mjs`.
- `content-pipeline-run` refreshes the story bank when an **`expert-interview`** series record exists. Brief/draft templates already have optional digest lines.
- `content-pipeline-run` already consumes `*voice-dna*` at draft. **`voice-interview`** is what produces that file. Companion **`voice-extractor`** is a separate install, like `product-documentation`.

That is deliberate. One definition of "review mode" beats three drifting copies.

### Also unzip the templates

`templates/Content-Pipeline-ICM/` is the blog folder tree and the five blog stage prompts. Put it anywhere local and pass it to init with `--template`, or set `CONTENT_PIPELINE_ICM_TEMPLATE`.

The four **page** stage prompts do not need this — they ship inside `pipeline-pages-init/templates/pages/`.

### Companion skills you install separately

These are not in this package but init will want them for the research classes:

`business-dossier`, `dataforseo-onpage-crawl`, `dataforseo-paa-queries`, `dataforseo-fanout-queries`, `product-documentation`, `customer-research`, and `voice-extractor` (only if you run `voice-interview`).

Content Maxima is the exception — the `contentmaxima` ZIP is bundled in `skills/`, because both Matrix steps depend on it.

Init dispatches whichever ones are missing. Anything you cannot run, you supply by hand — init only checks that a real, non-empty file landed in the right place.

## Your first 30 minutes

1. Read [00-suite-map.md](00-suite-map.md). Do not skip it. Almost every support question is someone running a skill out of order.
2. Install the eight skills. Confirm your host lists them.
3. Pick one real campaign folder. Have its website URL and two or three seed keywords ready.
4. Run `content-pipeline-init` on it and let it stop where it stops. Read what it asks for.
5. When it asks 13 weeks or 26, pick **13** for your first campaign.

Do not start with a client campaign you are already behind on. The first run is for learning where the stops are.

## How these skills expect to be talked to

Every skill wants an explicit campaign path. None of them guess.

```text
/content-pipeline-init on C:\work\clients\ridgeline-tree-care
content pipeline run — campaign C:\work\clients\ridgeline-tree-care — gate_mode review
/content-pipeline-pages on C:\work\clients\ridgeline-tree-care slug emergency-service
```

Three habits that will save you hours:

- **Name the path every time.** A skill that has to guess the campaign is a skill about to write into the wrong folder.
- **Let it stop.** When it says a resource class is missing, supply the resource. Do not tell it to continue anyway.
- **Read the manifest, not the transcript.** Progress lives in JSON in the campaign folder. After a context reset that file is the truth.

## Support

Questions about these skills: ask inside Semantic Mastery Mastermind (Bradley Benner).
