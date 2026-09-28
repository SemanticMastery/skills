# pipeline-pages-init

**Version:** 1.0.0  
**Semantic Mastery Mastermind** — Bradley Benner  
**License:** Semantic Mastery Member License. See LICENSE-MEMBERS.md at the repository root.

## What this skill does

Sets up the **service page track** for one campaign. It is the pages-side sibling of `content-pipeline-init`:

1. Read the on-page crawl and product documentation already in `06-content-pipeline/01-resources/`
2. Build a reconciled page table — live pages, catalog offerings, and the leftovers on either side
3. **Stop** for your include / skip / defer decision on every leftover
4. **Stop** again for the commercial-intent Matrix seed table
5. Run one Content Maxima Matrix per approved page
6. Mark `setup_complete` and hand off to `content-pipeline-pages`

It does **not** write page copy, generate images, or push to a CMS.

## Requirements

- **Node.js 20+** (LTS recommended)
- An AI agent host that loads Agent Skills (`SKILL.md`)
- A campaign folder where **content-pipeline-init** already filled `01-resources/` with:
  - `onpage-crawl-*.csv`
  - `Product-Documentation.md`
- Content Maxima access for the Matrix step (your own login; `npx --yes tsx Tools/Matrix.ts`)

## Prerequisite skill

Install and run **content-pipeline-init** first. The pages track reads the same research pack the blog track reads — you do not build a second one.

You do **not** need the blog ICM template for pages. The four page stage prompts ship in this skill's `templates/pages/`.

## Install (universal Agent Skills layout)

Unzip so you get a folder named `pipeline-pages-init` containing `SKILL.md`.

Copy that folder into **one** of these locations (create the parent if needed):

| Tool | Typical skills directory |
|------|--------------------------|
| Cursor | `.cursor/skills/` (project) or `~/.cursor/skills/` (user) |
| Claude Code / Claude Desktop | `.claude/skills/` or `~/.claude/skills/` |
| Codex / OpenAI agents | `.agents/skills/` or tool-specific skills path |
| OpenCode / other Agent Skills hosts | Project or user `skills/` folder that loads `SKILL.md` |

**Zip layout:**

```text
pipeline-pages-init/
  SKILL.md
  README.md
  references/
  scripts/
  templates/pages/
```

## Usage

Ask your agent:

- “`/pipeline-pages-init` on `{campaign}`”
- “pipeline pages init — campaign `{path}`”

Or drive the manifest directly:

```bash
node path/to/pipeline-pages-init/scripts/scaffold-pages.mjs \
  --campaign-dir "/abs/path/to/campaign"

node path/to/pipeline-pages-init/scripts/extract-pages.mjs \
  --campaign-dir "/abs/path/to/campaign" --write

node path/to/pipeline-pages-init/scripts/pages-manifest.mjs \
  --campaign-dir "/abs/path/to/campaign" --approve-list --apply-seeds --write-projection
```

## The two human stops

This skill is deliberately not fire-and-forget. It stops twice.

| Stop | Status | What you decide |
|------|--------|-----------------|
| Reconcile | leftovers flagged | Include, skip, or defer each crawl-only and catalog-only row |
| Seed confirm | `awaiting_seed_confirm` | Approve the commercial-intent Matrix seed for every included page |

Nothing runs Content Maxima until you clear the second stop. Matrix runs cost time and hit a real login.

## Seed rules

Seeds are derived, not invented — see `references/seed-rules.md`.

| Input | Seed |
|-------|------|
| tree removal | tree removal service |
| stump grinding | stump grinding service |
| oak wilt treatment | oak wilt treatment |
| emergency service | emergency service |

` service` is appended unless the last token is already `service`, `services`, `treatment`, `response`, `plan`, or `plans`.

## Output location

| Artifact | Path |
|---|---|
| Page tree + stage prompts | `{campaign}/06-content-pipeline/pages/` |
| One Matrix per page | `{campaign}/06-content-pipeline/pages/matrix/{slug}/` |
| Setup manifest | `{campaign}/06-content-pipeline/pipeline-pages-manifest.json` |
| Readable projection | `{campaign}/06-content-pipeline/pages/CONTEXT.md` routing row (proposed, appended only on your OK) |

## Next skill

**`content-pipeline-pages`** — one approved slug through brief → draft → edit → polish. It stops before the brief to ask for Algorithm Trigger Words.

If that skill's evidence gate blocks a slug, run **`owner-interview`** to get first-party delivery facts, refresh product documentation, and come back.

## Companion flowchart

`pipeline-pages-init.png` ships with the suite diagrams.

## Attribution

Packaged for Semantic Mastery Mastermind by Bradley Benner.

## Support

Questions about this skill: ask inside Semantic Mastery Mastermind (Bradley Benner).
