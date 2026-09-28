# content-pipeline-run

**Version:** 1.5.0  
**Semantic Mastery Mastermind** — Bradley Benner  
**License:** Semantic Mastery Member License. See LICENSE-MEMBERS.md at the repository root.

## What this skill does

Orchestrates **content pipeline editorial execution** for one campaign/project folder:

1. Gate on prior **content-pipeline-init** (`init_complete` + resources in `01-resources/` + Editorial Roadmap + SiteSwarm tag taxonomy in `02-plan/`)
2. Consume the existing roadmap (do not create or rebuild it)
3. Produce **one plan slot** through `3.1-brief` → `3.2-draft` → `3.3-edit` → `3.4-polish` → `3.5-images`
4. Pause after each produce stage (`gate_mode=review`) or auto-chain (`gate_mode=auto`)

It does **not** initialize research resources, publish to a CMS, or archive runs.

## Version notes

| Version | Scope |
|---------|--------|
| **1.0.0** | Plan + produce through polish. Hard-stop after `3.4-polish`. |
| **1.1.0** | Adds `3.5-images` from polish placeholders. Hard-stop after `3.5-images`. Does **not** drive `04-publish/` or `05-archives/`. |
| **1.1.1** | `3.5-images` uses Fal.ai FLUX.2 Pro (`scripts/fal-generate.mjs`, `FAL_AI_API_KEY` or `FAL_KEY`) with a client-library-first hook. Cursor GenerateImage is not the engine. |
| **1.2.0** | First-run **copywriting model** selector. Persist `copywriting_model` (`inherit` or a pinned id). Default if skipped: inherit. Never default to Claude/Anthropic. |
| **1.3.0** | `copywriting_via=external` + optional `copywriting_host` (e.g. Zed). |
| **1.3.1** | External 03-write is **one stay**: complete 3.1→3.4 in Zed, then return once for `3.5-images`. No bounce after each stage. |
| **1.3.2** | External-host handoff is one stay, not a per-stage bounce. |
| **1.3.3** | **Anthropic/Claude prohibited** for copy stages (watermarking). Cursor-session suggestion: **Grok 4.6** or **ChatGPT-5.6 Terra**. External/local (Zed) remains optional. |
| **1.4.0** | After the editorial roadmap exists, map topic clusters to condensed SiteSwarm tags (`02-plan/siteswarm-tag-taxonomy.md`). Overlapping clusters share a tag. Not CMS publish. |
| **1.5.0** (this package) | Plan + SiteSwarm taxonomy move to **content-pipeline-init**. This skill is produce-only. |
| Later | Publishing instructions will be added to the campaign `04-publish/CONTEXT.md` and this skill will gain a publish step. |

Keep the zip filename version (`content-pipeline-run-v1.3.3.zip`) so you can tell which release students installed when publish support ships.

## Requirements

- **Node.js 20+** (LTS recommended)
- An AI agent host that loads Agent Skills (`SKILL.md`)
- Campaign folder with `06-content-pipeline/` already initialized via **content-pipeline-init**
- Stage `CONTEXT.md` Agent prompts present (from Content-Pipeline-ICM template — see `content-pipeline-icm.zip`)
- **`FAL_AI_API_KEY`** (preferred User env name) or **`FAL_KEY`** for `3.5-images` Fal generations (User env or skill-local `.env` from `.env.example`). Never commit the key.

## Prerequisite skill

Install and run **content-pipeline-init** first until:

- `06-content-pipeline/content-pipeline-init-manifest.json` has `status: init_complete`
- All eight research classes + `ai-isms.md` exist under `06-content-pipeline/01-resources/`
- `02-plan/editorial-roadmap.md` and a SiteSwarm tag taxonomy exist (init-owned)

## Install (universal Agent Skills layout)

Unzip so you get a folder named `content-pipeline-run` containing `SKILL.md`.

Copy that folder into **one** of these locations (create the parent if needed):

| Tool | Typical skills directory |
|------|--------------------------|
| Cursor | `.cursor/skills/` (project) or `~/.cursor/skills/` (user) |
| Claude Code / Claude Desktop | `.claude/skills/` or `~/.claude/skills/` |
| Codex / OpenAI agents | `.agents/skills/` or tool-specific skills path |
| OpenCode / other Agent Skills hosts | Project or user `skills/` folder that loads `SKILL.md` |

**Zip layout:**

```text
content-pipeline-run/
  SKILL.md
  README.md
  references/
  scripts/
```

Also install **content-pipeline-init** and unzip **content-pipeline-icm.zip** for the stage CONTEXT prompts / tree template.

Optional: if you use the open skills CLI: `npx skills add <path-or-repo>` when supported by your host.

## Usage

Ask your agent to run **content-pipeline-run** with:

