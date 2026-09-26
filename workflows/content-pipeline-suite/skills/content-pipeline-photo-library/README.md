# content-pipeline-photo-library

**Version:** 1.8.0  
**Semantic Mastery Mastermind** — Bradley Benner  
**License:** For enrolled students only. Not for public resale or redistribution outside the program.

## What this skill does

Orchestrates **per-campaign photo library setup** for one campaign/project folder:

1. Gate on prior **content-pipeline-init** (`init_complete` + SiteSwarm tag taxonomy in `02-plan/`)
2. Ingest page-owned GBP By-owner, Facebook, and Instagram stills into `01-resources/image-library/`
3. Classify evergreen candidates with a **campaign-owned** Gemini prompt
4. Require human approve / reject / retag before anything is library-ready

It does **not** produce 03-write slots, publish to a CMS, or generate Fal images. Writers consume `approved/` later via **content-pipeline-run** at `3.5-images`.

## Requirements

- **Node.js 20+** (LTS recommended)
- An AI agent host that loads Agent Skills (`SKILL.md`)
- Campaign folder with `06-content-pipeline/` already initialized via **content-pipeline-init**
- SiteSwarm tag taxonomy present (`02-plan/siteswarm-tag-taxonomy.md`)
- Stage `CONTEXT.md` Agent prompts present (from Content-Pipeline-ICM template — see `content-pipeline-icm.zip`)

## Prerequisite skill

Install and run **content-pipeline-init** first until:

- `06-content-pipeline/content-pipeline-init-manifest.json` has `status: init_complete`
- `02-plan/editorial-roadmap.md` and a SiteSwarm tag taxonomy exist (init-owned)

Then run **this** skill (setup operator). After HITL, the writing team can run **content-pipeline-run**.

## API keys (bring your own)

| Variable / tool | Used by |
|---|---|
| `SERPAPI_API_KEY` | GBP Photos → By owner (`scripts/gbp-serpapi-owner.mjs`) |
| `GEMINI_API_KEY` | Classify dispatch (`scripts/classify.mjs`) |
| `PHOTO_LIBRARY_GEMINI_MODEL` | Optional. Default `gemini-2.5-flash` |
| Monid (optional) | Facebook / Instagram discover → inspect → run |

Do not commit keys into project files. Restart your IDE/agent after setting env vars.

## Install (universal Agent Skills layout)

**Zip layout (Claude-compatible):** `SKILL.md` is at the **archive root** (not nested under a skill folder). That matches Claude.ai / Claude Desktop skill upload.

| Host | How to install |
|------|----------------|
| Claude.ai / Claude Desktop (Skills upload) | Upload the `.zip` as-is |
| Cursor / Claude Code / other Agent Skills hosts | Unzip into a folder named `content-pipeline-photo-library`, then copy that folder into a skills directory below |

| Tool | Typical skills directory |
|------|--------------------------|
| Cursor | `.cursor/skills/` (project) or `~/.cursor/skills/` (user) |
| Claude Code / Claude Desktop (folder install) | `.claude/skills/` or `~/.claude/skills/` |
| Codex / OpenAI agents | `.agents/skills/` or tool-specific skills path |
| OpenCode / other Agent Skills hosts | Project or user `skills/` folder that loads `SKILL.md` |

**Zip contents:**

```text
SKILL.md
README.md
references/
scripts/
templates/
```

Also install **content-pipeline-init** and unzip **content-pipeline-icm.zip** for the pipeline tree / stage CONTEXT prompts.

Optional: if you use the open skills CLI: `npx skills add <path-or-repo>` when supported by your host.

## Companion skills

Install from other Semantic Mastery Shareable ZIPs as needed:

- `content-pipeline-init` (required first)
- `content-pipeline-run` (writers, after HITL)
- Content-Pipeline-ICM template (`content-pipeline-icm.zip`)

## Usage

Ask your agent to run **content-pipeline-photo-library** with an explicit campaign/project path.

Example phrases:

- “Run content-pipeline-photo-library on `{campaign}`”
- “Ingest campaign photos and build the image library”
- “Approve library photos for `{campaign}`”

Or run scripts directly:

```bash
node path/to/content-pipeline-photo-library/scripts/gbp-serpapi-owner.mjs \
  --campaign-dir "/abs/path/to/campaign" --q "Brand Name"

node path/to/content-pipeline-photo-library/scripts/ingest.mjs \
  --campaign-dir "/abs/path/to/campaign" --payloads payloads.json

node path/to/content-pipeline-photo-library/scripts/classify.mjs \
  --campaign-dir "/abs/path/to/campaign"

node path/to/content-pipeline-photo-library/scripts/apply-review.mjs \
  --campaign-dir "/abs/path/to/campaign" --approve ig_123

node path/to/content-pipeline-photo-library/scripts/seed-helpers.mjs \
  --campaign-dir "/abs/path/to/campaign"
```

Copy `templates/classify.mjs` into `{campaign}/06-content-pipeline/01-resources/image-library/classify.mjs`, edit KEEP / OFF_TOPIC for that business, and set `CLASSIFIER_READY = true` before classify.

## Output location

| Artifact | Path |
|---|---|
| Library home | `{campaign}/06-content-pipeline/01-resources/image-library/` |
| Inbox / review / approved | `image-library/inbox/` · `review/` · `approved/` |
| Manifest + HITL queue | `image-library/library-manifest.json` · `review-queue.md` |
| Campaign classifier | `image-library/classify.mjs` |

| Writer helpers (v1.8.0) | `{campaign}/06-content-pipeline/scripts/` (`match-library.mjs`, `fal-generate.mjs` when `content-pipeline-run` is a sibling install, `check-helpers.mjs`) |

`content-pipeline-run` later copies approved hits into `03-write/3.5-images/` at consume time. Do not mix library binaries into `3.5-images/` except those copies. After HITL (or `seed-helpers.mjs`), writers must run the **campaign** helper paths — not `{skill_root}`.

## Companion flowchart

Optional coaching visual (ships next to this zip in Shareable): `content-pipeline-photo-library-flowchart.png` (suite set also includes init + run diagrams).

## Attribution

Packaged for Semantic Mastery Mastermind by Bradley Benner.

## Support

Questions about this skill: ask inside Semantic Mastery Mastermind (Bradley Benner).
