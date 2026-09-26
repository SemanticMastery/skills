---
name: voice-interview
description: >-
  Campaign-pinned voice interview: mint one hosted link per spokesperson,
  pull the transcript, run voice-extractor, and land a Voice DNA file the
  draft step already consumes. Triggers on /voice-interview or "voice
  interview". Requires an explicit campaign directory. (v0.1.1)
disable-model-invocation: true
metadata:
  version: "0.1.1"
---

# Voice Interview

Human-triggered skill for **one campaign**. A sibling of `owner-interview` (facts) and `expert-interview` (stories): this one captures how the spokesperson *sounds*. The host Worker is `voice-host/` in this package — the same deploy as owner-interview and expert-interview. This skill never messages the interviewee and never writes copy.

| Rule | Detail |
|------|--------|
| **Campaign pin** | User must specify `campaign_dir`. Confirm the absolute path before writes. |
| **Host** | `OWNER_INTERVIEW_HOST_URL` + `OWNER_INTERVIEW_HOST_TOKEN`. Secrets stay in User env. |
| **HITL stops** | Stop and ask before: Worker production deploy, `setup-agent.mjs --apply`, Voice DNA overwrite, under-floor acceptance, speaker verification at landing. |
| **Records** | `{Company}-voice-interview-{speaker-slug}-{YYYY-MM-DD}.{json,md}` in `01-intake/1.1-docs/interviews/voice/`. JSON is authoritative. State: `open → captured → extracted → superseded`. `under_floor` is a flag, not a state. Legacy flat files in `1.1-docs/` still resolve. |
| **Planning files** | `{campaign_dir}/04-archives/planning/` only. Never the workspace root. |
| **Home** | This folder (next to `SKILL.md`). Voice host is `voice-host/` in the suite package — the same Worker as `owner-interview` and `expert-interview`. |
| **Who sends** | The IDE user / agency contact sends the link. This skill never messages the interviewee. |


## When to use

- User says **`/voice-interview`** or **"voice interview"** / **"voice DNA"**
- User names a **campaign directory**
- After the operator wants a spoken-source style profile for the draft step

## References

1. Installed `voice-extractor` skill folder — transcript-mode extraction, spoken-source rules
2. Installed `voice-extractor/references/voice-dna-schema.json` — `voice-dna-v1` shape
3. Installed `content-pipeline-run` skill folder, `references/voice-dna.md` — draft-step resolution (`*voice-dna*`)
4. Installed `owner-interview` skill folder — sibling host, env vars, HITL pattern
5. [references/rollout-checklist.md](references/rollout-checklist.md) — first-client-link gates

## Scripts

Skill root = this folder (next to `SKILL.md`). **Node.js 20+**.


| Script | Purpose |
|--------|---------|
| `scripts/voice-record.mjs` | Create, list, and show the voice record pair |
| `scripts/voice-session.mjs` | Mint the host link, show status, pull a finished session |
| `scripts/voice-extract.mjs` | Prepare extraction, land a validated Voice DNA, retire a profile |
| `scripts/validate-voice-dna.mjs` | Mechanical schema and content-screen checks |

```bash
node scripts/voice-record.mjs --campaign-dir "/abs/path/to/campaign" --create --speaker "Jordan Hale"
node scripts/voice-record.mjs --campaign-dir "/abs/path/to/campaign" --list --speaker "Jordan Hale"
node scripts/voice-record.mjs --campaign-dir "/abs/path/to/campaign" --show --speaker "Jordan Hale"
node scripts/voice-session.mjs --campaign-dir "/abs/path/to/campaign" --speaker "Jordan Hale" --create-link
node scripts/voice-session.mjs --campaign-dir "/abs/path/to/campaign" --speaker "Jordan Hale" --status
node scripts/voice-session.mjs --campaign-dir "/abs/path/to/campaign" --speaker "Jordan Hale" --pull
node scripts/voice-session.mjs --campaign-dir "/abs/path/to/campaign" --speaker "Jordan Hale" --pull --from-file export.json
node scripts/voice-session.mjs --campaign-dir "/abs/path/to/campaign" --speaker "Jordan Hale" --pull --from-file export.json --accept-withdrawn
node scripts/voice-extract.mjs --campaign-dir "/abs/path/to/campaign" --speaker "Jordan Hale" --prepare
node scripts/voice-extract.mjs --campaign-dir "/abs/path/to/campaign" --speaker "Jordan Hale" --land "/abs/path/to/voice-dna.json" --speaker-verified
node scripts/voice-extract.mjs --campaign-dir "/abs/path/to/campaign" --speaker "Jordan Hale" --land "/abs/path/to/voice-dna.json" --speaker-verified --accept-under-floor --confirm-overwrite --accept-content-flags
node scripts/voice-extract.mjs --campaign-dir "/abs/path/to/campaign" --speaker "Jordan Hale" --retire
node scripts/validate-voice-dna.mjs "/abs/path/to/voice-dna.json" --speaker "Jordan Hale"
```

## Steps

### Setup

1. Confirm `campaign_dir` (absolute) and echo it before any write.
2. `voice-record.mjs --create --speaker "<name>"`. A second create for the same speaker supersedes the prior record.

### Session

Mint and pull through `voice-session.mjs` (create-link / status / pull). The operator sends the link. Consent is the verbal authorization at the start of the interview, matching the sibling skills; the host page still collects the typed-name release.

### Extract and land

`voice-extract.mjs --prepare` then run `voice-extractor`. `--land` validates and writes `{author}-voice-dna.json` into `06-content-pipeline/01-resources/` behind CLI refusals.

### Retire

`--retire --speaker <name>` moves the active Voice DNA out of `01-resources/` so the draft step stops resolving it.

## First client link

Stop and ask before each gate in `references/rollout-checklist.md`. Do not send a client link until those gates pass.