1. Explicit campaign/project path
2. **`gate_mode`**: `review` (pause after every stage) or `auto` (chain brief→images after plan + slot)
3. **`copywriting_model`**: Cursor session (`inherit` or pin) or **external/local** (Zed, etc.). Ask once on first run. Cursor-session suggestion: **Grok 4.6** or **ChatGPT-5.6 Terra**. **Anthropic/Claude is prohibited** (watermarking). If you skip and this chat is not Anthropic, the skill stores `inherit` + `session`.

Example phrases:

- “Run content-pipeline-run on `{campaign}` with gate_mode review”
- “Content pipeline run — auto mode — campaign `{path}`”
- “Pin copywriting to Grok 4.6”
- “Pin copywriting to ChatGPT-5.6 Terra (`gpt-5.6-terra-medium`)”
- “Use inherit for copywriting” (only if this chat is not Claude)
- “Run 03-write in Zed on Copywriter-Gemma4-31B”

Or drive the manifest with scripts:

```bash
node path/to/content-pipeline-run/scripts/check-ready.mjs \
  --campaign-dir "/abs/path/to/campaign"

node path/to/content-pipeline-run/scripts/advance-run.mjs \
  --campaign-dir "/abs/path/to/campaign" \
  --init --gate-mode review --copywriting-model inherit

node path/to/content-pipeline-run/scripts/status-run.mjs \
  --campaign-dir "/abs/path/to/campaign"
```

### Gate modes

| Mode | When to use |
|------|-------------|
| `review` | New campaigns; manually OK each stage before continuing |
| `auto` | Trusted process; after slot pick, chain 3.1→3.5 |

### Copywriting model

Asked on first run (same turn as `gate_mode`). Stored as `copywriting_model` on the run manifest.

| Value | When to use |
|-------|-------------|
| `inherit` | Use the model already running this chat. Use this if that chat is already **Grok 4.6** or **ChatGPT-5.6 Terra** (or another non-Anthropic Cursor model). |
| A pinned id | Exact slug. Cursor suggestions: `cursor-grok-4.6-high-fast` (Grok 4.6) or `gpt-5.6-terra-medium` (ChatGPT-5.6 Terra). A custom/local tag is OK with `copywriting_via=external`. Applies to brief / draft / edit / polish only. |

**Anthropic/Claude is prohibited** for copy stages — do not pin it, do not inherit a Claude chat, and do not silently switch to it. Change later with `--set-copywriting-model`. If a pinned id cannot be dispatched on your host, the agent must stop and ask — it must not silently switch models.

To run **03-write** (brief→polish) in another app already connected to the copy model (Zed + Copywriter-Gemma4-31B is the reference):

```bash
node path/to/content-pipeline-run/scripts/advance-run.mjs \
  --campaign-dir "/abs/path/to/campaign" \
  --set-copywriting-model copywriter-gemma4-31b \
  --set-copywriting-via external \
  --set-copywriting-host zed
```

Open the **campaign directory** in that app. Stay there through **3.1-brief → 3.4-polish** (follow each stage `CONTEXT.md` verbatim). Come back here **once** after polish for `3.5-images`. Do not switch back after each write stage. The Editorial Roadmap is created by **content-pipeline-init**, not here.

```bash
node path/to/content-pipeline-run/scripts/advance-run.mjs \
  --campaign-dir "/abs/path/to/campaign" \
  --set-copywriting-model inherit
```

### Artifact locations

| Stage | File |
|-------|------|
| Plan | `06-content-pipeline/02-plan/editorial-roadmap.md` |
| SiteSwarm tags | `06-content-pipeline/02-plan/siteswarm-tag-taxonomy.md` |
| Brief | `03-write/3.1-brief/post-{NN}-brief.md` |
| Draft | `03-write/3.2-draft/post-{NN}-draft.md` |
| Edit | `03-write/3.3-edit/post-{NN}-edit.md` |
| Polish | `03-write/3.4-polish/post-{NN}-polish/post-{NN}-polish.md` |
| Images | `03-write/3.5-images/post-{NN}-images/post-{NN}-images.md` + `post-{NN}-img-{KK}.png` |

Run progress: `06-content-pipeline/content-pipeline-run-manifest.json`

## Output location

| Artifact | Path |
|---|---|
| Roadmap + SiteSwarm tag taxonomy | `{campaign}/06-content-pipeline/02-plan/` |
| Produce chain | `{campaign}/06-content-pipeline/03-write/3.x-*/` |
| Run manifest | `{campaign}/06-content-pipeline/content-pipeline-run-manifest.json` |

## Companion flowchart

Optional coaching visual (ships next to this zip in Shareable): `content-pipeline-run-flowchart.png` (suite set also includes init + photo-library diagrams).

## Attribution

Packaged for Semantic Mastery Mastermind by Bradley Benner.

## Support

Questions about this skill: ask inside Semantic Mastery Mastermind (Bradley Benner).
