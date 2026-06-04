---
name: business-dossier
license: Apache-2.0
copyright: Copyright 2026 SemanticMastery — coaching content (Glen Patel TSCR prompts)
description: >-
  Produce a Glen Patel TSCR business dossier (Markdown + DOCX) for a local
  entity using xAI Grok 4.3 live search. Required input is NAPW plus Google
  Maps share URL. Saves deliverables to the client project folder root. Use at
  the start of a competitive link analysis or full SEO audit when no team
  dossier exists yet; triggers on "business dossier", "Glen Patel dossier",
  "compose dossier", or "single source of truth" for a local business.
disable-model-invocation: true
---

# Business Dossier (Glen Patel / TSCR)

## When to use

Invoke at the **start** of a competitive link analysis or full SEO audit when the client project folder does **not** yet contain a dossier.

The dossier is the **single source of truth** for firmographics, leadership, digital footprint, sentiment, and GBP-ready business description. Downstream skills (schema markup, xMultiplier, audit paste blocks) may reference it.

**Out of scope:** on-page crawl, GBP category entity breakdown, brand SERP audit. Run those as separate skills after the dossier exists.

## Inputs

| Input | Required | Notes |
|---|---|---|
| `name` | Yes | Company / DBA name |
| `address` | Yes | Primary street address |
| `phone` | Yes | Primary phone |
| `website` | Yes | Official website URL |
| `gbp_url` | Yes | Google Maps / GBP share URL |
| `project_dir` | Yes | Client project folder root (cwd when auditing) |

If any required field is missing, ask once:

> Please provide the Company Name, Address, Phone Number, Website, and GB Map Share URL.

### Input modes

1. **Manual NAPW + GBP URL** (preferred)
2. **GBP URL only:** extract name, address, phone, website from SerpAPI via `get-gbp-categories.mjs`, confirm with the user before running Grok
3. **Existing partial dossier:** if `{Name} Dossier.md` exists and is current, skip generation; offer refresh only if user asks

## Output location (mandatory)

Write **only** these deliverables to the **client project folder root** (not `audit/`):

| File | Purpose |
|---|---|
| `{Business Name} Dossier.md` | Primary agent/human reference |
| `{Business Name} Dossier.docx` | Team / client Word copy |

Pre-gather scratch (SerpAPI + Firecrawl) runs in a **temp directory** and is **deleted after success**. Run metadata and validation return on **stdout JSON only** — no `.json`, `.log`, or `.firecrawl/` in the project folder.

Use `--keep-artifacts` on the compose script only when debugging a failed run.

Example: `Arbor Max Tree Service Dossier.md` (matches existing Semantic Links convention).

## Model routing (mandatory)

| Step | Model / tool | Rule |
|---|---|---|
| **Pre-gather (before Grok)** | **SerpAPI** + **Firecrawl CLI** | Mandatory unless `--skip-pregather` |
| Dossier synthesis + write | **xAI Grok `grok-4.3`** via `compose-business-dossier.mjs` | **Do not** substitute Claude, Auto, or other models |
| Grok web/X search | xAI Responses API `tools: web_search, x_search` | Runs after pre-gather; triangulates seeds |

**Auth (Windows User env only — never read repo `.env`):**

| Variable | Used by |
|---|---|
| `GROK_API_KEY` | Grok synthesis (required) |
| `SERPAPI_API_KEY` | Pre-gather: `get-gbp-categories.mjs` + place detail fetch |
| Firecrawl CLI auth | Pre-gather: website scrape + review/owner/BBB/registry searches (`firecrawl --status`) |

Restart Cursor after changing User env.

## Pre-gather pipeline (mandatory before Grok)

The compose script runs this sequence automatically:

| Step | Tool | Captures |
|---|---|---|
| 1 | SerpAPI `get-gbp-categories.mjs` | GBP NAP, categories, place_id |
| 2 | SerpAPI `google_maps` place_id | Rating, reviews, hours, open state |
| 3 | Firecrawl `scrape` | Official website markdown |
| 4 | Firecrawl `search --scrape` | Reviews (Google/Yelp/industry) |
| 5 | Firecrawl `search` | Owner/principal + LinkedIn signals |
| 6 | Firecrawl `search` | BBB profile |
| 7 | Firecrawl `search` | Secretary of state / LLC registry hints |

Artifacts: temp scratch dir only (`{tmpdir}/business-dossier-{slug}-{timestamp}/`), removed after success.

Grok receives the full pre-gather appendix in its user message and must **verify** every seed via TSCR (not copy blindly).

Skip flags: `--skip-pregather` (all seeds) or `--skip-firecrawl` (SerpAPI only).

## DOCX format (Box Tree Care template)

The `.docx` matches team dossier layout (image omitted):

1. **GBP header block** (bold + italic Aptos): business name, star rating, category, hours — from SerpAPI pre-gather
2. **TSCR intro paragraph**: "Based on the data points retrieved..."
3. **Sections [I]–[VII]**: bold Aptos headers (no trailing colon)
4. **Label lines**: bold label + normal value (`Legal Name:`, `Sentiment Score:`, etc.)
5. **Section [V] table**: 3 columns — `Platform | Handle/Link | Status` with bordered Word table

Markdown `.md` stays clean for agents; Word styling is applied only in `.docx` generation.

