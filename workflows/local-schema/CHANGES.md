# Changes from upstream (seo-geo-claude-skills)

**Local Schema Generator** (workflow ID: `local-schema`) is derived from [aaron-he-zhu/seo-geo-claude-skills](https://github.com/aaron-he-zhu/seo-geo-claude-skills) under Apache-2.0.

## `schema-markup-generator` (fork)

- Contractor **business dossier preflight** (Step 0) with explicit `business-dossier` invocation; no auto-run of dossier skill.
- **Entity CSV preflight** (Step 2b) with blocking `knowsabout-entity-research` handoff for service/location pages.
- **sameAs** and dedicated `@id` URI rules for local contractor sites.
- **SCHEMA-LAYOUT.md** artifact layout under `resources/schema/` (per-slug knowsabout CSV paths).
- Expanded reference library (artifact layout, silo patterns, validation, entity CSV preflight).
- Portable cross-skill paths (`../business-dossier/`, `../knowsabout-entity-research/`) for student installs.
- `disable-model-invocation` coordination documented for dependent skills.

## `knowsabout-entity-research` (SemanticMastery)

- New skill: Wikipedia/Wikidata/Grokipedia entity research with paced verification.
- Bundled **`scripts/resolve-entity-urls.mjs`** (Node 18+) for batch URL resolution.
- Field learnings templates and project override patterns for audit workflows.

## `business-dossier` (SemanticMastery coaching)

- Glen Patel TSCR dossier workflow (Markdown + DOCX) via `compose-business-dossier.mjs`.
- Pre-gather: SerpAPI GBP + place details, Firecrawl website/reviews/owner/BBB/registry.
- Synthesis: xAI Grok 4.3 with web/X search tools.
- **Not** part of upstream seo-geo-claude-skills; included for full contractor schema path.

## `scripts/seo` (minimal vendored subset)

- `compose-business-dossier.mjs`, `get-gbp-categories.mjs`
- `lib/pregather-dossier.mjs`, `lib/markdown-dossier-docx.mjs`
- Excludes RankPrompt, geographic audit, and other Semantic Links internal automation scripts.

## Excluded from student bundle (instructor / machine-specific)

- `business-dossier-skill-build.md`
- `schema-markup-generator/references/client-schema-layout-migration-prompt.md`
