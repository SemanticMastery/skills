---
name: dtc-video
description: >-
  Thin router from a Cap recording to Cognee decision-trace capture. Resolves Cap
  via MCP (caps_get / caps_context / caps_wait) or cap CLI fallback, chooses
  Pattern A (transcript-only) or B (optional video-feedback visuals), then hands
  off to cognee-decision-trace-capture S0-S7. After a successful Cognee remember,
  requires a local JSON mirror under the campaign folder that owns
  03-decisions/3.2-traces. Triggers: /dtc-video, "DTC from this Cap", Cap share
  URL or Cap id plus capture / decision / revision language. Desktop only.
metadata:
  version: "2.0.0"
disable-model-invocation: true
---

# Cap → Decision Trace (router)


**Job:** Get evidence from a Cap efficiently, then **always** finish via `cognee-decision-trace-capture` (full S0–S7 → Cognee `decision_traces` **and** campaign `03-decisions/3.2-traces/` JSON mirror).

**This skill does not** call Cognee `remember` itself. **This skill does not** implement S0–S7. It only:

1. Resolves the Cap (share URL or bare id; no library search)
2. Pulls transcript (MCP/CLI) and optionally multimodal extract (`video-feedback`)
3. Packages intake + **campaign_path** (required for local mirror)
4. Invokes **`cognee-decision-trace-capture`** (which runs S6b local mirror after successful remember)

**Related:**

| Resource | Path |
|----------|------|
| Integration map | `references/dtc-video-integration.md` |
| Local mirror routing | `../cognee-decision-trace-capture/references/decision-trace-routing.md` |
| Full DTC governor | `../cognee-decision-trace-capture/SKILL.md` |
| Multimodal | skill `video-feedback` (§0 MCP-first, §3 Cap branch, §11 handoff) |
| Cap tool rules | skill `cap` |
| Schema | `../cognee-decision-trace-capture/references/decision-trace-v1.schema.json` |

**Desktop only.** Slack `@Cursor` cloud agents lack your Cap MCP + Cognee desktop stack — do not run this path there.

**Cap-first routing** (binding: skill `cap`): MCP tools first, `cap` CLI fallback. Never open the Cap dashboard or a browser to fetch this evidence. If the CLI is missing, that is an installation problem.

---

## When to run

| Trigger | Action |
|---------|--------|
| `/dtc-video` | Full router workflow |
| `DTC from this Cap` / `decision trace from Cap` | Same |
| Cap share URL or bare Cap id + capture / revision / override / decision | Same |

**Do not use this skill when:**

- User only wants a UI feedback report with no Cognee store → `video-feedback` alone
- User already has a full campaign-folder DTC session with non-Cap evidence only → `cognee-decision-trace-capture` directly
- Lightweight Slack thread path → `slack-cognee-decision-capture`
- No Cap URL or bare id is present → stop; do not search the library

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| MCP `cap` **or** `cap` CLI 0.1.0 | Read tools: `caps_get`, `caps_context`, `caps_wait`. CLI fallback when MCP is absent from this process |
| Skill `cognee-decision-trace-capture` | Required handoff target |
| Your Cognee MCP | Used by DTC S6/S7 (not by this router) |
| A CRM resolver, if configured | Used by DTC S0 |
| Skill `video-feedback` | **Optional** — Pattern B only |

**Hard rules (tool blocklist):**

- **Never** call Cap write, delete, move, title, visibility, transcript-replace, or paid processing tools (`caps_delete`, `caps_process`, `caps_transcript_replace`, `caps_update_title`, `caps_set_visibility`, `caps_move`, and the rest). Read allowlist only: `caps_get`, `caps_context`, `caps_wait`.
- **Never** start `caps_process` on your own. If the transcript is failed or absent, stop and ask first.
- **Never** accept a Cap password in chat. For `PASSWORD_REQUIRED`, tell the operator to run `cap caps unlock` in a terminal.
- **Never** invent client/order IDs. If DTC S0 fails closed, surface the halt.
- **Never** stop after transcript or video-feedback report if the user asked for a **decision trace** / capture / store.
- Confirmation behavior for any Cap mutation follows skill `cap`. This router does not mutate.

---

## Step 1 — Resolve Cap identity

Input must be a Cap share URL or a bare Cap id. Accepted forms:

- `https://cap.so/s/{id}`
- `https://cap.link/{id}`
- Custom domain `https://{host}/s/{id}` (example: `https://share.example.com/s/{id}`)
- Bare id matching `^[a-z0-9]{10,20}$`

Extract the id as the last path segment after `/s/` (cap.so and custom domains) or after the host (cap.link). Pass the **id**, not the URL, to MCP and CLI.

Any other URL (including Loom) is rejected with a one-line message; the skill never searches the library when no URL is given.

Rejection text: `Only Cap URLs or a bare Cap id are accepted.`

Resolve with `caps_get` (CLI: `cap caps get <id> --json`). Record before fetching heavy content:

