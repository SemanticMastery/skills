# Subagent stage dispatch (optional)

Use when the host supports the **Task** tool and a stage should run in an isolated subagent. Otherwise the orchestrator agent may execute the stage CONTEXT prompt in-process.

**Copywriting model:** for `plan` / `brief` / `draft` / `edit` / `polish`, pass the run manifest `copywriting_model` as Task `model` when the host allowlists that id. Use `inherit` (or omit `model`) when the pin is `inherit` **and this chat is not Anthropic**. Never pass Claude / Sonnet / Opus / Haiku / any Anthropic id. If the pin is Anthropic, or `inherit` while this chat is Claude: do **not** launch the Task. Suggest Grok 4.6 (`cursor-grok-4.6-high-fast`) or ChatGPT-5.6 Terra (`gpt-5.6-terra-medium`). If the pinned id is not on this host’s Task list, do **not** launch the subagent with a substitute. Stop and tell the operator. `images` ignores this pin.

**Within a produce chain (`auto`):** prefer sequential Tasks (or in-process) — do not parallelize brief/draft/edit/polish/images for the same slot.

## Reliability

- Put all inputs in the prompt (fresh session may have no prior context).
- Append a short line to `{campaign_dir}/04-archives/planning/progress.md` before returning when that folder exists.
- Return structured JSON only when invoked as a stage subagent.

## Task prompt template

Replace `{placeholders}`.

```
You are executing one content-pipeline-run stage.

## Mandatory

1. Read this stage CONTEXT.md exactly and follow its Agent prompt verbatim:
   {stage_context_absolute_path}
2. Do NOT invent research. Use only files under:
   {pipeline_dir}/01-resources/
   and the upstream artifact listed below.
3. campaign_dir (absolute): {campaign_dir}
4. pipeline_dir (absolute): {pipeline_dir}
5. Stage key: {stage_key}
6. Write the stage output ONLY to:
   {output_artifact_absolute_path}
7. When invoked by content-pipeline-run, return ONLY the JSON object below — no prose, no markdown fence.
8. If blocked (missing inputs, empty upstream), status "blocked" and explain in errors[].

## Slot / plan inputs

{slot_json}

## Upstream artifact

{upstream_artifact_absolute_path}

## Horizon (plan stage only)

{horizon_weeks_or_null}

## On completion

Return ONLY this JSON:

{
  "stage_key": "{stage_key}",
  "status": "complete",
  "artifact": "{output_artifact_absolute_path}",
  "errors": [],
  "notes": ""
}

Status values: complete | blocked | failed
```

## Stage keys

| stage_key | CONTEXT path | Typical upstream |
|-----------|--------------|------------------|
| `plan` | `02-plan/CONTEXT.md` | (resources only) |
| `brief` | `03-write/3.1-brief/CONTEXT.md` | roadmap + row |
| `draft` | `03-write/3.2-draft/CONTEXT.md` | brief artifact |
| `edit` | `03-write/3.3-edit/CONTEXT.md` | draft artifact |
| `polish` | `03-write/3.4-polish/CONTEXT.md` | edit artifact |
| `images` | `03-write/3.5-images/CONTEXT.md` | polish artifact |

## Orchestrator merge

On `complete`: update run manifest stage entry, set artifact path, then apply gate-mode rules (`awaiting_approval` vs continue).

On `blocked` / `failed`: set top-level `status` accordingly; do not advance.
