---
name: expert-interview
description: >-
  Recurring spokesperson interviews: create a stable series link, refresh
  the campaign story bank, and keep the digest current for pipeline writers.
  Triggers on /expert-interview or "expert interview". Requires an explicit
  campaign directory. (v0.1.1)
disable-model-invocation: true
metadata:
  version: "0.1.1"
---

# Expert Interview

Human-triggered skill for **one campaign**. A sibling of `owner-interview`: this one captures experience on a cadence, not citable PD facts. The host Worker is `voice-host/` in this package — the same deploy as owner-interview. This skill never messages the spokesperson and never calls live Retell or `gws` unless you ask.

| Rule | Detail |
|------|--------|
| **Campaign pin** | User must specify `campaign_dir`. Confirm the absolute path before writes. |
| **Host** | `EXPERT_INTERVIEW_HOST_URL` or fallback `OWNER_INTERVIEW_HOST_URL`; token `OWNER_INTERVIEW_HOST_TOKEN`. Secrets stay in User env. |
| **HITL stops** | Stop and ask before: Worker production deploy, `setup-agent.mjs --apply`, first `agency-settings.json`, sending a calendar invite, overwriting a live campaign stage `CONTEXT.md`. |
| **Records** | `{Company}-expert-interview-series.{json,md}` in `01-intake/1.1-docs/interviews/expert/`. Digest `{Company}-story-bank.md` in `06-content-pipeline/01-resources/`. JSON is authoritative. Every series and entry carries `speaker`. Legacy flat series files in `1.1-docs/` still resolve. |
| **Planning files** | `{campaign_dir}/04-archives/planning/` only. Never the workspace root. |
| **Home** | This folder (next to `SKILL.md`). Voice host is `voice-host/` in the suite package — the same Worker as `owner-interview`. |
| **Who sends** | The IDE user / agency contact sends the calendar invite. This skill never messages the spokesperson. |


## When to use

- User says **`/expert-interview`** or **"expert interview"** / **"story bank"**
- User names a **campaign directory**
- After `owner-interview` has seated Product Documentation (facts stay there)

## References

1. [references/schemas.md](references/schemas.md) — series, entry, transcript, digest, agency-settings
2. [references/interviewer-posture.md](references/interviewer-posture.md) — expert-led deltas
3. [references/flags.md](references/flags.md) — flag meanings and clear/handoff
4. [references/agency-settings.md](references/agency-settings.md) — one Workspace login per agency
5. Installed `owner-interview` skill folder — fact interview; `/i/{agency}/{session}` also serves owner links on the same host

## Scripts

Skill root = this folder (next to `SKILL.md`). **Node.js 20+**.


| Script | Purpose |
|--------|---------|
| `scripts/series.mjs` | Create, status, cadence, pause/end, rotate-link, inventory, sync-topics |
| `scripts/bank.mjs` | Refresh, flags, reclassify, digest, accept-call |
| `scripts/calendar.mjs` | Preview/create/update/cancel the recurring agency calendar event |

```bash
node scripts/series.mjs --campaign-dir "/abs/path/to/campaign" --create --speaker "Jordan Hale" --email "jordan@example.com" --timezone America/Denver --cadence biweekly
node scripts/series.mjs --campaign-dir "/abs/path/to/campaign" --status
node scripts/series.mjs --campaign-dir "/abs/path/to/campaign" --set-cadence monthly
node scripts/series.mjs --campaign-dir "/abs/path/to/campaign" --pause
node scripts/series.mjs --campaign-dir "/abs/path/to/campaign" --resume
node scripts/series.mjs --campaign-dir "/abs/path/to/campaign" --end
node scripts/series.mjs --campaign-dir "/abs/path/to/campaign" --rotate-link
node scripts/series.mjs --campaign-dir "/abs/path/to/campaign" --sync-topics
node scripts/series.mjs --inventory --clients-root "/abs/path/to/clients"
node scripts/bank.mjs --campaign-dir "/abs/path/to/campaign" --refresh
node scripts/bank.mjs --campaign-dir "/abs/path/to/campaign" --list-flags
node scripts/bank.mjs --campaign-dir "/abs/path/to/campaign" --list-held
node scripts/bank.mjs --campaign-dir "/abs/path/to/campaign" --clear-flag --entry "call-1-1" --pd dismissed
node scripts/bank.mjs --campaign-dir "/abs/path/to/campaign" --set-publish --entry "call-1-1" --decision internal
node scripts/bank.mjs --campaign-dir "/abs/path/to/campaign" --accept-call "call-1"
node scripts/bank.mjs --campaign-dir "/abs/path/to/campaign" --reclassify --input "/abs/path/to/overrides.json"
node scripts/bank.mjs --campaign-dir "/abs/path/to/campaign" --digest
node scripts/calendar.mjs --campaign-dir "/abs/path/to/campaign" --preview
node scripts/calendar.mjs --campaign-dir "/abs/path/to/campaign" --create
node scripts/calendar.mjs --campaign-dir "/abs/path/to/campaign" --retry
```

## Steps

### Setup

1. Confirm `campaign_dir` and that `PUBLIC_ORIGIN` is the neutral domain (not `workers.dev`).
2. `series.mjs --create` with speaker, email, timezone, cadence.
3. Preview the calendar event; create it only after the operator says yes.

### Session

The spokesperson opens the series link. The agent recaps and records stories. The operator does not sit in.

### Refresh

`bank.mjs --refresh` (also run from `content-pipeline-run` check-ready / set-slot). Entries land without approval; flags carry review.

### Flags

`--list-flags`, `--clear-flag`, `--set-publish`, `--accept-call` for withdrawn holds.

### Series changes

`--set-cadence`, `--pause`, `--resume`, `--end`, `--rotate-link` mark calendar `needs_update`.

## Live rollout checklist

Stop and ask before each gate. Record notes in the campaign `04-archives/planning/`.

1. Deploy host with `PUBLIC_ORIGIN` set (approval).
2. `setup-agent.mjs --template retell/expert --apply` (approval).
3. Self-test the expert agent on the dev Worker.
4. Confirm the `gws` OAuth client is Production: Google Cloud Console → **APIs and Services → Audience** (not a Testing-mode OAuth client). Set `GOOGLE_WORKSPACE_CLI_CLIENT_ID` / `_SECRET` User env vars.
5. Create `{Agency}/agency-settings.json` with `gws_config_dir` under `%LOCALAPPDATA%\gws\{agency-slug}` (approval).
6. `gws auth login` under that config dir (one login per agency per machine).
7. Create the campaign series (worked example: Ridgeline Tree Care).
8. Preview, then create the calendar event (approval before send).
9. Run one internal test session; `bank.mjs --refresh`; check the digest.
10. Hand the link summary to the agency contact.
11. After approval, run `content-pipeline-init` `scaffold-icm.mjs --refresh-context 03-write/3.1-brief/CONTEXT.md,03-write/3.2-draft/CONTEXT.md` once per live campaign so writers see the digest line. Do not overwrite a live stage CONTEXT.md without that yes.