```text
id:
title:
aiTitle:
createdAt:
durationMs:
shareUrl:          # returned shareUrl
canonical_url: https://cap.so/s/{id}
download_allowed:  # capabilities.download.allowed
transcript_status: # status.transcript.status (or equivalent per-stage status)
```

Canonical means `https://cap.so/s/{id}` built from the extracted id. Keep the returned `shareUrl` and the pasted URL when either differs from canonical.

---

## Step 2 — Choose Pattern A vs B

| Signal | Pattern |
|--------|---------|
| Default / "capture" / "DTC" / revision rationale / spoken policy | **A** (transcript-only) |
| "what was on screen", cursor, UI, sheet row, multimodal, "include visuals" | **B** |
| Transcript empty/thin after MCP/CLI and user still wants capture | Offer **B** once, or ask for clarification |
| Duration ≥ 5 min | Still **A** by default; **B** only if visual signal present (do not auto-B just because long) |

**Pattern B gate:** run B only when Step 1 recorded `capabilities.download.allowed = true`. If a visual-evidence signal is present but download is not allowed, state the reason in one line and run Pattern A.

State the chosen pattern in one line before fetching heavy content.

---

## Step 3 — Acquire evidence

Cap tool mapping (skill `cap`):

- `caps_get` — metadata, status, `capabilities.download.allowed` (already done in Step 1)
- `caps_context` — transcript, summary, chapters, comments
- `caps_wait` — observation only. MCP: `wait_for: "transcript"`, `timeout_seconds`. CLI: `--for transcript --timeout`

### Transcript status (before Pattern A or B)

| `status.transcript.status` | Action |
|----------------------------|--------|
| `complete` | Continue |
| `processing` / pending | Observe with `caps_wait` (`wait_for: "transcript"` / `--for transcript`), then re-check. Do not describe a wait as starting transcription. |
| `failed` or absent | Stop and ask the operator whether to start paid processing. `caps_process` appears only in this ask-first row. Never call it automatically. |

### Pattern A (default)

1. `caps_context` with the Cap id (preferred).
2. Use summary and chapters as optional sectioning when present.
3. Use comments as optional evidence when enabled.
4. **Too long:** if `caps_context` returns the transcript as a `cap://` resource link instead of inline text, fetch that resource through the MCP resource read. If resource reads are unavailable in this process, run `cap caps transcript <id> --format text --output "%TEMP%\dtc-video\<id>-transcript.txt"` and read the file. A resource link is never treated as an absent transcript.
5. If MCP is absent from this process: CLI fallback (`cap caps context <id> --json` or the transcript `--output` path above).
6. If the `cap` CLI is missing: treat that as an installation problem. Do not open the dashboard.

Use context-mode for large transcripts. Do not dump full transcript into chat unless user asks; keep working copy for DTC handoff.

### Pattern B

1. Run Pattern A first (transcript seed).
2. Invoke **`video-feedback`** with the Cap URL **and** the already-fetched transcript (text or file path). That skill's Cap branch owns MP4 acquisition. This router never downloads the MP4.
3. Keep **Feedback Extract** (timestamped speech + screen) as additional evidence.
4. Do **not** treat video-feedback Action Plan as the DecisionTrace.
5. If `video-feedback` fails on the MP4, or its Cap download fails: report the Cap error, fall back to Pattern A, note the visual gap, continue DTC if speech is enough.

---

## Step 4 — Campaign / client context (required for local mirror)

Before handoff, collect what you can **without inventing**:

| Field | Sources |
|-------|---------|
| **Campaign folder path** | **Required for the local mirror.** The campaign folder that owns `03-decisions/`. User message or open workspace. |
| Client name / slug | Same + transcript clues |
| Wayfront order id / number | User message, transcript, campaign `.wayfront-ids.json` if path known |

**Campaign path rules:**

1. Prefer the **campaign root** (the folder that contains `03-decisions`).

2. If user pastes `...\03-decisions\3.2-traces`, normalize up to campaign root; DTC S6b writes into `03-decisions\3.2-traces\`.
3. If campaign path is **missing**:
   - **Ask once** before handoff (do not invent a client folder).
   - You may still hand off for Cognee-only if user insists, but flag `local_mirror` will fail with `campaign_path_unknown`.
4. If user says "extract only / draft only", still hand off to DTC but expect S0 may halt — that is correct.

Tag intake channel for narrative:

- `intake:cap-mcp` when MCP was used
- `intake:cap-cli` when CLI fallback was used
- `intake:video-feedback` when Pattern B ran

---

## Step 5 — Build intake package (for DTC)

Hand the governor a structured package (markdown is fine). Required sections:

```markdown
# Cap decision-trace intake

## Cap
- id: ...
- title: ...
- aiTitle: ...
- createdAt: ...
- durationMs: ...
- shareUrl: ...
- canonical_url: https://cap.so/s/{id}
- download_allowed: true | false
- transcript_status: complete
- pattern: A | B

