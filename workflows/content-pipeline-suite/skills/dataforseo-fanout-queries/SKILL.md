---
name: dataforseo-fanout-queries
description: >-
  Expand a seed keyword into ~120 generated query variants via DataForSEO
  ChatGPT LLM Responses Live. Writes JSON + CSV under
  {project}/outputs/dataforseo-fanout-queries/. Companion to
  dataforseo-paa-queries. Use for query fan-out / Generated Query lists.
---

# DataForSEO Query Fan-Out (LLM Responses Live)

## When to use

The user wants a **usable list of generated search-query variants** (tens to ~120), not sparse LLM-scraper browse crumbs.

## Inputs

| Input | Required | Default |
|---|---|---|
| `keyword` | Yes | Include city/region in the seed when local |
| `count` | No | `120` (clamped 10–200) |
| `model_name` | No | `gpt-4.1-mini` |
| `out-dir` | No | `outputs/dataforseo-fanout-queries` |

## Deliverable

| File | Path |
|---|---|
| JSON | `{project}/outputs/dataforseo-fanout-queries/fanout-queries-{slug}-{date}.json` |
| CSV | same basename — columns `,Generated Query` |

## Auth

Env: `DATAFORSEO_USERNAME`, `DATAFORSEO_PASSWORD`

**Endpoint:** `POST https://api.dataforseo.com/v3/ai_optimization/chat_gpt/llm_responses/live`

Do **not** use `llm_scraper` for this skill.

## Execution

cwd = project folder:

```bash
node fetch-fanout.js --keyword "oak wilt treatment austin texas" --count 120
```

Live LLM Responses can take up to ~120s — allow ≥180s.

## Cost

On the order of ~$0.003 per seed at ~120 queries with `gpt-4.1-mini` (varies). Surface HTTP errors; do not blind-retry 429s.

## Pipeline notes

Keep separate from `dataforseo-paa-queries` until a later merge skill.
