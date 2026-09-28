# Cap + video-feedback + decision-trace capture

**Date:** 2026-09-16  
**Sources:** `SKILL.md`, skill `cap`, skill `video-feedback`, `../cognee-decision-trace-capture/SKILL.md`

## Bottom line

Three layers, one pipeline:

| Layer | Job | Primary output |
|-------|-----|----------------|
| **Cap MCP / CLI** | Fast access to Cap metadata + official transcripts | Transcript text, metadata, optional summary/chapters |
| **video-feedback skill** | Multimodal analysis when *what was on screen* matters | Timestamped feedback extract (speech ↔ cursor/UI) |
| **cognee-decision-trace-capture** | Structure + persist SEO decisions | Canonical DecisionTrace → Cognee `decision_traces` **+** campaign `03-decisions/3.2-traces/*.json` (S6b) |

Do **not** run full video-feedback for every Cap. Use Cap MCP/CLI for most DTC intakes; escalate to video-feedback when visual evidence is part of the decision (spreadsheet cells, Wayfront UI, link plan rows, SERP, folder tree). The flow lives in `SKILL.md`; this doc is the wiring map.

---

## What video-feedback is (and is not)

**Is:** Partner skill for “analyze this feedback Cap / local video.” For a Cap URL it downloads via `cap caps download`, seeds the MCP/CLI transcript, extracts frames, syncs speech to visuals, and produces an **actionable feedback report**.

**Is not:** A Cognee writer. It does not know DecisionTrace schema, Wayfront join keys, or S0–S7. Output is a report, not a stored decision trace.

**Assumes:** bash, `ffmpeg`/`ffprobe`, `cap` CLI for Cap MP4s, `yt-dlp` for generic non-Cap URLs, optional Whisper; temp dir `.video-feedback-tmp/` inside the project cwd.

---

## What Cap MCP / CLI adds

| Capability | Why it helps DTC |
|------------|------------------|
| `caps_get` | Id, title, `createdAt`, `durationMs`, `shareUrl`, `capabilities.download.allowed`, per-stage status |
| `caps_context` | Official transcript + summary + chapters + comments — **primary DTC text input** |
| `caps_wait` | Observe existing transcription only; never start paid work |
| `cap caps download` | MP4 for Pattern B; owned by `video-feedback`, not the router |

Cap MCP/CLI does **not** give frames/cursor/UI. Pure audio/text path unless Pattern B runs.

---

## Integration patterns

### Pattern A — Transcript-first DTC (default, efficient)

```
Cap URL or bare id
  → caps_get (metadata + transcript status + download.allowed)
  → caps_wait if transcript pending
  → caps_context  (or cap caps transcript --output when long)
  → Map campaign / order (user; ask once)
  → /dtc-video or /capture-trace  (cognee-decision-trace-capture S0–S7)
  → remember on your Cognee MCP, dataset decision_traces
  → S6b local JSON mirror → {campaign}/03-decisions/3.2-traces/
```

Local mirror spec: `../cognee-decision-trace-capture/references/decision-trace-routing.md`.

**Use when:** Spoken rationale is enough (anchor text rules, HTTPS tier policy, “why I overruled this assignment”).  
**Skip video-feedback.**

### Pattern B — Multimodal DTC (when screen is the evidence)

```
Cap URL
  → caps_get + caps_context (fast context)
  → video-feedback Cap branch (cap caps download + seeded transcript)
  → Merge: transcript + Feedback Extract (speech↔UI)
  → /dtc-video handoff with richer evidence
```

**Use when:** Decision depends on *what was shown* (specific link row, folder path, audit tab, SERP snippet, Wayfront field) **and** `capabilities.download.allowed` is true.  
Otherwise state the reason and stay on Pattern A.

---

## How to feed DTC

| Intake field | Pattern A | Pattern B |
|--------------|-----------|-----------|
| Primary narrative | Cap transcript | Cap transcript |
| Visual evidence | n/a | video-feedback Feedback Extract |
| `source_artifacts` | canonical `https://cap.so/s/{id}` (+ returned `shareUrl` / pasted URL if different) | same |
| Tags | `intake:cap-mcp` or `intake:cap-cli` | those plus `intake:video-feedback` |
| Router | `SKILL.md` | same; this skill owns the MP4 |

---

## Windows notes

- Use the `cap` CLI on PATH. Pass `--json` for machine-readable output.
- Long transcripts: `cap caps transcript <id> --format text --output "%TEMP%\dtc-video\<id>-transcript.txt"`.
- video-feedback uses a temp dir inside the project (`.video-feedback-tmp/`). Do not send frames through `/tmp/`.
- Password-protected Caps: the operator runs `cap caps unlock <id>` in a terminal. Never accept a password in chat.

---

## Skill wiring status

| Piece | Path | Status |
|-------|------|--------|
| Router | `SKILL.md` | Live |
| Deprecated stub | old router folder (redirect only) | Redirect only |
| Governor | `../cognee-decision-trace-capture/SKILL.md` | Cap intake table; S0–S7 unchanged |
| Multimodal | skill `video-feedback` | Cap branch in §3 |
| Allowlist | `permissions.json` | `cap:caps_get`, `cap:caps_context`, `cap:caps_wait` |
| Local mirror | `../cognee-decision-trace-capture/references/decision-trace-routing.md` | Cap router intake |