## Workflow

1. **Check for existing dossier** — glob `*Dossier.md` in `project_dir`. If found and user did not ask to refresh, stop and point to existing file.
2. **Collect NAPW + GBP URL** — prompt if missing.
3. **Dry run** (optional) — validate paths and keys without API spend.
4. **Run compose script** — pre-gather → Grok → MD + DOCX (see below).
5. **Validate** — stdout JSON must show `section_validation.ok: true`. If exit code 2, read the partial `.md` and stdout; re-run with clarified inputs or ask the user.
6. **Deliver in chat** — business name, paths to `.md` and `.docx` only, executive summary preview (first 3 sentences), any discrepancy flags from [II]–[VI].

## Execution: context-mode for long runs

Grok dossier calls often take **2–10 minutes**. Use **`ctx_batch_execute`** on server `user-context-mode` (never raw Shell for the Grok call):

```json
{
  "commands": [{
    "label": "business-dossier",
    "command": "node \"{{BUNDLE_ROOT}}/scripts/seo/compose-business-dossier.mjs\" --name \"BUSINESS NAME\" --address \"FULL ADDRESS\" --phone \"PHONE\" --website \"https://example.com\" --gbp-url \"GBP_URL\" --project-dir \"PROJECT_DIR\""
  }],
  "queries": [
    "markdown",
    "docx",
    "section_validation",
    "EXECUTIVE SUMMARY",
    "FIRMOGRAPHICS",
    "error",
    "Missing GROK"
  ],
  "timeout": 600000,
  "concurrency": 1
}
```

**Dry run** (free — paths + key presence):

```json
{
  "commands": [{
    "label": "business-dossier-dry",
    "command": "node \"{{BUNDLE_ROOT}}/scripts/seo/compose-business-dossier.mjs\" --name \"BUSINESS NAME\" --address \"ADDRESS\" --phone \"PHONE\" --website \"https://example.com\" --gbp-url \"GBP_URL\" --project-dir \"PROJECT_DIR\" --dry-run"
  }],
  "queries": ["dry_run", "outputs", "grok_api_key_present"],
  "timeout": 30000,
  "concurrency": 1
}
```

Replace `PROJECT_DIR` with the resolved absolute client folder. On Windows paths with curly apostrophes, resolve via parent `fs.readdirSync` rather than hard-coding variants. Pass the full `--name` value (e.g. `St.Mary's Garage Door Services`), not the folder basename alone.

## Report structure (locked)

The Glen Patel system prompt lives at [prompts/glen-patel-system.md](prompts/glen-patel-system.md). **Do not paraphrase** section headers or TSCR constraints.

Required sections:

1. `[I] EXECUTIVE SUMMARY`
2. `[II] FIRMOGRAPHICS`
3. `[III] SCOPE OF OPERATIONS`
4. `[IV] LEADERSHIP & CREDENTIALS`
5. `[V] DIGITAL ECOSYSTEM` (table: company + owner socials)
6. `[VI] PUBLIC SENTIMENT ANALYSIS` (Sentiment Score 1–5; Product Quality / Customer Service / Professional Reliability)
7. `[VII] BUSINESS DESCRIPTION` (GBP-ready, under 1500 characters)

## Cost and errors

| Item | Cost / behavior |
|---|---|
| SerpAPI pre-gather | ~2 credits (categories + place detail) |
| Firecrawl pre-gather | ~5–8 operations (scrape + searches); check `firecrawl --status` credits |
| xAI Grok 4.3 + web/X search | Variable; warn before run if user cares about spend |
| Dry run | Free |

| Condition | Action |
|---|---|
| Missing `GROK_API_KEY` | Stop; user sets Windows User env + restarts Cursor |
| xAI 429 / timeout | Retry once after 60s; then report error |
| `section_validation.ok: false` | Show missing headers; do not treat dossier as complete |
| Wrong business (GBP mismatch) | Stop; ask for corrected GBP URL or Place ID |
| Dossier already exists | Skip unless user requested refresh |

## Integration with other skills

| Skill | Relationship |
|---|---|
| **This skill** | First — establishes business truth document |
| `gbp-category-entity-breakdown` | Uses same GBP URL; reads dossier for business name context |
| `serpapi-brand-serp-audit` | Brand + postal from dossier [II] |
| `schema-markup-generator` | NAP, owner, services, socials from dossier |
| `dataforseo-onpage-crawl` | Domain from dossier [II] website |

## Examples

See [examples.md](examples.md).

## When invoked by seo-audit-pipeline

Return **only** this JSON to the orchestrator (no prose):

```json
{
  "step": 1,
  "step_key": "1_business_dossier",
  "skill": "business-dossier",
  "status": "complete",
  "artifacts": ["absolute paths to Dossier.md and Dossier.docx"],
  "extracted_fields": {
    "business_name": "",
    "website": "",
    "brand": "",
    "postal_code": "",
    "gbp_url": "",
    "phone": ""
  },
  "errors": [],
  "cost_notes": []
}
```

Use `status: "skipped"` when dossier already exists and refresh was not requested; still populate `extracted_fields` from `[II]`.

## Additional resources

- xAI API + script flags: [reference.md](reference.md)
- Glen Patel system prompt (verbatim): [prompts/glen-patel-system.md](prompts/glen-patel-system.md)
