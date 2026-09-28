# schema-markup-generator

**Semantic Mastery Mastermind** — Bradley Benner  
**License:** Apache-2.0. See `../../LICENSE` in this bundle.

**Package:** `schema-markup-generator-v9.15.1.zip` (same version as `SKILL.md` frontmatter `version` / `metadata.version`).

## What this skill does

Generates Schema.org JSON-LD for local / contractor sites (and FAQ, HowTo, Article, Product). Includes Step 0c logo/image/geo gate, Maps CID resolution for `hasMap` / Maps `sameAs`, and Step 2c ContentMaxima geo-trigger extract (Count ≥ 40 → location `WebPage.about`).

## Requirements

- No paid API is required for JSON-LD generation
- Node.js 20+ only if you run `scripts/resolve-maps-cid.mjs`
- A current business dossier (`business-dossier` skill) for local homepage graphs
- Optional: `knowsabout-entity-research` for service/location entity CSVs
- Optional: `contentmaxima` for location-page Algorithm Trigger Words (Step 2c)

## API keys (bring your own)

CID resolve follows Maps redirects (no key). Dossier compose / GBP enrichment lives in the **business-dossier** skill (`GROK_API_KEY`, optional `SERPAPI_API_KEY`).

## Install (universal Agent Skills layout)

Unzip so you get a folder named after the skill containing `SKILL.md`.

Copy that folder into **one** of these locations (create the parent if needed):

| Tool | Typical skills directory |
|------|--------------------------|
| Cursor | `.cursor/skills/` (project) or `~/.cursor/skills/` (user) |
| Claude Code / Claude Desktop | `.claude/skills/` or `~/.claude/skills/` |
| Codex / OpenAI agents | `.agents/skills/` or tool-specific skills path |
| OpenCode / other Agent Skills hosts | Project or user `skills/` folder that loads `SKILL.md` |

**Zip filename:** `schema-markup-generator-v9.15.1.zip`

**Zip layout:**

```text
schema-markup-generator/
  SKILL.md
  README.md
  scripts/resolve-maps-cid.mjs
  scripts/extract-geo-triggers.mjs
  references/
  resources/travel-package-schema.md
  …
```

Keep the zip filename version (`schema-markup-generator-v9.15.1.zip`) so you can tell which release students installed.

Optional: if you use the open skills CLI: `npx skills add <path-or-repo>` when supported by your host.

## Usage

Ask your agent to run **schema-markup-generator**. For local businesses it will stop for NAPW + GBP, then Step 0b (`sameAs`) and Step 0c (logo / image / geo). `hasMap` must be `https://www.google.com/maps?cid={CID}`.

```bash
node scripts/resolve-maps-cid.mjs --url "https://maps.app.goo.gl/..."
```

## Output location

On Golden Image / ICM trees, JSON-LD lives under `{project}/02-deliverables/2.4-schema/`. Otherwise write next to the pages you are marking up, as the user directs.

## Attribution

Upstream skill: [aaron-he-zhu/seo-geo-claude-skills](https://github.com/aaron-he-zhu/seo-geo-claude-skills).  
Ops gates + CID preflight packaged for Semantic Mastery Mastermind by Bradley Benner.

## Support

Questions about this skill: ask inside Semantic Mastery Mastermind (Bradley Benner).
