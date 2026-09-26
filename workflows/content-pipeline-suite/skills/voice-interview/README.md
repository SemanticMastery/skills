# voice-interview

**Version:** 0.1.1  
**Semantic Mastery Mastermind** — Bradley Benner  
**License:** For enrolled students only. Not for public resale or redistribution outside the program.

## What this skill does

A campaign-pinned interview for **how the spokesperson sounds**. Sibling of `owner-interview` (facts) and `expert-interview` (stories). This skill never writes copy, facts, or stories.

1. `voice-record.mjs --create` — open a record for one speaker
2. `voice-session.mjs --create-link` — mint one `/v/{agency}/{session}` URL on the **same** `voice-host/` Worker
3. You send the link. The spokesperson talks. The skill never DMs them.
4. `--pull` then `voice-extract.mjs --prepare`
5. Run the companion `voice-extractor` skill on the transcript
6. `voice-extract.mjs --land --speaker-verified` — validated Voice DNA into `01-resources/`

`content-pipeline-run` already consumes `*voice-dna*` at draft (0 / 1 / 2+). This skill is what **produces** that file.

## When you run it

When you want a spoken-source Voice DNA for the blog draft. Not when `pd-coverage` blocks a page (that is owner-interview). Not for recurring stories (that is expert-interview).

## Requirements

- **Node.js 20+**
- An Agent Skills host
- A campaign with `06-content-pipeline/01-resources/` already scaffolded (init)
- The **same** `voice-host/` Worker you deploy for owner-interview and expert-interview, plus a third Retell agent from `retell/voice`
- Companion skill `voice-extractor` installed next to this folder (schema + transcript-mode extraction). Not bundled here.

## Install

Unzip so you get a folder named `voice-interview` containing `SKILL.md`, then copy it next to the other suite skills. Install `voice-extractor` the same way, as a sibling folder.

| Tool | Typical skills directory |
|------|--------------------------|
| Cursor | `.cursor/skills/` (project) or `~/.cursor/skills/` (user) |
| Claude Code / Claude Desktop | `.claude/skills/` or `~/.claude/skills/` |
| Codex / OpenAI agents | `.agents/skills/` or tool-specific skills path |
| OpenCode / other Agent Skills hosts | Project or user `skills/` folder that loads `SKILL.md` |

## Usage

```text
/voice-interview on {campaign}
```

```bash
node scripts/voice-record.mjs --campaign-dir "/abs/path/to/campaign" --create --speaker "Jordan Hale"
node scripts/voice-session.mjs --campaign-dir "/abs/path/to/campaign" --speaker "Jordan Hale" --create-link
node scripts/voice-session.mjs --campaign-dir "/abs/path/to/campaign" --speaker "Jordan Hale" --status
node scripts/voice-session.mjs --campaign-dir "/abs/path/to/campaign" --speaker "Jordan Hale" --pull
node scripts/voice-extract.mjs --campaign-dir "/abs/path/to/campaign" --speaker "Jordan Hale" --prepare
node scripts/voice-extract.mjs --campaign-dir "/abs/path/to/campaign" --speaker "Jordan Hale" --land "/abs/path/to/voice-dna.json" --speaker-verified
```

## Output location

| Artifact | Path |
|----------|------|
| Record | `{campaign}/01-intake/1.1-docs/interviews/voice/{Company}-voice-interview-{speaker-slug}-{YYYY-MM-DD}.{json,md}` |
| Voice DNA | `{campaign}/06-content-pipeline/01-resources/{author}-voice-dna.json` |

JSON is authoritative. State: `open → captured → extracted → superseded`. `under_floor` is a flag, not a state. Legacy flat files in `1.1-docs/` still resolve.

## Companion

Voice setup is the same Worker as owner-interview and expert-interview. See `tutorial/09-retell-voice-setup.md` and `tutorial/07c-voice-interview.md` in the suite package.

`voice-extractor` is a separate install (like `product-documentation`). `--prepare` prints the sibling schema path; `--land` validates before write.

## Attribution

Packaged for Semantic Mastery Mastermind by Bradley Benner.

## Support

Questions about this skill: ask inside Semantic Mastery Mastermind (Bradley Benner).
