# Decision-trace routing (Cognee plus local mirror)

**Canonical store:** your Cognee dataset `decision_traces` via `remember`.
**Local mirror:** the same DecisionTrace JSON under the campaign folder that owns `03-decisions/`, after a successful Cognee persist.

Do **not** write local JSON without a successful Cognee `remember`. Cognee is the source of truth for search. The campaign folder is the human-readable archive.

---

## When local mirror is required

| Condition | Local write |
|-----------|-------------|
| Campaign folder path known and `{campaign}/03-decisions/3.2-traces/` exists (or can be created) | **Required** after successful S6 |
| Campaign path unknown / S0 halt / remember failed | **Do not** write |
| Campaign path known but `03-decisions` is missing | Create `03-decisions/3.2-traces/` when the path is a campaign root; otherwise ask once |

**Example campaign root:** a folder named `Ridgeline-Tree-Care` that contains `03-decisions/`.

**Traces directory:**

```text
Ridgeline-Tree-Care/03-decisions/3.2-traces/
```

---

## Path resolution

1. Prefer explicit `campaign_path` / `campaign_folder_path` from user, Cap router intake, Slack skill, or open workspace.
2. Normalize to the **campaign root** (folder that contains `03-decisions`, not the `3.2-traces` folder itself).
3. If user pasted `...\03-decisions\3.2-traces`, strip to campaign root then re-append `03-decisions\3.2-traces`.
4. The campaign root is the folder that owns `03-decisions/`. Ask once if that folder is not obvious.

**Target directory:**

```text
{campaign_root}\03-decisions\3.2-traces\
```

Create `03-decisions` and `3.2-traces` if missing under a valid client campaign root (mkdir only; no deletes). Leave existing `.gitkeep` in place.

---

## Filename convention

One file per successful persist:

```text
{YYYY-MM-DD}_{client_slug}_{trace_id}.json
```

| Part | Source |
|------|--------|
| `YYYY-MM-DD` | UTC date from `captured_at` (or today UTC if missing) |
| `client_slug` | DecisionTrace `client_slug` (kebab-case) |
| `trace_id` | Full UUID from DecisionTrace `trace_id` |

**Example:**

```text
2026-09-28_ridgeline-tree-care_a1b2c3d4-e5f6-7890-abcd-ef1234567890.json
```

**Rules:**

- UTF-8 JSON, pretty-printed (`JSON.stringify(trace, null, 2)` + trailing newline).
- File body = **exact** DecisionTrace object that was sent to Cognee `remember` (same `trace_id`, same fields).
- If the filename already exists with the same `trace_id` content → skip overwrite (idempotent).
- If the filename exists with different content → write `{same-stem}.conflict-{HHmmss}.json` and warn (do not silently clobber).

Optional companion (not required): none. Do not write markdown reports into `3.2-traces/` unless the operator asks; this folder is **JSON traces only**.

---

## Pipeline ownership

| Skill | Responsibility |
|-------|----------------|
| **`cognee-decision-trace-capture`** | After successful S6 `remember`, **S6b** writes local mirror. Returns `local_mirror_path` in S6 result. |
| **`dtc-video`** | Passes `campaign_path` into DTC intake; does **not** write Cognee itself; verifies S6b path in operator summary. |
| **`slack-cognee-decision-capture`** | If `campaign_folder_path` present and remember succeeds, same mirror rules (recommended parity). |
| **`campaign-init`** | Creates empty `3.2-traces/` + `.gitkeep` only; never seed fake traces. |

---

## S6b procedure (agent)

After Cognee `remember` returns success:

1. Confirm payload has `record_type: decision_trace` and `trace_id`.
2. Resolve `traces_dir` = `{campaign_root}/03-decisions/3.2-traces`.
3. `New-Item -ItemType Directory -Force` on `traces_dir` if needed.
4. Build filename from convention above.
5. Write JSON with the Write tool (or `Set-Content -Encoding utf8` one-liner). Prefer Write tool for persistence policy.
6. Report absolute path in operator summary and in S6 return JSON:

```json
{
  "success": true,
  "trace_id": "uuid",
  "dataset": "decision_traces",
  "local_mirror_path": "{campaign}/03-decisions/3.2-traces/2026-09-28_ridgeline-tree-care_uuid.json",
  "local_mirror_error": null
}
```

If campaign path missing after successful Cognee write:

```json
{
  "success": true,
  "trace_id": "uuid",
  "dataset": "decision_traces",
  "local_mirror_path": null,
  "local_mirror_error": "campaign_path_unknown"
}
```

Still treat Cognee success as pipeline success; surface a missing local mirror as a gap so the operator can supply a path.

---

## What not to do

- Do not write local JSON if `remember` failed or was skipped.
- Do not write into agency-only folders without a campaign root (need the leaf campaign that owns the work).
- Do not use `3.1-communications` for traces.
- Do not put session reflections or personal Cognee data here.
- Do not delete prior traces.

---

## Schema

Canonical object: `references/decision-trace-v1.schema.json`  
`source_system` for Cursor DTC / Cap router handoff: **`cognee-dtc`**.  
Cap share URLs go in `source_artifacts` as `{ "type": "url", "ref": "https://cap.so/s/..." }`.

---

## Related

- `SKILL.md` — S6 + S6b
- `../dtc-video/SKILL.md` — campaign_path + verify mirror
- skill `campaign-init` creates an empty `3.2-traces/` scaffold when that skill is installed
- `../dtc-video/references/dtc-video-integration.md`
- Campaign notes may mention the local mirror. Do not put machine paths in the published skill.
