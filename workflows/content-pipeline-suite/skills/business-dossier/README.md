# business-dossier

**Semantic Mastery Mastermind** — Bradley Benner  
**License:** For enrolled students only. Not for public resale or redistribution outside the program.

## What this skill does

Builds a triangulated local-business dossier (Markdown + DOCX) with SerpAPI/Firecrawl pre-gather and xAI Grok live search synthesis.

## Requirements

- **Node.js 20+** (LTS recommended)
- Network access for API calls
- `npm install` inside `scripts/` (optional `jszip` transitive tooling)
- **Windows** recommended for DOCX generation (PowerShell Compress-Archive)
- Optional: [Firecrawl CLI](https://github.com/firecrawl/firecrawl) authenticated for richer pre-gather
- Optional: [SerpAPI](https://serpapi.com/) key for GBP enrichment

## API keys (bring your own)

Store credentials as **environment variables** (recommended). Do not commit keys into project files.

| Variable | Required |
|---|---|
| `GROK_API_KEY` | Yes |
| `SERPAPI_API_KEY` | Recommended |
| Firecrawl CLI login | Recommended for full pre-gather |

After setting User-level env vars on Windows, restart your IDE/agent so it picks them up.

## Install (universal Agent Skills layout)

Unzip so you get a folder named after the skill containing `SKILL.md`.

Copy that folder into **one** of these locations (create the parent if needed):

| Tool | Typical skills directory |
|------|--------------------------|
| Cursor | `.cursor/skills/` (project) or `~/.cursor/skills/` (user) |
| Claude Code / Claude Desktop | `.claude/skills/` or `~/.claude/skills/` |
| Codex / OpenAI agents | `.agents/skills/` or tool-specific skills path |
| OpenCode / other Agent Skills hosts | Project or user `skills/` folder that loads `SKILL.md` |

**Zip layout:**

```text
business-dossier/
  SKILL.md
  README.md
  …
```

Keep the zip filename version (`business-dossier-v1.3.0.zip`) so you can tell which release students installed.

Optional: if you use the open skills CLI: `npx skills add <path-or-repo>` when supported by your host.

### First-time script setup

```bash
cd business-dossier/scripts
npm install
```

## Usage

Ask your agent to run the **business-dossier** skill with NAPW + GBP URL, or call `scripts/compose-business-dossier.mjs` as shown in `SKILL.md`.

## Output location

Unless overridden with CLI flags, deliverables write under:

`{project}/outputs/business-dossier/`

Run commands with **cwd = your project folder**.

## Attribution

Packaged for Semantic Mastery Mastermind by Bradley Benner.

## Support

Questions about this skill: ask inside Semantic Mastery Mastermind (Bradley Benner).
