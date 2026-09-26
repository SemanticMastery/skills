# Voice interview rollout checklist

First-client-link gates. Do not mint a client link until every row is checked. Each gate is HITL — this file is the runbook, not a license to deploy.

Pilot against a **test campaign** first (same pattern as the expert-interview rollout).

## Staging gates

| # | Gate | Stop if | Rollback |
|---|------|---------|----------|
| 1 | Worker production deploy of the host that includes `/v/*`, `RETELL_VOICE_AGENT_ID`, and the voice template | Deploy fails or `/v/` 404s on the production origin | Keep the prior Worker version; leave `RETELL_VOICE_AGENT_ID` empty so voice create cannot start a call |
| 2 | `setup-agent.mjs --template retell/voice --verify` against the production Worker URL | `data_storage_setting_drift`, `selftest_*`, or verify reads `RETELL_AGENT_ID` instead of `RETELL_VOICE_AGENT_ID` | Do not `--apply`. Fix template or env mapping first |
| 3 | `setup-agent.mjs --template retell/voice --apply` (operator approval required) | Apply writes the owner or expert agent, or Retell rejects the payload | Restore the previous voice agent (or delete the new one) and clear `RETELL_VOICE_AGENT_ID` |
| 4 | Retell changelog + pinned-model check (`gpt-4.1`, `11labs-Joe`, `data_storage_setting: everything`) | Model, voice, or storage setting drifted | Re-apply the template; do not mint links |
| 5 | Host self-test (`/retell/selftest` with the voice agent id) | 401 or `agent_mismatch` | Disable the voice route in `run_worker_first` until the webhook key and agent id match |
| 6 | Mint a pilot link on a test campaign (`voice-session.mjs --create-link`) | URL is `/s/` or `/i/` instead of `/v/{agency}/{session}`; remint does not expire the prior link | `--retire` any landed DNA; expire the session; do not send the URL |
| 7 | Internal live call (~30 minutes) | Call dies at owner/expert silence settings, or begin-message omits the style-profile disclosure | Stop the call; do not pull. Re-apply the voice template |
| 8 | `--pull` | `transcript_pending` after the documented poll, or `consent_refused` / `consent_withdrawn` without a delete-queue receipt | Do not extract. Confirm Retell-side deletion before another mint |
| 9 | `--prepare` → extract → `--land --speaker-verified` | Schema fail, `under_floor_unresolved` without an explicit accept, or content flags | Leave the record at `captured`. Do not overwrite an existing Voice DNA |
| 10 | Draft step resolves the landed `*voice-dna*` file without asking | Draft still prompts for a Voice DNA path or reads an archived/retired file | `--retire` the bad file; fix consumer glob; re-land only after review |

## Compliance axis

Confirm these on the same pilot, each with a written stop:

| Check | Stop if | Rollback |
|-------|---------|----------|
| Retell processor + no-training terms re-confirmed (signed DPA; public ToS alone is not enough) | DPA missing, expired, or training opt-out unclear | Do not `--apply`. Do not mint |
| Client voice authorization (verbal at interview start **and** KTD19 typed-name release on the page) | Page allows Start before a typed name, or export has no `release` | Expire the session; do not pull |
| Release capture in the record | Export missing `release.name` / `release.ts`, or `access_log` missing `page_open` / `release` / `call_start` | Do not land. Treat as unauthorized |
| Link-leak drill | A second party holding the URL can `--land` without `--speaker-verified` | Keep the gate; do not change land to auto-verify |
| Refusal deletion | Refused call is still retrievable in Retell after the documented delete backoff | Stop minting. Drain `delete_queue` or revoke the agent |
| Withdrawal deletion | Withdrawn transcript remains pullable without `--accept-withdrawn` | Same as refusal; notify legal before any extract |
| `--retire` drill | Draft still resolves the retired file | Move leftovers out of `01-resources/`; confirm glob |
| Legal review of notice text, including access-logging disclosure | Counsel rejects the commercial-use or logging language | Bump `VOICE_NOTICE_VERSION`; do not reuse old links |

## Pilot quality (assumptions to measure, not auto-pass)

- Inspect the pulled transcript for filler and disfluency **before** extraction (spoken-source artifact claim).
- Review extraction quality at the achieved word count against the spoken-source confidence cap (`medium` for a single interview). Do not treat the 2,000-word floor as validated from one lucky call.

## After the pilot

Only then send a real-client link.
