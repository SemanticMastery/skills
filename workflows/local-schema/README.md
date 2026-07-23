# Local Schema Generator

**Workflow ID:** `local-schema` (folder: `workflows/local-schema/`)  
**Repo:** [SemanticMastery/skills](https://github.com/SemanticMastery/skills)  
**Bundle date:** 2026-07-23 · **`schema-markup-generator`:** 9.12.0

A **coaching bundle** for local SEO structured data: three agent skills plus the minimal Node scripts needed to run the contractor dossier pipeline.

## What is included

| Component | Purpose |
|-----------|---------|
| `schema-markup-generator` **9.12.0** | JSON-LD for FAQ, HowTo, Article, Product, LocalBusiness — dossier, sameAs, logo/image/geo, and knowsabout prefights |
| `knowsabout-entity-research` | Entity CSV research (Wikipedia / Wikidata / Grokipedia) |
| `business-dossier` | Glen Patel TSCR business dossier (Markdown + DOCX) |
| `scripts/seo/` | `compose-business-dossier.mjs` and SerpAPI/Firecrawl pre-gather |

See **[CHANGES.md](CHANGES.md)** for the 9.12.0 intake-gate updates (sameAs + media/geo; website stays on `url` only).

## Quick start (mastermind)

**Start here:** [QUICKSTART-MASTERMIND.md](QUICKSTART-MASTERMIND.md) (zip-only setup for today’s session).

1. Download the **Local Schema Generator** zip (`local-schema-*.zip` from Bradley). GitHub clone access will be offered later.
2. Set **`BUNDLE_ROOT`** to this folder (`workflows/local-schema` — the directory that contains `skills/` and `scripts/`).
3. Open **[INSTALL.md](INSTALL.md)** and complete prerequisites (Node 18+, API keys).
4. Run `npm install` inside `scripts/seo`.
5. Copy `skills/*` into your agent skills directory (Cursor and/or Claude Code — see INSTALL).
6. Restart your IDE and run the **FAQ schema verification** in INSTALL.

## Licensing and attribution

- **[LICENSE](LICENSE)** — Apache License 2.0 (full text).
- **[NOTICE](NOTICE)** — upstream and SemanticMastery copyrights.
- **[CHANGES.md](CHANGES.md)** — modifications from [seo-geo-claude-skills](https://github.com/aaron-he-zhu/seo-geo-claude-skills).

**This distribution is not affiliated with or endorsed by** Aaron He Zhu or the upstream seo-geo-claude-skills maintainers.

## Security

See **[SECURITY-STUDENTS.md](SECURITY-STUDENTS.md)** and `skill-security-reviews/` for install-time risk notes.

## Build zip

From this folder:

```powershell
pwsh -File scripts/build-bundle.ps1
```

Output: `dist/local-schema-YYYYMMDD.zip`

## Support

Coaching participants: mastermind channel or access via [SemanticMastery](https://github.com/SemanticMastery).
