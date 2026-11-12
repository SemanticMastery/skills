# 07 — Voice DNA

**Version 0.1.1 of `voice-interview`. Consumed by `content-pipeline-run` before draft.**

## Two roles

| Role | Skill | Result |
|---|---|---|
| Producer | `voice-interview`, then `voice-extractor` | `{author}-voice-dna.json` in `06-content-pipeline/01-resources/` |
| Consumer | `content-pipeline-run` at stage 3.2 | Reads matching files. Never invents one. |

Zero files is a valid produce. The draft uses a clean professional tone and records `none — default professional`.

## How many files

Scan the top of `01-resources/` for `*voice-dna*`, `*voice_dna*`, `*brand-voice*`, or `*author-voice*` (`.json` or `.md`).

| Count | Draft |
|---|---|
| 0 | Professional default. Do not ask. |
| 1 | Use that file. Do not ask. |
| 2 or more | Stop and ask which file is the author voice for this article. Do not blend. `gate_mode auto` still asks. |

A person-file: company and crew are we / us / our. That person's own role, calls, and arrival are I / me / my. Do not name them in the third person. Do not copy filler words or a biography into the article unless you ask for that. Edit and polish keep the speaker the draft chose, including keeping "I" where the draft used it.

## Produce a file

1. Confirm the campaign path.
2. Create the voice record for one speaker. A second create for the same speaker supersedes the prior record.

```bash
node scripts/voice-record.mjs --campaign-dir "C:\work\clients\ridgeline-tree-care" --create --speaker "Morgan Hale"
node scripts/voice-session.mjs --campaign-dir "C:\work\clients\ridgeline-tree-care" --speaker "Morgan Hale" --create-link
```

3. You send the link. The skill does not message Morgan. Consent is the spoken authorization at the start of the interview.
4. After the session, `--pull`, then `voice-extract.mjs --prepare`, then `voice-extractor`.
5. `--land` validates and writes the Voice DNA into `01-resources/`. Landing stops for a yes on overwrite, on an under-floor transcript, and on speaker verification.

`--retire --speaker "Morgan Hale"` moves the active file out of `01-resources/` so the next draft stops resolving it.

State on the record: `open`, then `captured`, then `extracted`, then `superseded`.

## Host

Voice links use the same suite `voice-host/` as the expert series, with `OWNER_INTERVIEW_HOST_URL` and `OWNER_INTERVIEW_HOST_TOKEN` in the user environment. Ask before a production deploy and before `setup-agent.mjs --apply`. The skill's rollout checklist is the gate list. Do not send a client link before those gates pass.

Install `voice-extractor` next to `voice-interview`. The interview skill prepares the transcript. The extractor writes the profile.
