---
name: content-pipeline-init
description: >-
  Initialize a campaign content pipeline folder (06-content-pipeline) from the
  Content-Pipeline-ICM template, inventory eight required research resources,
  dispatch missing companion skills in dependency waves, copy the agent pack
  into 01-resources, then write the Editorial Roadmap and SiteSwarm tag
  taxonomy in 02-plan. Requires an explicit campaign/project directory.
  Does not produce 03-write slots. After init_complete, run
  content-pipeline-photo-library if installed, then content-pipeline-run.
  (v1.1.0)
metadata:
  version: "1.1.0"
---

# Content Pipeline Init (Orchestrator)

Human-triggered orchestration for **one campaign / project folder**. Ensures
`06-content-pipeline/` exists (Content-Pipeline-ICM layout), that all
required research files are present in `06-content-pipeline/01-resources/`,
and that `02-plan/` has the Editorial Roadmap plus SiteSwarm tag taxonomy
**before** photo-library classify or produce.

| Rule | Detail |
|------|--------|
| **Campaign pin** | User must specify `campaign_dir` (or project folder) at invoke time. Confirm absolute path before writes. |
| **No reimplementation** | Companion skills own research execution. Orchestrator inventories, gates, dispatches, copies. Plan + taxonomy are owned **here**: read `02-plan/CONTEXT.md` and [siteswarm-tags.md](references/siteswarm-tags.md). |
| **Missing only** | Dispatch companions only for **missing** resource classes. Reuse an existing roadmap/taxonomy unless the operator asks to rebuild. |
| **Waves** | Parallelize within a wave; wait for the wave to finish before the next. |
| **Keyword gate** | If matrix / personas / PAA / fanout are missing, **hard-stop** and require the operator to supply keywords (+ PAA location). Do not infer from campaign context or dossier. |
| **Paid APIs** | No Grok dossier compose or DataForSEO crawl without explicit approval in this session. |
| **Copy, don't rewrite** | Copy matching artifacts into `01-resources/`. Leave intake/source originals untouched. Never invent research. |
| **Dossier sync** | Copy **only** the dossier `.md` into `01-resources/` (skip `.docx` — agent pack). |
| **Horizon** | Before first roadmap: ask **13-week (39)** or **26-week (78)**. Never invent. |
| **SiteSwarm tags** | After `02-plan/editorial-roadmap.md` exists, write `02-plan/siteswarm-tag-taxonomy.md` from topic clusters. Required for `init_complete`. |
| **Manifest SoT** | `{campaign_dir}/06-content-pipeline/content-pipeline-init-manifest.json` |
| **Planning files** | Prefer `{campaign_dir}/04-archives/planning/` for task/findings/progress when that tree exists; otherwise `{campaign_dir}/.planning/`. |

Out of scope: `content-pipeline-run` produce stages (3.1-brief → 3.5-images).

## Companion skills (install separately)

| Resource class | Companion skill (Shareable ZIP when available) |
|----------------|------------------------------------------------|
| dossier | `business-dossier` |
| onpage | `dataforseo-onpage-crawl` |
| matrix / personas | `contentmaxima` (or equivalent matrix/personas export) |
| paa | `dataforseo-paa-queries` |
| fanout | `dataforseo-fanout-queries` |
| product_doc | `product-documentation` |
| icp | `customer-research` |

Also install the **Content-Pipeline-ICM** template folder (from `content-pipeline-icm.zip`) somewhere local and pass it with `--template` (or set `CONTENT_PIPELINE_ICM_TEMPLATE`).

## When to use

- User says **content pipeline init** / **initialize content pipeline**
- User names an explicit **campaign or project directory**

## References

1. [references/resource-patterns.md](references/resource-patterns.md)
2. [references/companion-map.md](references/companion-map.md)
3. [references/subagent-dispatch.md](references/subagent-dispatch.md)
4. [references/manifest-schema.md](references/manifest-schema.md)
5. [references/siteswarm-tags.md](references/siteswarm-tags.md)
6. [references/example-copy-only.md](references/example-copy-only.md)

## Scripts

Skill root = this folder (next to `SKILL.md`).

| Script | Purpose |
|--------|---------|
| `scripts/inventory-resources.mjs` | Scan for 8 resource classes + plan artifacts; print JSON |
| `scripts/sync-resources.mjs` | Copy present artifacts into `06-content-pipeline/01-resources/` |
| `scripts/scaffold-icm.mjs` | Ensure ICM tree from Content-Pipeline-ICM template |
| `scripts/extract-roadmap-clusters.mjs` | Unique `Cluster` values from `editorial-roadmap.md` |

