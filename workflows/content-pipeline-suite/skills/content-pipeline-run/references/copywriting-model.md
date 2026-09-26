# Copywriting model

Invoke-time choice. Persist as `copywriting_model` on the run manifest. Operator may change mid-run via `advance-run.mjs --set-copywriting-model` (affects subsequent copy stages only).

Also persist **where** 03-write copy is produced:

| Field | Values | Meaning |
|-------|--------|---------|
| `copywriting_via` | `session` (default) \| `external` | `session` = this chat / Task. `external` = operator runs brief→polish in another agent already connected to the pinned model (for example Zed). |
| `copywriting_host` | optional label | Free string, e.g. `zed`. Cosmetic for handoff text. Normalize `zed` case-insensitively to `zed`. |

This pin is for **copywriting stages**.  
`images` stays on the orchestrator / Fal helper — do not send image generation through the copywriting model.

When `copywriting_via=external`, **03-write copy** is `brief` → `draft` → `edit` → `polish` only. The Editorial Roadmap is created by **content-pipeline-init**, not this skill. Do not try to Task-dispatch a local/Ollama tag from Cursor.

## Why this exists

Hosts differ. Most team members have **Cursor models only**. Local copywriter routing (Zed / Ollama / your own box) is optional and not assumed.

**Anthropic/Claude is prohibited** for every copy stage (brief → polish). Anthropic now watermarks generated text. Do not pin, inherit, Task-dispatch, or silently substitute Claude / Sonnet / Opus / Haiku / any Anthropic id — even if the operator asks.

## Values

| Value | Meaning |
|-------|---------|
| `inherit` | Use the model already running this chat (orchestrator in-process, or Task with `inherit`). Allowed **only** when this chat is not Anthropic/Claude. If they skip and this chat is not Anthropic: persist `inherit`. |
| `<model-id>` | Pin that exact id for copy stages. Cursor-session suggestions: **Grok 4.6** (`cursor-grok-4.6-high-fast`) or **ChatGPT-5.6 Terra** (`gpt-5.6-terra-medium`). Other non-Anthropic Cursor slugs are OK if they name one. Local/external example: `copywriter-gemma4-31b`. |

Normalize `inherit` case-insensitively to `inherit`. Keep every other id exactly as the operator typed it. Reject Anthropic/Claude ids (see below).

## First-run ask (required when unset)

Ask once when the run manifest does not yet have `copywriting_model` (first `--init`, or an older manifest). Same moment as `gate_mode` is fine.

Offer these **router** choices:

1. **Cursor session — inherit** — use the model already running this chat. Sets `copywriting_via=session`. Best when this chat is already **Grok 4.6** or **ChatGPT-5.6 Terra**. If this chat is Claude/Anthropic: **do not offer inherit as a usable path** — tell them to switch the chat model first.
2. **Cursor session — pin** — they type a Cursor-dispatchable id. Sets `copywriting_via=session`. **Suggest first:** Grok 4.6 (`cursor-grok-4.6-high-fast`) or ChatGPT-5.6 Terra (`gpt-5.6-terra-medium`). Accept another non-Anthropic slug if they name one.
3. **External / local** — they will run **03-write** (brief→polish) in another agent already connected to the copy model (example: Zed + Copywriter-Gemma4-31B). Ask for the model id and an optional host label (`zed`). Persist `copywriting_via=external`. **Do not write brief/draft/edit/polish in this chat.** Team members without local-model access should use option 1 or 2.

Do **not** present a full vendor catalog. Suggest the two Cursor models above, then accept whatever non-Anthropic id they name.

### Anthropic prohibition (hard)

Refuse all of the following. Do not persist them. Do not write copy.

- Any pin matching `anthropic`, `claude`, `sonnet`, `opus`, or `haiku` (case-insensitive)
- `inherit` while **this chat** is Claude / an Anthropic model
- Task `model` set to an Anthropic/Claude id
- Silent fallback to Claude when a pin fails

Tell the operator: switch this chat to **Grok 4.6** or **ChatGPT-5.6 Terra**, or pin `cursor-grok-4.6-high-fast` / `gpt-5.6-terra-medium`, or (if they have it) use external/local.

If they skip, say “default”, or are unsure: persist `inherit` **only if this chat is not Anthropic**. If this chat is Anthropic, stop and ask them to switch.

```bash
node scripts/advance-run.mjs --campaign-dir "..." --init --gate-mode review --copywriting-model inherit
node scripts/advance-run.mjs --campaign-dir "..." --set-copywriting-model "cursor-grok-4.6-high-fast"
node scripts/advance-run.mjs --campaign-dir "..." --set-copywriting-model "gpt-5.6-terra-medium"
node scripts/advance-run.mjs --campaign-dir "..." --set-copywriting-model "copywriter-gemma4-31b" --set-copywriting-via external --set-copywriting-host zed
```

