# dataforseo-fanout-queries

**Semantic Mastery Mastermind** — Bradley Benner  
**License:** Semantic Mastery Member License. See LICENSE-MEMBERS.md at the repository root.

## What this skill does

Generates a research-grade query fan-out list from a seed keyword using DataForSEO ChatGPT LLM Responses Live (JSON + CSV).

## Requirements

- **Node.js 20+** (LTS recommended)
- Network access for API calls

## API keys (bring your own)

Store credentials as **environment variables** (recommended). Do not commit keys into project files.

| Variable | Required |
|---|---|
| `DATAFORSEO_USERNAME` | Yes |
| `DATAFORSEO_PASSWORD` | Yes |

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
dataforseo-fanout-queries/
  SKILL.md
  README.md
  …
```

Optional: if you use the open skills CLI: `npx skills add <path-or-repo>` when supported by your host.



## Usage

```bash
node path/to/dataforseo-fanout-queries/fetch-fanout.js --keyword "your seed keyword" --count 120
```

## Output location

Unless overridden with CLI flags, deliverables write under:

`{project}/outputs/<dataforseo-fanout-queries>/`

Run commands with **cwd = your project folder**.

## Attribution

Packaged for Semantic Mastery Mastermind by Bradley Benner.

## Support

Questions about this skill: ask inside Semantic Mastery Mastermind (Bradley Benner).
