# owner-interview

**Version:** 1.2.4  
**Semantic Mastery Mastermind** — Bradley Benner  
**License:** Semantic Mastery Member License. See LICENSE-MEMBERS.md at the repository root.

## What this skill does

Turns the **Unknown / Unverified / Conflict** fields in a campaign's product documentation into questions the business owner can actually answer, captures the answers as a cited intake record, and prepares a tagged refresh diff for `product-documentation`.

1. Extract typed gaps per offering (or company-wide) from product documentation
2. Draft an interview pack and render it as `.json` + `.md`
3. Interview the owner — by call, by filled pack, in chat, or through your own hosted voice agent
4. Record answers against question IDs after you confirm the mapping
5. Compile a tagged refresh plan and hand it to `product-documentation`
6. Re-sync the campaign resource copy so produce sees the new truth

It does **not** write visitor-facing copy, and it never invents a fact the owner did not say.

## Why it exists

`content-pipeline-pages` runs an evidence gate before it writes a page. When a service page's evidence grid is mostly Unknown, the honest fix is not better prompting — it is asking the owner. This skill is that loop.

```text
content-pipeline-pages Step 0b  ->  block
   owner-interview: gaps -> pack -> interview -> record -> compile
   product-documentation refresh (confirm before overwrite)
   content-pipeline-init sync-resources.mjs
content-pipeline-pages  ->  pass
```

## Requirements

- **Node.js 20+** (LTS recommended)
- An AI agent host that loads Agent Skills (`SKILL.md`)
- A campaign with `01-intake/1.1-docs/Product-Documentation.md`
- **product-documentation** installed — it owns the refresh and the source precedence
- **content-pipeline-init** installed — its `scripts/sync-resources.mjs` owns re-sync
- Optional (voice only): a Retell AI account and your own deployed voice host

## Two ways to run the interview

| Path | What you need | When to use it |
|------|---------------|----------------|
| **Notes** (default) | Nothing extra | A call you take yourself, a filled-in pack, or a chat with the owner |
| **Voice** (optional) | Retell AI key + your own deployed host Worker | The owner will not sit for a call, but will click a link and talk |

The notes path is complete on its own. Voice is a convenience, not a requirement.

## Voice setup (deploy your own)

Voice hosting is **not** part of this skill folder. The suite ships a deployable Cloudflare Worker at `voice-host/`, and the full walkthrough lives in `tutorial/09-retell-voice-setup.md`.

Short version:

1. Create a Retell AI account, get an API key
2. `wrangler login` to **your** Cloudflare account, then deploy `voice-host/`
3. `wrangler secret put RETELL_API_KEY` / `OWNER_INTERVIEW_HOST_TOKEN` (optional `RETELL_WEBHOOK_KEY`)
4. `node scripts/setup-agent.mjs --worker-url https://<your-worker> --apply` to create the agent, then `--verify`
5. Set three user env vars this skill reads: `RETELL_API_KEY`, `OWNER_INTERVIEW_HOST_TOKEN`, `OWNER_INTERVIEW_HOST_URL`

Nothing is hosted for you. Every link your owners open runs on infrastructure you control.

## Install (universal Agent Skills layout)

Unzip so you get a folder named `owner-interview` containing `SKILL.md`, then copy it into your host's skills directory.

| Tool | Typical skills directory |
|------|--------------------------|
| Cursor | `.cursor/skills/` (project) or `~/.cursor/skills/` (user) |
| Claude Code / Claude Desktop | `.claude/skills/` or `~/.claude/skills/` |
| Codex / OpenAI agents | `.agents/skills/` or tool-specific skills path |
| OpenCode / other Agent Skills hosts | Project or user `skills/` folder that loads `SKILL.md` |

**Zip layout:**

```text
owner-interview/
  SKILL.md
  README.md
  references/
    industry-seeds/
  scripts/
```

## Usage

Ask your agent:

- “`/owner-interview` on `{campaign}` for `emergency-service`”
- “owner interview — company scope — `{path}`”

Or run the scripts:

```bash
node path/to/owner-interview/scripts/interview-gaps.mjs \
  --campaign-dir "/abs/path/to/campaign" --scope deep-root-fertilization

node path/to/owner-interview/scripts/interview-pack.mjs \
  --campaign-dir "/abs/path/to/campaign" --scope deep-root-fertilization --draft draft.json

node path/to/owner-interview/scripts/interview-record.mjs \
  --campaign-dir "/abs/path/to/campaign" --create --scope deep-root-fertilization

node path/to/owner-interview/scripts/interview-compile-plan.mjs \
  --campaign-dir "/abs/path/to/campaign" --scope deep-root-fertilization
```

## Rules that protect the record

| Rule | Why |
|------|-----|
| You confirm the note-to-question mapping before any answer is written | Stops the agent from deciding what the owner meant |
| Unmapped notes land under `## Unmapped notes` and are never compiled | Nothing sneaks into product documentation unreviewed |
| No `--from-notes` parser exists | Free-text parsing is where invented facts come from |
| Record state machine is `open → captured → compiled → superseded` | Illegal transitions exit 1 |
| Compile stops and hands off | `product-documentation` owns the overwrite, and you confirm it |

## Industry seeds

`references/industry-seeds/tree-care.md` is a worked example, not a limit. Write one seed file per industry you serve. Seeds suggest **questions to ask** — they never assert facts about the business.

## Output location

| Artifact | Path |
|---|---|
| Interview pack | `{campaign}/01-intake/1.1-docs/interviews/owner/{Company}-owner-interview-{scope}-{date}.json` + `.md` |
| Intake record | same folder, same stem convention (JSON is authoritative) |
| Compile plan | tagged refresh file handed to `product-documentation` |
| Declined refresh | `{campaign}/04-archives/planning/owner-interview/` |
| Batch voice links | `{campaign}/01-intake/1.1-docs/interviews/owner/{Company}-interview-links-{date}.md` |

Legacy flat files left in `1.1-docs/` still resolve.

## Companion flowchart

`owner-interview-loop.png` and `retell-voice-architecture.png` ship with the suite diagrams.

## Attribution

Packaged for Semantic Mastery Mastermind by Bradley Benner.

## Support

Questions about this skill: ask inside Semantic Mastery Mastermind (Bradley Benner).
