---
name: cognee-decision-trace-capture
description: >-
  Master router for the 8-step decision-trace capture pipeline. S0 resolves
  client and order IDs from a configured CRM, a campaign override file, or a
  manual ask. S6 stores a DecisionTrace in your Cognee MCP and, when the
  campaign folder is known, writes the same JSON under 03-decisions/3.2-traces.
  Triggers: /capture-trace, "capture this decision", "DTC from this Cap",
  a Cap URL plus decision or revision language. Intake: paste, chat, Cap
  transcript, or a video-feedback extract.
metadata:
  version: "2.0.0"
disable-model-invocation: true
---

# Decision-trace capture


Eight steps. S0 resolves IDs. S1–S5 structure the decision. S6 stores it only after confirmation. S7 checks that the store and the local file match.

**Tools:**

- Your Cognee MCP — `remember`, `recall`, and `search` (S6 write, S7 verify)
- A CRM resolver, when one is configured — S0 only, read-only
- `cap` — optional intake. Read tools only: `caps_get`, `caps_context`, `caps_wait`

**Optional intake skills:**

- `dtc-video` — preferred router from a Cap into this skill (`/dtc-video`)
- `video-feedback` — speech-to-screen extract when on-screen evidence is required
- A Slack paste skill, when one is installed

Join keys stay `client_slug`, `client_id`, `order_id`, and `trace:*` tags.

Cap and video-feedback wiring: `../dtc-video/references/dtc-video-integration.md`

---

## What gets stored

S6 writes the same DecisionTrace in two places:

- Your Cognee dataset `decision_traces`
- `{campaign}/03-decisions/3.2-traces/{date}_{client_slug}_{trace_id}.json` when the campaign folder is known

That object can include transcript excerpts, the decision, alternatives, rationale, constraints, participant names, client and order IDs, and source URLs. Redact client personal data before confirming the store.

---

## Intake sources (before S0)

Resolve evidence text into the governor context, then run S0–S7. Do not skip the ID or client gates because the source was a Cap.

| Source | When to use | How to acquire | Maps into S2–S5 as |
|--------|-------------|----------------|--------------------|
| Paste / chat | The user typed or pasted the rationale | Conversation context | Primary narrative |
| Slack copy | A thread is already in the clipboard | User paste, or a Slack paste skill if installed | Primary narrative; cite thread URLs in `source_artifacts` |
| Cap MCP/CLI | A Cap share URL or bare Cap id, plus decision or revision intent | `caps_get`, then `caps_context` (CLI: `cap caps get` / `cap caps context`) | Transcript is the primary narrative. Canonical `https://cap.so/s/{id}` goes in `source_artifacts` |
| video-feedback | On-screen evidence is required | That skill's full pipeline, or an MCP transcript plus frames | Timestamped extracts are evidence quotes. An action plan alone is not the decision |
| Local video file | A local file, no Cap download | `video-feedback` acquire path | Same as video-feedback |

### Cap routing

1. **Pattern A (default):** transcript only, when spoken rationale is enough.
2. **Pattern B:** transcript plus `video-feedback` frames when the user needs what was on screen. Run B only when download is allowed.
3. If the user asked to capture or store a decision, finish S0–S7. Do not stop after a video report.
4. Cap allowlist is read-only: `caps_get`, `caps_context`, `caps_wait`. Do not call process, delete, or mutate tools.

`source_system` is `cognee-dtc`. Intake channel tags may be `intake:cap-mcp`, `intake:cap-cli`, or `intake:video-feedback`.

---

## S0 — Resolve IDs

Never invent IDs. More than one match halts.

1. If a CRM resolver is configured, use it read-only. One match may proceed. Zero matches fall through. Two or more matches return the candidates and stop.
2. Otherwise read `{campaign_folder}/.wayfront-ids.json` when that file exists and is valid. Keys: `client_id`, `order_id`, `company`, `service`.
3. Otherwise ask the user for the IDs. A manual answer with no CRM block is valid.
4. Prompts for S0–S5: `references/step-delegation.md`.

Pass `campaign_path` through S1 and S5 when the intake already has a campaign folder, so S6 can write the mirror without asking again.

S1 still requires client context. If neither an ID match nor a client folder is available, halt and report what evidence you already have.

---

## Confirm before S6

Before `remember`, show a short preview: client slug, order id if any, the decision sentence, and whether a local mirror will be written. Remind the user to redact client personal data. Store only after they confirm.

---

## S6 — Store

1. Take the S5 JSON.
2. Build the DecisionTrace:
   - `node scripts/build-decision-trace-from-s5.mjs '<s5-json>'` from this skill folder
   - Or assemble it from `references/decision-trace-v1.schema.json`
3. Call `remember` on your Cognee MCP:
   - `data` = the DecisionTrace JSON string
   - `dataset_name` = `decision_traces`
   - `custom_prompt` is optional; read `references/decision-trace-extraction-prompt.md` when the input is markdown only
4. Set `source_system` to `cognee-dtc` and include the header `# Decision trace` in the content.
5. **Local mirror**, only after `remember` succeeds and the campaign folder is known. Write the same JSON into the campaign folder that owns `03-decisions/`. Spec: `references/decision-trace-routing.md`.

Do not write the local file if `remember` failed or was skipped.

### Local mirror

| Input | Source |
|-------|--------|
| DecisionTrace object | The exact payload sent to `remember` |
| `campaign_path` | User, Cap router, or S1 evidence. The folder that owns `03-decisions/` |

1. If the path already ends in `03-decisions` or `3.2-traces`, walk up to the campaign root.
2. Target: `{campaign_root}/03-decisions/3.2-traces/`. Create the directory if it is missing.
3. Filename: `{YYYY-MM-DD}_{client_slug}_{trace_id}.json`, using the UTC date from `captured_at`. Example: `2026-09-28_ridgeline-tree-care_<uuid>.json`.
4. Write pretty-printed UTF-8 JSON, the same object stored in Cognee.
5. Same path and same `trace_id`: skip. Different content: write `*.conflict-{HHmmss}.json` and warn.

Return JSON with `success`, `trace_id`, `dataset` (`decision_traces`), `local_mirror_path`, `local_mirror_error`, and `error`. If Cognee succeeded but the campaign path is unknown, set `local_mirror_path` to null and `local_mirror_error` to `campaign_path_unknown`. Say that gap in the summary. The Cognee store still counts as success.

---

## S7 — Verify

```
recall(query="decision trace {client_slug} {order_id}")
```

When S6 wrote a mirror, confirm the file exists at `local_mirror_path` and include that path in the summary.

---

## Related

- Step prompts: `references/step-delegation.md`
- Schema: `references/decision-trace-v1.schema.json`
- Local mirror: `references/decision-trace-routing.md`
- Cap wiring: `../dtc-video/references/dtc-video-integration.md`
- Cap router: `../dtc-video/SKILL.md`
- skill `video-feedback` — transcript-first route, then the decision-trace handoff
