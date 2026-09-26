# Gate modes

Invoke-time choice. Persist as `gate_mode` on the run manifest. Operator may change mid-run via `advance-run.mjs --set-gate-mode` (affects subsequent stages only).

Ask **`copywriting_model` in the same first-run turn** when that field is unset — see [copywriting-model.md](copywriting-model.md). The two choices are independent.

## Modes

| Mode | Behavior |
|------|----------|
| `review` | After **every** completed produce stage, set status `awaiting_approval` and **stop the turn**. Wait for operator OK (or revise request) before the next stage. |
| `auto` | After a slot is selected, chain `brief → draft → edit → polish → images` without pausing between produce stages. Pause only on missing inputs, errors, or explicit operator stop. |

## Plan gate (both modes)

Plan + taxonomy are created by **content-pipeline-init**. This skill only consumes them.

- Missing roadmap or taxonomy → hard-stop (`blocked:need_init_plan`). Do not ask horizon here.
- **`review`:** optional OK on the existing roadmap before slot selection (`await_approval:plan`).
- **`auto`:** proceed to slot selection when the files exist.

Recommended default for a **new campaign**: `review`. Switch to `auto` once the operator trusts stage quality.

## Produce chain

### `review`

1. Complete stage N → write artifact → `stages.{key}.status = awaiting_approval` → `next_action = await_approval:{key}` → stop.
2. On approve → mark stage `complete` → run stage N+1.
3. On revise → re-run stage N (overwrite artifact) → await approval again.

### `auto`

1. Complete brief → immediately run draft → edit → polish → images (same slot).
2. After images → `produce_complete` for the slot → stop (do not start another slot).
3. Any blocked/failed stage stops the chain; report `next_action` and errors.

## Resume

On re-invoke:

1. Read `content-pipeline-run-manifest.json`.
2. Honor `next_action` (e.g. `await_approval:draft`, `select_slot`, `run:edit`).
3. Do not redo `complete` stages unless the operator requests rewrite.
4. After `produce_complete`, starting another post requires a new slot selection (same or new invoke).

## Approval phrases (agent)

Treat as approve for the current `awaiting_approval` stage: “OK”, “approve”, “proceed”, “continue”, “looks good”, “next”.

Treat as revise: “revise”, “redo”, “rewrite”, plus any specific feedback — re-run that stage with feedback applied, then await approval again if still in `review`.
