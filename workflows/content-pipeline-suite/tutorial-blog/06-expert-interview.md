# 06 — expert-interview

**Version 0.1.1. Recurring stories. Optional for the blog run.**

## What it is for

A stable series link for one spokesperson. Each session adds experience to a story bank. Writers may use that digest. They do not have to.

Product facts are already seated in Product Documentation. This course starts at the story series. Citable delivery facts stay in that product file. This skill records how the work felt, what happened on the job, and what the spokesperson is willing to say again.

Trigger: `/expert-interview` or "expert interview" or "story bank", plus the campaign path.

The example speaker is **Morgan Hale** at Ridgeline Tree Care.

## Where files go

| File | Path |
|---|---|
| Series record (JSON is authoritative) | `01-intake/1.1-docs/interviews/expert/{Company}-expert-interview-series.json` (and `.md`) |
| Digest the pipeline reads | `06-content-pipeline/01-resources/{Company}-story-bank.md` |

Every series and every entry carries `speaker`. `content-pipeline-run` refreshes the digest when the series record exists, at ready-check and at slot selection. Entries land without a separate approval click. Flags carry the review. No series means no digest, and the run continues.

Brief and draft use a story only when the brief lists it under `Story bank entries used:`.

## The loop

1. Confirm the campaign path, and that `PUBLIC_ORIGIN` is your domain.
2. Create the series: speaker, email, timezone, cadence.

```bash
node scripts/series.mjs --campaign-dir "C:\work\clients\ridgeline-tree-care" --create --speaker "Morgan Hale" --email "morgan@example.com" --timezone America/Denver --cadence biweekly
node scripts/series.mjs --campaign-dir "C:\work\clients\ridgeline-tree-care" --status
```

3. Preview the calendar event. Create it only after you say yes. The agency contact sends the invite. This skill does not message the spokesperson.
4. Morgan opens the series link. The agent recaps and records. You do not sit in.
5. `node scripts/bank.mjs --campaign-dir "..." --refresh` writes the digest. Run's ready-check does this too when the series exists.

Cadence changes, pause, resume, end, and rotate-link mark the calendar `needs_update`. Preview again before you send an update.

## Stops that need a yes

Ask before each of these:

- Production deploy of the voice host
- `setup-agent.mjs --apply` for the expert template
- The first `agency-settings.json`
- Sending the calendar invite
- Overwriting a live stage `CONTEXT.md`

The host package is `voice-host/` in the suite. Expert links and voice links share that worker. Deploy it on your Cloudflare account. Do not send a client link until the host gates in the skill's rollout checklist have passed.

## Flags

`bank.mjs --list-flags` shows what needs a human. Clear a flag, set publish to internal, or accept a call when a hold is withdrawn. Those commands are in the skill. The blog run never treats an open flag as a blocker. You still clear flags before a story is fair game for a brief.