## How the orchestrator applies the pin

1. Read `copywriting_model` from the run manifest (or `status-run.mjs` JSON).
2. If missing/null: **ask** (do not silently assume `inherit` on an existing campaign that never stored the field).
3. **`copywriting_via=external`:** do **not** execute `brief` / `draft` / `edit` / `polish` in this chat and do **not** launch a Task. Print **one** handoff for the whole 03-write chain, set `next_action` to `await_external:write`, and **stop**. Do not bounce the operator back here after each stage.
4. **`copywriting_via=session`** (or via unset — treat as `session`):
   - If the pin is Anthropic/Claude, or `inherit` while this chat is Claude/Anthropic: **stop**. Do not write copy. Suggest Grok 4.6 or ChatGPT-5.6 Terra (or external/local if they have it).
   - **`inherit`:** execute in-process, or Task with `model` omitted / `inherit` — only when this chat is not Anthropic.
   - **Pinned id:** if this host’s Task (or equivalent) allowlists that id, dispatch the stage with that `model`. If the host cannot dispatch it, **stop**. Offer `inherit` (non-Anthropic chat), pin Grok 4.6 / ChatGPT-5.6 Terra, or switch to `external`. **Do not substitute** another model — never Claude/Anthropic.
5. `images`: ignore this pin. Always run here (Fal).
6. `plan` when `via=external`: run in this session (inherit this chat’s model) **only if this chat is not Anthropic**. If this chat is Claude, stop and ask them to switch to Grok 4.6 or ChatGPT-5.6 Terra before writing the roadmap. Do not block plan on the external host otherwise.

In-process execution on `inherit` + `session` is correct when this chat is not Anthropic: the session model *is* the copywriting model.

## External handoff (`via=external`)

**One stay in the external host.** The operator completes **3.1-brief → 3.4-polish** in Zed (or another host) without returning to this chat between stages. This chat picks up at **3.5-images** after polish exists. On Zed + a local copywriter, use a **new Agent thread per stage** so the small context window stays on that CONTEXT prompt — do not stack brief/draft/edit/polish in one thread. That is still one Zed stay, not a Cursor bounce.

Operator opens the **campaign directory** in the named host with the pinned model connected, then runs each 03-write stage CONTEXT prompt in order, verbatim.

**Zed profile (required for file writes):** Zed **Ask** is read-only. Content-pipeline 03-write must use the built-in **Write** profile (read/edit/run) on a **new** thread. Set `agent.default_profile` to `write` in `%AppData%\Zed\settings.json`, and point `agent.default_model` at your local copywriter (for example an Ollama tag served on `http://127.0.0.1:11434`). If the model only pastes copy into chat and never calls `edit_file`, that is a model tool-call problem, not the Ask/Write gate.

When handing off, print all of:

- `copywriting_model` and `copywriting_host`
- Absolute `campaign_dir` (open this folder in Zed)
- For **each** of brief / draft / edit / polish: absolute `CONTEXT.md` and expected artifact path (see [artifact-naming.md](artifact-naming.md))
- Absolute plan / slot inputs (roadmap + selected post)
- Instruction: stay in Zed through polish; follow each CONTEXT Agent prompt verbatim; write only the named artifacts
- Instruction: do **not** run `3.5-images` in the external host
- Instruction: return here **once**, after `post-{NN}-polish.md` exists

```bash
node scripts/advance-run.mjs --campaign-dir "..." --await-external write
```

On resume (`status-run.mjs`):

- If `await_external:write` and **polish is missing**: stay on that action. List which of brief/draft/edit/polish are still missing. Do not write copy here. Do not start images.
- If polish **and** the upstream write files exist: ingest the chain (`--ingest-external-write`). Then `review` waits once on polish; `auto` goes to `run:images`.
- Do **not** hand off stage-by-stage (`await_external:brief` then come back, etc.). That bounce is wrong for this path.

## Custom / local ids

A local or custom tag is a valid pin (example: `copywriter-gemma4-31b` / Copywriter-Gemma4-31B). This skill does not ship LAN URLs, Ollama clients, or cluster routing.

If this host cannot launch a subagent with that id:

- Prefer `copywriting_via=external` when the operator has another app already connected to that model (Zed).
- Or switch this chat to that model and set `inherit` + `session`.
- Or pick a host-dispatchable slug.

Do not silently fall back to the orchestrator model when a pin was set (that would ignore the operator’s choice).

## Resume

On re-invoke, honor the stored pin. Do not re-ask unless the field is missing, the stored pin is Anthropic/Claude, `inherit` is stored while this chat is Claude/Anthropic, or the operator asks to change it.
