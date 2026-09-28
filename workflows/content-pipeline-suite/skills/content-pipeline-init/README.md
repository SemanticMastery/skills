# content-pipeline-init

**Version:** 1.1.0  
**Semantic Mastery Mastermind** — Bradley Benner  
**License:** Semantic Mastery Member License. See LICENSE-MEMBERS.md at the repository root.

## What this skill does

Orchestrates **content pipeline initialization** for one campaign/project folder:

1. Scaffold `06-content-pipeline/` from the Content-Pipeline-ICM template
2. Inventory eight required research resources
3. Run only the **missing** companion skills (dependency waves)
4. Copy the agent resource pack into `06-content-pipeline/01-resources/`
5. Write the Editorial Roadmap and SiteSwarm tag taxonomy in `02-plan/`

It does **not** produce 03-write slots (brief → images). That is `content-pipeline-run`.

## Version notes

| Version | Scope |
|---------|--------|
| **1.0.0** | Scaffold, inventory eight resources, companion waves, copy into `01-resources/`. |
| **1.1.0** (this package) | Also writes the Editorial Roadmap and SiteSwarm tag taxonomy in `02-plan/` (required for `init_complete`). After init, run `content-pipeline-photo-library` if installed, then `content-pipeline-run`. |

Keep the zip filename version (`content-pipeline-init-v1.1.0.zip`) so you can tell which release students installed.

## Requirements

- **Node.js 20+** (LTS recommended)
- An AI agent host that loads Agent Skills (`SKILL.md`)
- Local copy of the **Content-Pipeline-ICM** template (`content-pipeline-icm.zip`)
- Companion skills installed as needed (see below)

## API keys (bring your own)

This orchestrator does **not** call paid APIs directly. Companion skills may require:

| Variable / tool | Used by |
|---|---|
| `DATAFORSEO_USERNAME` / `DATAFORSEO_PASSWORD` | PAA, fanout, on-page crawl |
| `GROK_API_KEY` | business-dossier compose |
| Content Maxima credentials | matrix / personas exports |

Do not commit keys into project files. Restart your IDE/agent after setting env vars.

## Install (universal Agent Skills layout)

**Zip layout (Claude-compatible):** `SKILL.md` is at the **archive root** (not nested under a skill folder). That matches Claude.ai / Claude Desktop skill upload.

| Host | How to install |
|------|----------------|
| Claude.ai / Claude Desktop (Skills upload) | Upload the `.zip` as-is |
| Cursor / Claude Code / other Agent Skills hosts | Unzip into a folder named `content-pipeline-init`, then copy that folder into a skills directory below |

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
```

Also unzip **content-pipeline-icm.zip** to a stable local path (template tree for scaffolding).

Optional: if you use the open skills CLI: `npx skills add <path-or-repo>` when supported by your host.

## Companion skills

Install from other Semantic Mastery Shareable ZIPs as needed:

- `business-dossier`
- `dataforseo-onpage-crawl`
- `dataforseo-paa-queries`
- `dataforseo-fanout-queries`
- `product-documentation`
- `customer-research`
- Content Maxima (or equivalent) for matrix / personas
- `content-pipeline-photo-library` (after `init_complete`, setup operator)
- `content-pipeline-run` (writers, after photo-library HITL)

## Usage

Ask your agent to run **content-pipeline-init** with an explicit campaign/project path.

Or run scripts directly:

```bash
node path/to/content-pipeline-init/scripts/scaffold-icm.mjs \
  --campaign-dir "/abs/path/to/campaign" \
  --template "/abs/path/to/Content-Pipeline-ICM"

node path/to/content-pipeline-init/scripts/inventory-resources.mjs \
  --campaign-dir "/abs/path/to/campaign" --write-manifest

node path/to/content-pipeline-init/scripts/sync-resources.mjs \
  --campaign-dir "/abs/path/to/campaign"
```

You can set `CONTENT_PIPELINE_ICM_TEMPLATE` instead of passing `--template` every time.

## Output location

| Artifact | Path |
|---|---|
| Pipeline ICM tree | `{campaign}/06-content-pipeline/` |
| Agent resource pack | `{campaign}/06-content-pipeline/01-resources/` |
| Editorial roadmap + SiteSwarm taxonomy | `{campaign}/06-content-pipeline/02-plan/` |
| Init manifest | `{campaign}/06-content-pipeline/content-pipeline-init-manifest.json` |

Research sources typically live under `01-intake/` and/or `outputs/` (companion skills); this skill **copies** into `01-resources/` and does not rewrite sources.

## Companion flowchart

Optional coaching visual (ships next to this zip in Shareable): `content-pipeline-init-flowchart.png` (suite set also includes photo-library + run diagrams).

## Attribution

Packaged for Semantic Mastery Mastermind by Bradley Benner.

## Support

Questions about this skill: ask inside Semantic Mastery Mastermind (Bradley Benner).
