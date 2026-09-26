---
name: business-dossier
description: >-
  Produce a TSCR business dossier (Markdown + DOCX) for a local entity using
  xAI Grok with live search and optional SerpAPI/Firecrawl pre-gather. Writes
  to {project}/outputs/business-dossier/. Use for "business dossier",
  "compose dossier", or a single source of truth for a local business.
  (v1.3.0)
metadata:
  version: "1.3.0"
---

# Business Dossier (TSCR)

**Package:** `business-dossier-v1.3.0.zip` (same version as `metadata.version` above).

## When to use

Start of competitive / local SEO work when the project does **not** yet have a dossier. The dossier is the single source of truth for firmographics, leadership, digital footprint, sentiment, and a GBP-ready description.

## Inputs

| Input | Required | Notes |
|---|---|---|
| `name` | Yes | Company / DBA |
| `address` | Yes | Primary street address. Geocoded to **Latitude:** / **Longitude:** in `[II]` (Nominatim; optional `--latitude` / `--longitude` override). |
| `phone` | Yes | Primary phone |
| `website` | Yes | Official website URL |
| `gbp_url` | Yes | Google Maps / GBP URL. Share, maps.app, or `/maps/place/` links are resolved to `https://www.google.com/maps?cid={CID}` before write. Compose **stops** if CID cannot be resolved. |
| `project_dir` | Yes | Project folder root |

If any required field is missing, ask once for Company Name, Address, Phone, Website, and Google Maps / GBP URL (share, maps.app, or CID URL).

## Outputs

`{project}/outputs/business-dossier/{Business-Name}-Dossier.md`  
`{project}/outputs/business-dossier/{Business-Name}-Dossier.docx`

Override with `--output-dir` if needed.

## Auth (environment variables)

| Variable | Required | Used for |
|---|---|---|
| `GROK_API_KEY` | Yes | xAI Grok synthesis |
| `SERPAPI_API_KEY` | Recommended | GBP / place pre-gather |
| Firecrawl CLI auth | Recommended | Website + review/owner searches |

## Model routing

| Step | Tool |
|---|---|
| Pre-gather | SerpAPI + Firecrawl CLI (unless `--skip-pregather`) |
| Synthesis | xAI Grok `grok-4.5` with web_search + x_search |

Do **not** substitute other models for the synthesis step unless the user explicitly overrides.

## Execution

From a shell (cwd can be anywhere; pass absolute `--project-dir`):

```bash
cd path/to/business-dossier/scripts
npm install   # first time only

node compose-business-dossier.mjs \
  --name "BUSINESS NAME" \
  --address "FULL ADDRESS" \
  --phone "PHONE" \
  --website "https://example.com" \
  --gbp-url "GBP_URL" \
  --project-dir "/absolute/path/to/project"
```

Dry run:

```bash
node compose-business-dossier.mjs ... --dry-run
```

Grok runs often take **2–10 minutes**. Validate stdout JSON `section_validation.ok: true`. Report `cost_usd` when present.

## Report structure (required sections)

`[I]` Executive Summary → `[VII]` Business Description (GBP-ready, <1500 chars). `[II]` must include labeled **GBP URL:** as `https://www.google.com/maps?cid={CID}` and **GBP CID:** (raw Company ID), plus **Latitude:** / **Longitude:** from the intake address geocode (and **Geocode source:** / **Geocoded address:** when known). `[V]` Google Maps (GBP) row must use that same CID URL — never `maps.app.goo.gl` or `share.google`. See [prompts/system-prompt.md](prompts/system-prompt.md) and [reference.md](reference.md). Resolve CID with `scripts/resolve-maps-cid.mjs`; geocode with `scripts/lib/geocode-address.mjs`.

## Platform note

DOCX packaging uses PowerShell `Compress-Archive` (Windows). Markdown output works cross-platform; generate DOCX on Windows or ask the agent for MD-only if needed.

## Examples

See [examples.md](examples.md).
