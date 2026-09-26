# customer-research

**Semantic Mastery Mastermind** — Bradley Benner  
**License:** For enrolled students only. Not for public resale or redistribution outside the program.

## What this skill does

Expert workflow for analyzing existing customer research assets and gathering VOC from communities, reviews, and interviews (JTBD, personas, watering holes).

## Requirements

- No Node scripts required
- Web browsing / search tools in your IDE agent improve Mode 2 research

## API keys (bring your own)

Store credentials as **environment variables** (recommended). Do not commit keys into project files.

No paid API keys are required by the skill itself. Optional tools your agent may use (browser, Reddit, review sites) follow that tool’s own auth.

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
customer-research/
  SKILL.md
  README.md
  …
```

Optional: if you use the open skills CLI: `npx skills add <path-or-repo>` when supported by your host.



## Usage

After install, ask your agent to run **customer-research** (e.g. “mine G2 + Reddit for why customers churn”). Save written outputs under `outputs/customer-research/`.

## Output location

Unless overridden with CLI flags, deliverables write under:

`{project}/outputs/<customer-research>/`

Run commands with **cwd = your project folder**.

## Attribution

Original skill author: **Corey Haines** ([github.com/coreyhaines31](https://github.com/coreyhaines31)) — see also the [marketingskills](https://github.com/coreyhaines31/marketingskills) collection.

Repackaged for Semantic Mastery Mastermind students by Bradley Benner.

## Support

Questions about this skill: ask inside Semantic Mastery Mastermind (Bradley Benner).
