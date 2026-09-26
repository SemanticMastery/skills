# Content-Pipeline-ICM — Context (Layer 1)

## Project

- **Name:** Content-Pipeline-ICM
- **Type:** Reusable **campaign template**. Duplicate this entire folder for each campaign; fill campaign-specific resources; leave ICM routers and stage prompts intact unless intentionally updated for that campaign.
- **Goal:** Orchestrate a multi-step content pipeline where each stage folder acts as an independent agent with its own prompt. Each stage produces an output that the next stage consumes—without spawning separate skills per step.
- **Desired outcome:** A content plan for either 13 or 26 weeks, then a production workflow that turns planned slots into publish-ready articles.
- **Tools / services:** Mostly processing files in `01-resources/`. Publishing platform is **campaign-specific** — keep `04-publish` generic in the template; wire CMS/API/MCP when deploying a campaign copy.

## Template resources

| Class | Location | Files |
|-------|----------|-------|
| Always included (ships with every copy) | `01-resources/ai-isms.md` | Banned-language reference for draft / edit / polish |
| Campaign-supplied (required before `02-plan`) | `01-resources/` | Content Maxima Matrix; Personas; dataforseo-paa-queries; dataforseo-fanout-queries; business-dossier; dataforseo-onpage-crawl; customer-research (ICPs); product-documentation |
| Optional | `01-resources/` | Voice DNA (author and/or brand) and any other campaign extras |

## Stages

| Stage | Job |
|-------|-----|
| `01-resources` | Hold permanent + campaign source pack (do not rewrite source of truth here) |
| `02-plan` | Build the 13- or 26-week Editorial Roadmap from campaign resources |
| `03-write` | Route piece production through brief → draft → edit → polish → images |
| `03-write/3.1-brief` | Write the piece brief from plan slot + resources |
| `03-write/3.2-draft` | Draft the article from the brief (uses `ai-isms.md`) |
| `03-write/3.3-edit` | Structural/editorial pass (no reintroducing ai-isms) |
| `03-write/3.4-polish` | CMS-ready text package → `3.5-images` |
| `03-write/3.5-images` | Library-first images, Fal.ai fallback → hard-stop (publish later) |
| `04-publish` | Hold publish-ready assets; platform integration filled per campaign |
| `05-archives` | Store completed plans/runs off the live pipeline |

## Task routing

| If the task is about… | Go to |
|-----------------------|-------|
| Inventorying permanent vs campaign resources; `ai-isms.md` | `01-resources/` |
| Dropping campaign research (Matrix, Personas, PAA, Fanout, Dossier, Onpage Crawl, ICPs, Product Docs) | `01-resources/` |
| Choosing 13 vs 26 weeks; building or revising the roadmap | `02-plan/` |
| Which produce step to run next for a piece | `03-write/CONTEXT.md` |
| Piece brief only | `03-write/3.1-brief/` |
| First full draft | `03-write/3.2-draft/` |
| Editorial rewrite | `03-write/3.3-edit/` |
| Final polish / CMS package | `03-write/3.4-polish/` |
| Produce images from polish placeholders (library, else Fal) | `03-write/3.5-images/` |
| Publish-ready pack / campaign platform push | `04-publish/` |
| Completed run / cold storage | `05-archives/` |

## Rules

Canonical rules: `PROJECT-RULES.mdc`. Stage details live in each stage's `CONTEXT.md`. Harness files are thin pointers only.

## Orchestration habit

1. Pin this folder (or the campaign duplicate) as the active path.
2. Confirm `01-resources/ai-isms.md` is present; fill campaign-supplied files before running `02-plan`.
3. Run **one stage at a time**: read that stage's `CONTEXT.md`, use prior stage outputs as inputs, write outputs only into that stage (or the path its CONTEXT names).
4. Do not skip ahead of an empty upstream output unless the operator explicitly overrides.
5. When duplicating for a campaign: keep stage Agent prompts; customize `04-publish` only when the publishing platform is known.
