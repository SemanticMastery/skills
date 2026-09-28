# content-pipeline-pages

**Version:** 1.2.2  
**Semantic Mastery Mastermind** — Bradley Benner  
**License:** Semantic Mastery Member License. See LICENSE-MEMBERS.md at the repository root.

## What this skill does

Produces **one approved service page** through `p.1-brief` → `p.2-draft` → `p.3-edit` → `p.4-polish`.

1. Gate on **pipeline-pages-init** (`setup_complete` + that slug's Matrix)
2. Run the **evidence gate** (`pd-coverage.mjs`) before any run row exists
3. **Stop** and ask for Algorithm Trigger Words, or authorization for the Count 40+ default
4. Optionally plan an FAQ block from DataForSEO People Also Ask
5. Write brief → draft → edit → polish, pausing per stage in `review` mode
6. Emit two paste-ready builder zones (main copy + FAQs) in Markdown **and** `<article>` HTML

It does **not** generate images, publish, or push to a CMS. Service pages stop at polish.

## How it differs from the blog skill

| | `content-pipeline-run` (blog) | `content-pipeline-pages` (this) |
|---|---|---|
| Stages | 5 (`3.1`–`3.5`, includes images) | 4 (`p.1`–`p.4`, no images) |
| What you pick | A roadmap slot (post number) | An approved slug |
| Keyword input | Editorial Roadmap row + trigger word | Content Maxima Matrix Algorithm Trigger Words |
| Photos | Photo library, then Fal fallback | None |
| Copy host | Session **or** external/local (Zed) | Session only in v1 |
| Output shape | Post markdown + PNGs | Two builder zones, Markdown + HTML |

## Requirements

- **Node.js 20+** (LTS recommended)
- An AI agent host that loads Agent Skills (`SKILL.md`)
- **pipeline-pages-init** at `setup_complete` for this campaign, and a Matrix for the slug
- **content-pipeline-run** installed alongside this skill — it owns three shared contract files this skill cites rather than duplicates:
  - `references/gate-modes.md`
  - `references/copywriting-model.md`
  - `references/voice-dna.md`
- Optional: DataForSEO credentials if you generate FAQs from People Also Ask

## Anthropic is refused

Copy stages will not run on Claude / Sonnet / Opus / Haiku, including `inherit` on a Claude chat. Switch the chat to **Grok 4.6** or **ChatGPT-5.6 Terra** (`cursor-grok-4.6-high-fast` / `gpt-5.6-terra-medium`), or pin another non-Anthropic id.

## Install (universal Agent Skills layout)

Unzip so you get a folder named `content-pipeline-pages` containing `SKILL.md`, then copy it into your host's skills directory.

| Tool | Typical skills directory |
|------|--------------------------|
| Cursor | `.cursor/skills/` (project) or `~/.cursor/skills/` (user) |
| Claude Code / Claude Desktop | `.claude/skills/` or `~/.claude/skills/` |
| Codex / OpenAI agents | `.agents/skills/` or tool-specific skills path |
| OpenCode / other Agent Skills hosts | Project or user `skills/` folder that loads `SKILL.md` |

**Zip layout:**

```text
content-pipeline-pages/
  SKILL.md
  README.md
  references/
  scripts/
```

## Usage

Ask your agent:

- “`/content-pipeline-pages` on `{campaign}` slug `emergency-service`, gate_mode review”
- “content pipeline pages — `{path}` — `deep-root-fertilization`”

Or drive the manifest directly:

```bash
node path/to/content-pipeline-pages/scripts/check-pages-ready.mjs \
  --campaign-dir "/abs/path/to/campaign" --slug emergency-service

node path/to/content-pipeline-pages/scripts/pd-coverage.mjs \
  --campaign-dir "/abs/path/to/campaign" --slug emergency-service

node path/to/content-pipeline-pages/scripts/advance-page.mjs \
  --campaign-dir "/abs/path/to/campaign" --init --slug emergency-service \
  --gate-mode review --copywriting-model inherit
```

## The evidence gate (Step 0b)

`pd-coverage.mjs` reads the product documentation copy and scores how much of the page's evidence grid is actually known.

| Result | Meaning | What happens |
|--------|---------|--------------|
| `pass` | Enough first-party truth to write | Continue |
| `warn` | Thin but workable | Continue; the brief flags the gaps |
| `block` | Too many Unknown / Unverified / Conflict fields | **Stop.** No run row is created. |

On `block`, the message names the **`owner-interview`** skill and the scope slug. Run that skill, refresh product documentation, re-sync, then come back. You may waive a block in chat, and the waiver is persisted with your name — a waived page is a page you chose to write on thin evidence.

## Matrix terms (hard stop before the brief)

No brief gets written until `runs[slug].matrix_terms` is set. You either list the terms for this page, or authorize the default high-impact list (`Count >= 40`).

```bash
node path/to/content-pipeline-pages/scripts/extract-matrix-terms.mjs \
  --campaign-dir "/abs/campaign" --slug emergency-service
```

Selected terms belong in headings and, where they fit naturally, in body copy. They never override the evidence grid — a trigger word in a sentence is still a claim.

## Hardwired copy rules

| Rule | Detail |
|------|--------|
| SEO title | `[Service Name] \| [Company Name]` — no location, no taglines |
| H1 | **Restates** the service as a close variant, Google Ads headline style; the service area is allowed |
| Reading level | 7th–8th grade for all visitor-facing copy |
| FAQ answers | Answer the question first; the phone number comes last |
| Polish output | Two zones (main + FAQs), each in Markdown and `<article>` HTML |

## Output location

| Artifact | Path |
|---|---|
| Brief | `{campaign}/06-content-pipeline/pages/p.1-brief/page-{slug}-brief.md` |
| Draft | `.../pages/p.2-draft/page-{slug}-draft.md` |
| Edit | `.../pages/p.3-edit/page-{slug}-edit.md` |
| Polish | `.../pages/p.4-polish/page-{slug}-polish/page-{slug}-polish.md` |
| Run rows | `{campaign}/06-content-pipeline/pipeline-pages-manifest.json` |

## Companion flowchart

`content-pipeline-pages.png` ships with the suite diagrams.

## Attribution

Packaged for Semantic Mastery Mastermind by Bradley Benner.

## Support

Questions about this skill: ask inside Semantic Mastery Mastermind (Bradley Benner).
