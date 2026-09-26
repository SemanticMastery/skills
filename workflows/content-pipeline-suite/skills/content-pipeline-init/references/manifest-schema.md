# Manifest schema

Path:

`{campaign_dir}/06-content-pipeline/content-pipeline-init-manifest.json`

Single source of truth for init progress. Orchestrator reads/writes between steps.

## Example

```json
{
  "schema_version": 1,
  "skill": "content-pipeline-init",
  "campaign_dir": "/absolute/path/to/Example-Campaign",
  "pipeline_dir": "/absolute/path/to/Example-Campaign/06-content-pipeline",
  "template_source": "/absolute/path/to/Content-Pipeline-ICM",
  "status": "in_progress",
  "updated_at": "2026-08-03T22:00:00.000Z",
  "inputs": {
    "keywords": [],
    "paa_location": null,
    "paid_compose_approved": false,
    "crawl_approved": false
  },
  "scaffold": {
    "status": "complete",
    "ai_isms_present": true
  },
  "resources": {
    "matrix": {
      "class_id": "matrix",
      "state": "present",
      "matches": [],
      "companion_skill": "contentmaxima",
      "wave": 2,
      "companion_status": "skipped",
      "artifacts": [],
      "errors": []
    }
  },
  "sync": {
    "status": "pending",
    "copied": [],
    "skipped": [],
    "errors": []
  },
  "plan": {
    "horizon_weeks": 13,
    "roadmap": "/absolute/path/to/06-content-pipeline/02-plan/editorial-roadmap.md",
    "siteswarm_taxonomy": "/absolute/path/to/06-content-pipeline/02-plan/siteswarm-tag-taxonomy.md",
    "status": "complete"
  },
  "cost_notes": [],
  "gaps": []
}
```

## Top-level `status`

| Value | Meaning |
|-------|---------|
| `in_progress` | Init running |
| `awaiting_keywords` | Keyword gate hard-stop |
| `awaiting_approval` | Paid dossier/crawl gate |
| `awaiting_horizon` | Resources ready; need 13 vs 26 before the roadmap |
| `awaiting_plan` | Horizon set; `editorial-roadmap.md` still missing |
| `awaiting_taxonomy` | Roadmap present; `siteswarm-tag-taxonomy.md` still missing |
| `init_partial` | Finished attempt; one or more classes still missing |
| `init_complete` | All 8 classes present in `01-resources/`, `ai-isms.md` present, **and** roadmap + SiteSwarm taxonomy exist |

## `plan`

Owned by this skill (not `content-pipeline-run`). Photo-library classify requires `siteswarm_taxonomy`.

| Field | Type | Notes |
|-------|------|-------|
| `horizon_weeks` | `13` \| `26` \| null | Ask; never invent |
| `roadmap` | string \| null | Absolute path to `02-plan/editorial-roadmap.md` |
| `siteswarm_taxonomy` | string \| null | Absolute SoT path (`02-plan/`, or existing `04-publish/` copy) |
| `status` | string | `pending` \| `complete` |

## Resource object fields

| Field | Type | Notes |
|-------|------|-------|
| `class_id` | string | One of: matrix, personas, paa, fanout, dossier, onpage, icp, product_doc |
| `state` | string | `present` \| `missing` (filesystem under campaign, before or after sync — update after inventory) |
| `matches` | array | `{ path, bytes, mtime }` absolute paths |
| `companion_skill` | string | Skill name |
| `wave` | number | 1, 2, or 3 |
| `companion_status` | string | `pending` \| `skipped` \| `complete` \| `blocked` \| `failed` \| `not_needed` |
| `artifacts` | string[] | From subagent |
| `errors` | string[] | |

`not_needed` = class already present before dispatch.

## `gaps`

Array of `class_id` values still missing after the latest inventory. Empty when resources are ready. Plan-artifact gaps live on `plan` / top-level status, not in this array.

## Destination check

Before setting `init_complete`, verify:

1. Matches exist under `{pipeline_dir}/01-resources/` (not only under `01-intake/`).
2. `{pipeline_dir}/02-plan/editorial-roadmap.md` exists and is non-empty.
3. A SiteSwarm taxonomy exists at `{pipeline_dir}/02-plan/siteswarm-tag-taxonomy.md` (or a pre-existing `{pipeline_dir}/04-publish/siteswarm-tag-taxonomy.md`).
