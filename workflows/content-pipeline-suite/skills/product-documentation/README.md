# product-documentation

**Semantic Mastery Mastermind** — Bradley Benner  
**License:** Semantic Mastery Member License. See LICENSE-MEMBERS.md at the repository root.

## What this skill does

Creates or refreshes a client's canonical **Product-Documentation.md** — durable product/service truth — from a business dossier, on-page crawl, optional EntityMap, and other intake documents. Hard-stops when required inputs are missing unless the operator waives them (continue-without or greenfield stub).

## Requirements

- An AI agent host that loads Agent Skills (`SKILL.md`)
- No Node scripts or paid APIs required by this skill itself
- Recommended companion skills for prerequisites:
  - `business-dossier`
  - `dataforseo-onpage-crawl`

## API keys (bring your own)

This skill does **not** call paid APIs directly. Companion skills may require their own env vars (DataForSEO, Grok, SerpAPI, etc.).

## Install (universal Agent Skills layout)

Unzip so you get a folder named `product-documentation` containing `SKILL.md`.

Copy that folder into **one** of these locations (create the parent if needed):

| Tool | Typical skills directory |
|------|--------------------------|
| Cursor | `.cursor/skills/` (project) or `~/.cursor/skills/` (user) |
| Claude Code / Claude Desktop | `.claude/skills/` or `~/.claude/skills/` |
| Codex / OpenAI agents | `.agents/skills/` or tool-specific skills path |
| OpenCode / other Agent Skills hosts | Project or user `skills/` folder that loads `SKILL.md` |

**Zip layout:**

```text
product-documentation/
  SKILL.md
  README.md
  references/canonical-artifact.md
  references/greenfield-stub.md
  evals/evals.json
```

Optional: if you use the open skills CLI: `npx skills add <path-or-repo>` when supported by your host.

## Usage

Ask your agent to run **product-documentation** for a project that already has (or will produce) a business dossier and on-page crawl.

Example prompts:

- “Create product documentation for this client from the dossier and on-page crawl.”
- “Refresh Product-Documentation.md from current sources.”
- “/product-documentation --stub” or “greenfield stub” when dossier and crawl are absent and the operator will confirm the offering list. `--stub` is an invocation phrase, not a CLI.

## Output location

The one canonical file is `{campaign-root}/01-intake/1.1-docs/Product-Documentation.md`. The `{campaign-root}/06-content-pipeline/01-resources/Product-Documentation.md` copy is a mirror for the content pipeline: `content-pipeline-init` `scripts/sync-resources.mjs` refreshes it from the canonical. This skill never writes the mirror.

Do **not** create `{campaign-root}/outputs/product-documentation/` or a new `06-content-pipeline/` tree from this skill.

Expected companion inputs:

| Input | Default path |
|---|---|
| Business dossier | `{campaign-root}/01-intake/1.1-docs/*Dossier*.md` |
| On-page crawl | `{campaign-root}/01-intake/1.2-audit/onpage-crawl-*.csv` |

Legacy read-only fallbacks under `outputs/` are accepted for inputs only.

## Attribution

Packaged for Semantic Mastery Mastermind by Bradley Benner.

## Support

Questions about this skill: ask inside Semantic Mastery Mastermind (Bradley Benner).
