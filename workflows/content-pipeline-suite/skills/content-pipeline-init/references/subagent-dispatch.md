# Subagent dispatch

Use the **Task** tool (`subagent_type: generalPurpose`).  
**Within a wave:** parallel Tasks for missing classes are allowed.  
**Across waves:** wait for the prior wave to finish (and merge results) before starting the next.

## Reliability

- Long DataForSEO / Content Maxima work must use explicit timeouts in ctx calls.
- Subagent prompt may be the first message in a fresh session — put all inputs in the prompt.
- Append a short line to `{campaign_dir}/04-archives/planning/progress.md` before returning.

## Task prompt template

Replace `{placeholders}`.

```
You are executing content-pipeline-init companion work.

## Mandatory

1. Read this SKILL.md exactly and follow it:
   {skill_md_absolute_path}
2. Do NOT invoke other orchestrator skills. Only tools/scripts authorized by the child skill.
3. campaign_dir (absolute): {campaign_dir}
4. Resource class to produce: {class_id}
5. When invoked by content-pipeline-init, return ONLY the JSON object below — no prose, no markdown fence.
6. Do not invent research. If blocked (missing approval, env, keywords, prerequisites), status "blocked" and explain in errors[].

## Inputs from orchestrator

{inputs_json}

## Pipeline overrides

{pipeline_overrides}

## On completion

Return ONLY this JSON:

{
  "class_id": "{class_id}",
  "skill": "{skill_name}",
  "status": "complete",
  "artifacts": ["absolute paths to every deliverable"],
  "errors": [],
  "cost_notes": [],
  "notes": ""
}

Status values: complete | skipped | blocked | failed
```

## Per-class inputs and overrides

### `dossier` — business-dossier

```json
{
  "campaign_dir": "{campaign_dir}",
  "mode": "produce-if-missing",
  "paid_compose_approved": false
}
```

**Overrides:** If `*Dossier.md` already exists under `01-intake/1.1-docs/`, `status: skipped` and list artifacts. If compose needed and `paid_compose_approved` is false, `status: blocked` (orchestrator must get approval and re-dispatch). Prefer global business-dossier skill path from companion-map.

### `onpage` — dataforseo-onpage-crawl

```json
{
  "campaign_dir": "{campaign_dir}",
  "domain": "{from dossier website}",
  "crawl_approved": false
}
```

**Overrides:** Execute via context-mode only (never Shell). If crawl not approved, `blocked`. Write under `01-intake/1.2-audit/` per child skill.

### `matrix` — contentmaxima Matrix

```json
{
  "campaign_dir": "{campaign_dir}",
  "workflow": "Matrix",
  "keywords": ["{user-supplied}"]
}
```

**Overrides:** Use Matrix workflow from contentmaxima SKILL.md. Write under `01-intake/1.2-audit/contentmaxima/`. Basename must include `_matrix`.

### `personas` — contentmaxima Personas

```json
{
  "campaign_dir": "{campaign_dir}",
  "workflow": "Personas",
  "keywords": ["{user-supplied}"]
}
```

**Overrides:** Personas workflow. Basename must include `_personas`.

### `paa` — dataforseo-paa-queries

```json
{
  "campaign_dir": "{campaign_dir}",
  "keywords": ["{user-supplied}"],
  "location": "{user-supplied}"
}
```

**Overrides:** Run via context-mode per child skill. Output under `01-intake/1.2-audit/paa-queries/` with `paa-*` basenames. Process each keyword.

### `fanout` — dataforseo-fanout-queries

```json
{
  "campaign_dir": "{campaign_dir}",
  "keywords": ["{user-supplied}"]
}
```

**Overrides:** Context-mode only. Output `fanout-queries-*` under `01-intake/1.2-audit/fanout-queries/`. Process each keyword.

### `product_doc` — product-documentation

```json
{
  "campaign_dir": "{campaign_dir}",
  "mode": "produce-if-missing"
}
```

**Overrides:** Hard-stop inside child skill if dossier or onpage missing — return `blocked` rather than drafting. Write **only** `01-intake/1.1-docs/Product-Documentation.md`. Do not create or write `outputs/product-documentation/`. Prefer global `product-documentation` skill path when present.

### `icp` — customer-research

```json
{
  "campaign_dir": "{campaign_dir}",
  "deliverable": "ICP markdown",
  "basename_must_include": "icp"
}
```

**Overrides:** Produce an ICP-focused markdown for this campaign. Write to `{campaign_dir}/01-intake/1.1-docs/` with a basename containing `icp` (e.g. `{Campaign}-ICP-Companion.md`) so inventory detects the class. Do not skip the basename requirement.

## Orchestrator merge

After each Task returns:

1. Validate JSON parse.
2. Set `manifest.resources.{class_id}.companion_status` from `status`.
3. Store `artifacts` paths.
4. Append `cost_notes` to `manifest.cost_notes`.
5. Re-run inventory for that class (filesystem is truth over claimed artifacts).