## Campaign context
- campaign_path: {campaign folder that owns 03-decisions}
- traces_dir: {campaign_path}\03-decisions\3.2-traces
- client_slug: ... | unknown
- order_hint: ... | unknown

## Primary narrative (transcript)
[MCP/CLI transcript or condensed decision-relevant excerpts with timestamps]

## Visual evidence (Pattern B only)
[Feedback Extract from video-feedback, or "n/a"]

## Decision cues (router pre-pass — non-authoritative)
- Explicit overrides / revisions called out in speech
- Alternatives mentioned
- Constraints / policies named
- Open questions still ambiguous

## Source artifacts
- https://cap.so/s/{id}
- returned shareUrl (if different)
- pasted URL (if different)
- intake:cap-mcp | intake:cap-cli
- intake:video-feedback (if B)
- local_mirror: required after S6 success
```

**Router pre-pass rules:**

- Extract only what is **stated or clearly implied** in transcript/visual extract.
- Use `(not stated)` for missing alternatives/constraints — **no invented SEO doctrine**.
- Pre-pass is a **hint** for S3–S5, not a substitute for the governor.

---

## Step 6 — Handoff to DTC (mandatory)

1. Read and follow **`../cognee-decision-trace-capture/SKILL.md`** (and `../cognee-decision-trace-capture/references/step-delegation.md` for S0–S5).
2. Pass the intake package as the decision cue / evidence for S1–S5, including **`campaign_path`** for S6b.
3. Run full pipeline: **S0 → S1 → S2 → S3 → S4 → S5 → S6 (+ S6b) → S7**.
4. S6: `remember` on your Cognee MCP, dataset `decision_traces`, `source_system: cognee-dtc`, `# Decision trace` header. Confirm before that store, as the governor skill requires.
5. **S6b (required when campaign_path set):** after successful `remember`, write the same DecisionTrace JSON to:

```text
{campaign_path}\03-decisions\3.2-traces\{YYYY-MM-DD}_{client_slug}_{trace_id}.json
```

   Spec: `../cognee-decision-trace-capture/references/decision-trace-routing.md`. DTC governor owns the write; this router verifies it.
6. S7: verify Cognee with `recall` / `search`, and `Test-Path -LiteralPath` on `local_mirror_path`.

If DTC activation gate fails (no Wayfront match, no client context): report the governor error and the Cap evidence already gathered. Offer to retry after user supplies path/order. **Do not** silently write a partial trace to Cognee or to `3.2-traces` outside the governor.

---

## Step 7 — Operator summary

After S6/S7 (or halt), return a short summary:

| Field | Content |
|-------|---------|
| Cap | title + canonical `https://cap.so/s/{id}` (+ returned shareUrl if different) |
| Pattern | A or B |
| Trace | `trace_id` / success or halt reason |
| Client / order | resolved keys |
| **Local mirror** | absolute path under `3.2-traces`, or `campaign_path_unknown` / error |
| Gaps | anything still unknown |

Do not re-print the full transcript in the summary.

---

## Efficiency defaults

1. Prefer **Pattern A** when spoken rationale is enough.
2. Prefer **`caps_context`** (or transcript `--output`) over any MP4 path.
3. Prefer **one** Cap per capture run unless the user asks for a batch.

---

## Failure matrix

| Failure | Action |
|---------|--------|
| Non-Cap URL | One-line rejection; stop |
| Transcript pending | `caps_wait` (`wait_for: "transcript"` / `--for transcript`); re-check |
| Transcript failed or absent | Stop and ask before any processing; `caps_process` only after the operator says yes |
| Transcript returned as a `cap://` resource | Fetch the resource (or `cap caps transcript --output`); do not report absent |
| `PASSWORD_REQUIRED` | Ask the operator to run `cap caps unlock <id>` in a terminal; retry reads afterward |
| MCP absent | CLI fallback (`cap caps get` / `context` / `wait` / `transcript --output`) |
| `cap` CLI missing | Installation problem; do not open the dashboard |
| Download not allowed | State the reason; run Pattern A |
| `video-feedback` Cap download fails | Report the Cap error; fall back to Pattern A; note the visual gap; continue DTC |
| video-feedback fails on the MP4 | Fall back to A transcript + note visual gap; continue DTC if speech is enough |
| Campaign path unknown | Ask once; do not invent a folder |
| DTC S0 no match | Halt with matches or override instructions; keep Cap intake for retry |

---

## Quick test checklist

1. `/dtc-video` + Cap share URL (or bare id)
2. Pattern A stated
3. Transcript pulled via `caps_context` (or CLI fallback)
4. Campaign path provided (the folder that owns `03-decisions`)
5. Full DTC S0–S7 runs
6. Cognee S7 recall confirms store
7. JSON present under `{campaign}\03-decisions\3.2-traces\{date}_{slug}_{trace_id}.json`
