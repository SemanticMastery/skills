# Security notes for students

Short summary of install risk for **Local Schema Generator** (workflow ID: `local-schema`). Full reviews are in `skill-security-reviews/`.

## Bottom line

| Skill / component | Verdict | What to know |
|-------------------|---------|----------------|
| `schema-markup-generator` | **APPROVE** | Markdown only; may use WebFetch on URLs you provide |
| `knowsabout-entity-research` | **CONDITIONAL** | Includes a Node script that calls Wikipedia/Wikidata/Grokipedia over HTTPS |
| `business-dossier` + `scripts/seo` | **CONDITIONAL** | Needs your API keys; calls Grok, SerpAPI, and Firecrawl CLI |

## Protect your keys

- Set `GROK_API_KEY` and `SERPAPI_API_KEY` in **OS user environment**, not in git repos.
- Never commit `.env` files with real keys into client projects.
- Run `compose-business-dossier.mjs --dry-run` before spending on a full dossier.

## What runs on your machine

- **Node scripts** under `scripts/seo/` and `skills/knowsabout-entity-research/scripts/`
- **Firecrawl CLI** (if installed) during dossier pre-gather
- **PowerShell** when generating `.docx` on Windows

## Non-endorsement

This bundle is a [SemanticMastery](https://github.com/SemanticMastery) coaching distribution. It is not an official release of [seo-geo-claude-skills](https://github.com/aaron-he-zhu/seo-geo-claude-skills).
