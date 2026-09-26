---
name: dataforseo-paa-queries
description: >-
  Extract People Also Ask (PAA) queries via DataForSEO SERP Google Organic Live
  Advanced. Writes JSON under {project}/outputs/dataforseo-paa-queries/.
  Companion to dataforseo-fanout-queries (keep outputs separate). Use when the
  user asks for PAA, People Also Ask, or DataForSEO PAA extraction with a
  keyword and location.
---

# DataForSEO People Also Ask (PAA)

## When to use

The user provides a **keyword** (or keyword list) and **location_name** and wants PAA questions for content planning.

Companion: `dataforseo-fanout-queries` — may run in parallel on the same seed; **do not merge** outputs in this skill.

## Inputs

| Input | Required | Default |
|---|---|---|
| `keyword` or `keywords` | Yes | — (`keywords` = comma-separated) |
| `location_name` | Yes | — (e.g. `Austin,Texas,United States`) |
| `language_code` | Hard-coded | `en` |
| `device` | Hard-coded | `desktop` |
| `people_also_ask_click_depth` | Hard-coded | `4` |
| Tree depth | Hard-coded | `2` |
| `--no-expand` | No | Skip depth-1 expand SERPs |
| `out-dir` | No | `outputs/dataforseo-paa-queries` |

## Deliverable

| Rule | Detail |
|---|---|
| **Path** | `{project}/outputs/dataforseo-paa-queries/` |
| **File** | `paa-{keyword-slug}-{YYYY-MM-DD}.json` |

JSON includes `paa_questions[]` with `question`, `answer_snippet`, `depth`, `parent`, plus counts, credits, and check URL.

## Auth

REST API — **not** MCP tools.

Env: `DATAFORSEO_USERNAME`, `DATAFORSEO_PASSWORD`

## Execution

Run with **cwd = project folder**. Script lives next to this `SKILL.md`.

```bash
node fetch-paa.mjs --keyword "tree removal" --location_name "Austin,Texas,United States"
node fetch-paa.mjs --keywords "a,b,c" --location_name "Austin,Texas,United States"
node fetch-paa.mjs --keyword "tree removal" --location_name "Austin,Texas,United States" --no-expand
```

- Default expand ≈ `1 + unique_depth1` Live SERP calls per keyword.
- Prefer long timeouts for multi-keyword batches (up to ~10 minutes).
- On 401/429: stop and report; do not hammer retries.

## Cost

Charged per Live SERP task + PAA click depth fees. Report `credits_used` from script output.

## Pipeline notes

Keep separate from fan-out outputs until a later merge / editorial skill.
