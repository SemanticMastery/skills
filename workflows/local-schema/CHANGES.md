# Changes from upstream (seo-geo-claude-skills)

**Local Schema Generator** (workflow ID: `local-schema`) is derived from [aaron-he-zhu/seo-geo-claude-skills](https://github.com/aaron-he-zhu/seo-geo-claude-skills) under Apache-2.0.

## Bundle release notes

### 2026-09-26 — `schema-markup-generator` **9.15.1**

Synced from `schema-markup-generator-v9.15.1.zip`:

- **Step 0** lists `01-intake/1.1-docs/` for the dossier before the NAPW ask.
- **Step 2c** soft-stops on location pages and offers a ContentMaxima matrix when the geo-trigger count is at least 40 (`references/contentmaxima-location-preflight.md`, `scripts/extract-geo-triggers.mjs`).
- **Maps CID** resolution for `hasMap` (`scripts/resolve-maps-cid.mjs`).
- **`areaServed` allowlist** so invented place types are not emitted (`references/areaserved-types.md`).
- **Client-facing copy** rules keep process notes out of JSON-LD strings (`references/client-facing-copy.md`).
- Travel-package recall notes (`resources/travel-package-schema.md`).

Zip: `dist/local-schema-20260926.zip`

### 2026-07-23 — `schema-markup-generator` **9.12.0**

Student-feedback hardening for local homepage graphs:

- **Step 0b (`sameAs`)** — dossier alone no longer skips the ask; agent must prompt unless the user already pasted a list or said **"use dossier only"**.
- **Step 0c (new)** — mandatory logo / primary image / geo intake gate (`references/media-geo-intake.md`). Answers: paste values, **"extract from GBP/site"**, or **"omit media and geo"**. Blocks JSON-LD until answered.
- **Official website** — set on schema **`url` only**; do **not** auto-add the homepage to `sameAs` (strip if pasted into the list).
- Synced additional references into the student skill tree: `media-geo-intake.md`, `jsonld-script-wrapper.md`, `sparse-site-homepage-patterns.md`, `franchisor-page-patterns.md`.

Zip: `dist/local-schema-20260723.zip`

---

## `schema-markup-generator` (fork)

- Contractor **business dossier preflight** (Step 0) with explicit `business-dossier` invocation; no auto-run of dossier skill.
- **Entity CSV preflight** (Step 2b) with blocking `knowsabout-entity-research` handoff for service/location pages.
- **sameAs** intake (Step 0b) and **logo / image / geo** intake (Step 0c) gates before LocalBusiness / Corporation JSON-LD.
- Dedicated `@id` URI rules for local contractor sites.
- **SCHEMA-LAYOUT.md** artifact layout under `02-deliverables/2.4-schema/` (legacy `resources/schema/` read paths supported).
- Expanded reference library (artifact layout, silo / sparse-site / franchisor patterns, validation, entity CSV preflight, JSON-LD script wrapper).
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
