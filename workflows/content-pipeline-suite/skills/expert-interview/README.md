# expert-interview

**Version:** 0.1.1  
**Semantic Mastery Mastermind** — Bradley Benner  
**License:** Semantic Mastery Member License. See LICENSE-MEMBERS.md at the repository root.

## What this skill does

A recurring spokesperson interview for **one campaign**. Sibling of `owner-interview` (facts) and `voice-interview` (how they sound), not a replacement.

- **owner-interview** captures **citable Product Documentation facts** when a page cannot be written honestly.
- **expert-interview** captures **experience on a cadence** — stories the blog brief and draft can use.
- **voice-interview** captures **how they sound** — a Voice DNA file the draft already consumes.

Facts stay in Product Documentation. Stories land in a **story bank digest**. A `pd_candidate` flag is a handoff to owner-interview, not a PD write.

1. `series.mjs --create` — speaker, email, timezone, cadence
2. Spokesperson opens the stable `/e/{agency}/{token}` link (you do not sit in)
3. `bank.mjs --refresh` — import completed calls; write the digest
4. `calendar.mjs` — optional recurring invite from the agency Workspace calendar
5. `content-pipeline-run` check-ready / set-slot refreshes the bank when a series record exists

This skill never messages the spokesperson. The agency calendar invite is what reaches them.

## When you run it

After Product Documentation exists, on a calendar. Not when `pd-coverage` blocks a page — that is owner-interview.

## Requirements

- **Node.js 20+**
- An Agent Skills host
- A campaign with Product Documentation already seated
- Optional (voice): the **same** `voice-host/` Worker you deploy for owner-interview, plus a second Retell agent from `retell/expert`
- Optional (calendar): Google Workspace CLI (`gws`) with one login per agency

## Install

Unzip so you get a folder named `expert-interview` containing `SKILL.md`, then copy it next to the other suite skills.

| Tool | Typical skills directory |
|------|--------------------------|
| Cursor | `.cursor/skills/` (project) or `~/.cursor/skills/` (user) |
| Claude Code / Claude Desktop | `.claude/skills/` or `~/.claude/skills/` |
| Codex / OpenAI agents | `.agents/skills/` or tool-specific skills path |
| OpenCode / other Agent Skills hosts | Project or user `skills/` folder that loads `SKILL.md` |

## Usage

```text
/expert-interview on {campaign}
```

```bash
node scripts/series.mjs --campaign-dir "/abs/path/to/campaign" --create \
  --speaker "Jordan Hale" --email "jordan@example.com" \
  --timezone America/Denver --cadence monthly --byday 1MO

node scripts/bank.mjs --campaign-dir "/abs/path/to/campaign" --refresh
node scripts/calendar.mjs --campaign-dir "/abs/path/to/campaign" --preview
```

## Cadence time caps

| Cadence | Soft target | Hard hang-up |
|---------|-------------|----------------|
| Weekly | 10–15 min | 15 |
| Biweekly | 20–30 min | 30 |
| Monthly | 30–45 min | 45 |

## Output location

| Artifact | Path |
|----------|------|
| Series record | `{campaign}/01-intake/1.1-docs/interviews/expert/{Company}-expert-interview-series.{json,md}` |
| Digest | `{campaign}/06-content-pipeline/01-resources/{Company}-story-bank.md` |
| Agency settings | `{Agency}/agency-settings.json` (one level above the campaign) |

JSON is authoritative. Flagged and internal rows stay out of the digest. Legacy flat series files in `1.1-docs/` still resolve.

## Companion

Voice setup is the same Worker as owner-interview and voice-interview. See `tutorial/09-retell-voice-setup.md` and `tutorial/07b-expert-interview.md` in the suite package.

## Attribution

Packaged for Semantic Mastery Mastermind by Bradley Benner.

## Support

Questions about this skill: ask inside Semantic Mastery Mastermind (Bradley Benner).
