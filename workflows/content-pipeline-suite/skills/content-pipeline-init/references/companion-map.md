# Companion map

Canonical skill paths and dependency waves for `content-pipeline-init`.

Skills root: `{HOST_SKILLS_ROOT}`. After the suite INSTALL flatten, that is the user Cursor skills folder (`%USERPROFILE%\.cursor\skills` or `~/.cursor/skills`) and the Claude sibling (`~/.claude/skills`).

Resolve each companion only at `{HOST_SKILLS_ROOT}/{name}/SKILL.md`.

## Resolution order

For each companion, use only this path:

1. `{HOST_SKILLS_ROOT}/{name}/SKILL.md`

## Companion table

| Class ID | Skill name | Canonical SKILL.md (prefer) | Fallback | Typical write location |
|----------|------------|-----------------------------|----------|------------------------|
| `dossier` | `business-dossier` | User: `{user-skills}\business-dossier\SKILL.md` | — | Source: `{campaign}/01-intake/1.1-docs/*-Dossier.md` (+ `.docx` in intake only). Pipeline pack: copy `.md` only into `06-content-pipeline/01-resources/` |
| `onpage` | `dataforseo-onpage-crawl` | Project: `dataforseo-onpage-crawl/SKILL.md` | — | `{campaign}/01-intake/1.2-audit/onpage-crawl-*.{csv,xlsx}` |
| `matrix` | `contentmaxima` (Matrix workflow) | Project: `contentmaxima/SKILL.md` | — | `{campaign}/01-intake/1.2-audit/contentmaxima/*_matrix*` |
| `personas` | `contentmaxima` (Personas workflow) | Project: `contentmaxima/SKILL.md` | — | `{campaign}/01-intake/1.2-audit/contentmaxima/*_personas*` |
| `paa` | `dataforseo-paa-queries` | Project: `dataforseo-paa-queries/SKILL.md` | — | `{campaign}/01-intake/1.2-audit/paa-queries/paa-*` |
| `fanout` | `dataforseo-fanout-queries` | Project: `dataforseo-fanout-queries/SKILL.md` | — | `{campaign}/01-intake/1.2-audit/fanout-queries/fanout-queries-*` |
| `product_doc` | `product-documentation` | User: `{user-skills}\product-documentation\SKILL.md` | — | `{campaign}/01-intake/1.1-docs/Product-Documentation.md` only (no `outputs/` write) |
| `icp` | `customer-research` | — | Global | Prefer `{campaign}/01-intake/1.1-docs/*ICP*.md`; also `outputs/customer-research/` |

## Waves

| Wave | Class IDs (parallel; skip if already present) | Hard dependencies |
|------|-----------------------------------------------|-------------------|
| 1 | `dossier` | Explicit approval before paid Grok compose |
| 2 | `onpage`, `matrix`, `personas`, `paa`, `fanout` | `onpage` needs dossier domain; `matrix`/`personas`/`paa`/`fanout` need user-supplied keywords (+ PAA location); crawl needs explicit approval |
| 3 | `product_doc`, `icp` | `product_doc` requires dossier + onpage present on disk before dispatch |

### Wave 2 notes

- Launch Matrix and Personas as **two separate Tasks** (same skill, different workflow) when both are missing.
- PAA / fanout: one Task per skill; pass the full keyword list from the keyword gate (child skill may loop keywords or the operator may prefer one Task per keyword — default: one Task with all keywords listed; child follows its SKILL.md).
- Do not start Wave 2 crawl until Wave 1 dossier is `complete` or `skipped` with an existing domain-bearing dossier on disk.

### Wave 3 notes

- `product-documentation` child skill hard-gates on dossier + onpage — only dispatch when both classes are present.
- `customer-research`: instruct subagent to produce an ICP markdown whose **basename includes `icp`**, written under `01-intake/1.1-docs/` (Golden Image) or `outputs/customer-research/` — so inventory can detect the class.

## Paid / HITL gates (orchestrator)

| Action | Gate |
|--------|------|
| Dossier Grok compose | Explicit user approval after dry-run (per `business-dossier` / `campaign-init`) |
| DataForSEO on-page crawl | Explicit user approval; dossier domain required |
| DataForSEO PAA / fanout | Keywords (+ location for PAA) required; spend follows child skill |
| Content Maxima | Keywords required; follow `contentmaxima` auth/tooling |

## What the orchestrator must not do

- Reimplement crawl, dossier compose, Content Maxima automation, or PAA/fanout fetch logic
- Infer seed keywords from campaign docs
- Mark a class present without a matching non-empty file on disk
- Skip the Editorial Roadmap or SiteSwarm taxonomy after resources are ready — those are **this skill**, not `content-pipeline-run`
