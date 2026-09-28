# dataforseo-onpage-crawl

**Semantic Mastery Mastermind** — Bradley Benner  
**License:** Semantic Mastery Member License. See LICENSE-MEMBERS.md at the repository root.

## What this skill does

Runs a production-style DataForSEO OnPage full-domain crawl with sitemap expansion, JS/WAF handling, and CSV/XLSX deliverables.

## Requirements

- **Node.js 20+** (LTS recommended)
- Network access for API calls
- Run `npm install` inside this skill folder (depends on `xlsx`)

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
dataforseo-onpage-crawl/
  SKILL.md
  README.md
  …
```

Optional: if you use the open skills CLI: `npx skills add <path-or-repo>` when supported by your host.

### npm install

```bash
cd dataforseo-onpage-crawl
npm install
```


## Usage

From your **project** folder (after `npm install` in the skill folder):

```bash
node path/to/dataforseo-onpage-crawl/scripts/crawl-domain.mjs --domain example.com --project-dir . --post-only
```

Then poll with `scripts/check-task.mjs --wait` and finish with `--task-id` to write CSV/XLSX under `outputs/dataforseo-onpage-crawl/`.

## Output location

Unless overridden with CLI flags, deliverables write under:

`{project}/outputs/<dataforseo-onpage-crawl>/`

Run commands with **cwd = your project folder**.

## Attribution

Packaged for Semantic Mastery Mastermind by Bradley Benner.

## Support

Questions about this skill: ask inside Semantic Mastery Mastermind (Bradley Benner).