Run with **Node.js 20+**. cwd may be anywhere; pass absolute `--campaign-dir`.

```bash
node scripts/scaffold-icm.mjs --campaign-dir "/abs/path/to/campaign" --template "/abs/path/to/Content-Pipeline-ICM"
node scripts/inventory-resources.mjs --campaign-dir "/abs/path/to/campaign" --write-manifest
node scripts/sync-resources.mjs --campaign-dir "/abs/path/to/campaign"
```

---

## Step 0 — Resolve and confirm

1. Require explicit `campaign_dir`.
2. Verify it exists (prefer folders with intake docs, `outputs/`, or campaign context files).
3. Confirm absolute path before writes.
4. Create a planning trio under `04-archives/planning/` or `.planning/` if useful for long runs.

## Step 1 — Scaffold / verify ICM

Template source (required):

- `--template "/path/to/Content-Pipeline-ICM"`, or
- env `CONTENT_PIPELINE_ICM_TEMPLATE`, or
- a `Content-Pipeline-ICM` folder discoverable next to the campaign / workspace

Target: `{campaign_dir}/06-content-pipeline/`

Copy **missing** template files only. Always ensure `01-resources/ai-isms.md` exists. Do not overwrite filled resources or stage outputs.

## Step 2 — Inventory

Run inventory; write/update `content-pipeline-init-manifest.json`. Report present vs missing classes.

Search roots include `01-intake/`, `outputs/`, and the campaign root (see resource-patterns).

## Step 3 — Keyword gate (if needed)

If any of `matrix`, `personas`, `paa`, `fanout` are missing: hard-stop and collect keywords (+ PAA location). Do not auto-infer.

## Step 4 — Companion waves (missing only)

Use agent subagents / parallel tasks when the host supports them. Each companion reads its own `SKILL.md` and returns structured JSON (see subagent-dispatch).

| Wave | Classes (parallel; skip if present) |
|------|-------------------------------------|
| 1 | `dossier` |
| 2 | `onpage`, `matrix`, `personas`, `paa`, `fanout` |
| 3 | `product_doc`, `icp` |

## Step 5 — Copy into `01-resources`

Run `sync-resources.mjs`. Flat copy; nest under class subfolder only on basename collision. Dossier: **`.md` only**.

## Step 6 — Editorial roadmap (`02-plan`)

Plan is owned here so a SiteSwarm allowlist exists before photo-library classify or produce.

1. If `02-plan/editorial-roadmap.md` exists and the operator did not request rebuild: reuse it.
2. Else: ask horizon **13** or **26** → record `plan.horizon_weeks` on the init manifest → read `02-plan/CONTEXT.md` → execute the **Agent prompt** verbatim using `01-resources/` inputs. Write **only** the markdown table to `02-plan/editorial-roadmap.md`.
3. Do not start `content-pipeline-run` from this step.

## Step 7 — SiteSwarm tag taxonomy

If `siteswarm-tag-taxonomy.md` is missing (or the operator asked to rebuild / the Cluster set changed), follow [siteswarm-tags.md](references/siteswarm-tags.md) now — before `init_complete`.

```bash
node scripts/extract-roadmap-clusters.mjs --campaign-dir "/abs/path/to/campaign"
```

Write SoT at `02-plan/siteswarm-tag-taxonomy.md`. Sync an existing `04-publish/` copy only. Do not seed dummy CMS posts. Missing SiteSwarm site is not a hard-stop.

Record `plan.roadmap` and `plan.siteswarm_taxonomy` on the init manifest.

## Step 8 — Complete

Manifest `status: init_complete` only when all 8 classes exist under `06-content-pipeline/01-resources/`, `ai-isms.md` is present, **and** both `02-plan/editorial-roadmap.md` and a SiteSwarm taxonomy file exist.

Otherwise set `init_partial` (resource gaps) or `awaiting_horizon` / `awaiting_plan` / `awaiting_taxonomy`.

Do not start produce (3.1→3.5) in this skill. If `content-pipeline-photo-library` is installed, run it next so classify can use the taxonomy. Then the writing team can run `content-pipeline-run`.

## Resume

If the manifest is `init_partial` or mid-wave failures:

1. Re-read the manifest + re-inventory.
2. Dispatch only still-missing classes.
3. Re-apply the keyword gate if keyword-backed classes remain missing.

If resources are present but plan artifacts are missing (`awaiting_horizon` / `awaiting_plan` / `awaiting_taxonomy`):

1. Resume at Step 6 or Step 7. Do not re-dispatch research companions.
2. Old campaigns marked `init_complete` with no roadmap/taxonomy: finish Steps 6–7 before photo library.
