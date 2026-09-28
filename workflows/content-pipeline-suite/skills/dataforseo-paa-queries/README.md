# dataforseo-paa-queries

**Semantic Mastery Mastermind** — Bradley Benner  
**License:** Semantic Mastery Member License. See LICENSE-MEMBERS.md at the repository root.

## What this skill does

Pulls Google People Also Ask trees (depth 2) for seed keywords via DataForSEO SERP Live Advanced and saves structured JSON.

## Requirements

- **Node.js 20+** (LTS recommended)
- Network access for API calls

## API keys (bring your own)

Store credentials as **environment variables** (recommended). Do not commit keys into project files.

| Variable | Required |
|---|---|
| `DATAFORSEO_USERNAME` | Yes |
| `DATAFORSEO_PASSWORD` | Yes |

Get credentials from your [DataForSEO](https://dataforseo.com/) account.

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
dataforseo-paa-queries/
  SKILL.md
  README.md
  …
```

Optional: if you use the open skills CLI: `npx skills add <path-or-repo>` when supported by your host.



## Usage

From your project folder:

```bash
node path/to/dataforseo-paa-queries/fetch-paa.mjs --keyword "your keyword" --location_name "City,State,United States"
```

Or ask your AI agent to run the **dataforseo-paa-queries** skill after install.

## Output location

Unless overridden with CLI flags, deliverables write under:

`{project}/outputs/<dataforseo-paa-queries>/`

Run commands with **cwd = your project folder**.

## Attribution

Packaged for Semantic Mastery Mastermind by Bradley Benner.

## Support

Questions about this skill: ask inside Semantic Mastery Mastermind (Bradley Benner).
