# Manifest schema

Path:

`{campaign_dir}/06-content-pipeline/pipeline-pages-manifest.json`

Single source of truth for `pipeline-pages-init` setup and `content-pipeline-pages` per-page runs.

## Shape

```json
{
  "schema_version": 1,
  "skill": "pipeline-pages-init",
  "campaign_dir": "C:\\...\\Ridgeline-Tree-Care",
  "pipeline_dir": "C:\\...\\Ridgeline-Tree-Care\\06-content-pipeline",
  "setup": {
    "status": "awaiting_reconcile",
    "crawl_source": null,
    "product_doc_source": null,
    "pages": [
      {
        "slug": "tree-removal",
        "url": "https://example.com/tree-removal",
        "offering": "Tree removal",
        "source": "both",
        "decision": "pending",
        "seed": null,
        "matrix_path": null,
        "matrix_status": null
      }
    ]
  },
  "runs": {
    "tree-removal": {
      "gate_mode": "review",
      "copywriting_model": "inherit",
      "copywriting_via": "session",
      "stages": {
        "brief": { "status": "pending", "artifact": null },
        "draft": { "status": "pending", "artifact": null },
        "edit": { "status": "pending", "artifact": null },
        "polish": { "status": "pending", "artifact": null }
      },
      "matrix_terms": {
        "source": "operator",
        "min_count": 40,
        "terms": ["emergency tree removal", "storm damage cleanup"]
      },
      "evidence_gate": {
        "result": "warn",
        "score": 5,
        "covered_rows": [
          "What the service is",
          "How it is delivered",
          "Techniques or tools",
          "What the customer can expect",
          "Average cost or pricing"
        ],
        "pd_last_updated": "2026-09-12",
        "waived_by": null,
        "waived_on": null,
        "message": ""
      },
      "next_action": "run:brief",
      "status": "ready"
    }
  }
}
```

## Setup statuses

`awaiting_reconcile` → `awaiting_seed_confirm` → `matrix_in_progress` → `setup_complete`

## Page fields

| Field | Values |
|-------|--------|
| `source` | `both` \| `crawl` \| `catalog` |
| `decision` | `pending` \| `include` \| `skip` \| `defer` |
| `matrix_status` | `null` \| `recorded` \| `skipped_existing` \| `blocked` |

Intersection pages stay `pending` until `--approve-list`. Leftovers stay flagged until the operator `--decide`s include / skip / defer.

## Runs

`copywriting_via` is `session` in v1. `content-pipeline-pages` writes `runs[slug]`. Setup does not invent run rows.

`matrix_terms.source` is `operator` (user-selected list) or `high_impact_default` (authorized Count 40+ from the Algorithm Trigger Words sheet). The brief must not start until this object is set.

`runs[slug].evidence_gate` is written by `content-pipeline-pages/scripts/pd-coverage.mjs --write` after `--init`. Shape: `{result, score, covered_rows[], pd_last_updated, waived_by, waived_on, message}`. `result` is `block` | `pass` | `warn` | `waived`. `advance-page.mjs --mark-complete brief` refuses when this object is missing or `result` is `block`. A chat waiver stores `waived_by` / `waived_on` keyed to `pd_last_updated`.
