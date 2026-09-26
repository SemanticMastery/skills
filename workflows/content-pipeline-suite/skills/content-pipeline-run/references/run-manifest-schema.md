# Run manifest schema

Path:

`{campaign_dir}/06-content-pipeline/content-pipeline-run-manifest.json`

Single source of truth for run progress. Orchestrator and `scripts/*.mjs` read/write between steps.

## Example

```json
{
  "schema_version": 1,
  "skill": "content-pipeline-run",
  "campaign_dir": "/absolute/path/to/Example-Campaign",
  "pipeline_dir": "/absolute/path/to/Example-Campaign/06-content-pipeline",
  "status": "in_progress",
  "gate_mode": "review",
  "copywriting_model": "copywriter-gemma4-31b",
  "copywriting_via": "external",
  "copywriting_host": "zed",
  "updated_at": "2026-08-04T14:00:00.000Z",
  "plan": {
    "horizon_weeks": 13,
    "artifact": "/absolute/path/to/.../02-plan/editorial-roadmap.md",
    "siteswarm_taxonomy": "/absolute/path/to/.../02-plan/siteswarm-tag-taxonomy.md",
    "status": "complete",
    "approved": true
  },
  "active_slot": {
    "post": 1,
    "week": 1,
    "working_title": "Example Title",
    "trigger_word": "example phrase",
    "cluster": "Example Cluster",
    "target_persona": "Example Persona",
    "status": "draft_complete"
  },
  "stages": {
    "plan": {
      "status": "complete",
      "artifact": "/absolute/path/to/.../02-plan/editorial-roadmap.md",
      "updated_at": "2026-08-04T14:00:00.000Z"
    },
    "brief": {
      "status": "complete",
      "artifact": "/absolute/path/to/.../3.1-brief/post-01-brief.md",
      "updated_at": "2026-08-04T14:10:00.000Z"
    },
    "draft": {
      "status": "awaiting_approval",
      "artifact": "/absolute/path/to/.../3.2-draft/post-01-draft.md",
      "updated_at": "2026-08-04T14:20:00.000Z"
    },
    "edit": {
      "status": "pending",
      "artifact": null,
      "updated_at": null
    },
    "polish": {
      "status": "pending",
      "artifact": null,
      "updated_at": null
    },
    "images": {
      "status": "pending",
      "artifact": null,
      "updated_at": null
    }
  },
  "next_action": "await_approval:draft",
  "errors": [],
  "notes": []
}
```

## `plan.siteswarm_taxonomy`

Absolute path to the init-owned `02-plan/siteswarm-tag-taxonomy.md` (or the existing `04-publish/` copy if that is the only file). Record with `--set-siteswarm-taxonomy`. Do not create the file from this skill.

## Top-level `status`

| Value | Meaning |
|-------|---------|
| `in_progress` | Run active; see `next_action` |
| `awaiting_slot` | Plan artifacts present; need Post # |
| `awaiting_approval` | Gate mode paused for operator OK |
| `produce_complete` | Active slot finished through images |
| `blocked` | Missing init/resources or unrecoverable error |
| `failed` | Stage execution failed |

## Stage `status`

| Value | Meaning |
|-------|---------|
| `pending` | Not started |
| `in_progress` | Currently executing |
| `awaiting_approval` | Artifact written; waiting for OK (`review`) |
| `complete` | Approved / finished for this slot |
| `blocked` | Missing inputs |
| `failed` | Execution error |

## `next_action` patterns

| Pattern | Meaning |
|---------|---------|
| `check_ready` | Run readiness gate |
| `blocked:need_init_plan` | Roadmap or SiteSwarm taxonomy missing — run `content-pipeline-init` |
| `await_approval:plan` | Wait OK on the existing roadmap (review mode only; do not write a new plan) |
| `select_slot` | Ask for Post # |
| `run:brief` / `run:draft` / `run:edit` / `run:polish` / `run:images` | Execute that produce stage |
| `await_external:write` | `copywriting_via=external`: wait for Zed (or other host) to finish **3.1→3.4** in one stay; resume here at images |
| `await_approval:brief` (etc.) | Wait OK on that stage |
| `done:slot` | Slot produce_complete |
| `blocked:...` | Explain in `errors[]` |

## `gate_mode`

`review` | `auto` — see [gate-modes.md](gate-modes.md).

## `copywriting_model`

`inherit` | `<model-id>` — see [copywriting-model.md](copywriting-model.md).

Used for copy stages. Missing/null on an existing manifest means **ask** before the next copy stage (do not invent Claude or silently inherit). **Anthropic/Claude ids are prohibited.** Cursor-session suggestions: `cursor-grok-4.6-high-fast` (Grok 4.6) or `gpt-5.6-terra-medium` (ChatGPT-5.6 Terra). `inherit` is valid only when this chat is not Anthropic.

## `copywriting_via` / `copywriting_host`

`session` | `external` — see [copywriting-model.md](copywriting-model.md).

`copywriting_host` is an optional label (`zed`, …). When `via=external`, this host must **not** write `brief` / `draft` / `edit` / `polish`. Plan and `images` stay here. Unset `via` on an old manifest means `session`.

## Init dependency

Run does **not** write the init manifest. It requires:

`{pipeline_dir}/content-pipeline-init-manifest.json` with `status: init_complete`

plus filesystem presence of all 8 resource classes and `ai-isms.md` under `01-resources/`, plus `02-plan/editorial-roadmap.md` and a SiteSwarm tag taxonomy (see `check-ready.mjs`).
