# Workflow: `local-schema`

**ID:** `local-schema`  
**Repo path:** `workflows/local-schema/` in [SemanticMastery/skills](https://github.com/SemanticMastery/skills)

A **coaching bundle** for local SEO structured data: three agent skills plus the minimal Node scripts needed to run the contractor dossier pipeline.

## What is included

| Component | Purpose |
|-----------|---------|
| `schema-markup-generator` | JSON-LD for FAQ, HowTo, Article, Product, LocalBusiness — with dossier and knowsabout prefights |
| `knowsabout-entity-research` | Entity CSV research (Wikipedia / Wikidata / Grokipedia) |
| `business-dossier` | Glen Patel TSCR business dossier (Markdown + DOCX) |
| `scripts/seo/` | `compose-business-dossier.mjs` and SerpAPI/Firecrawl pre-gather |

## Quick start (mastermind)

1. Clone [SemanticMastery/skills](https://github.com/SemanticMastery/skills) (private) or download the **`local-schema`** zip from `dist/`.
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
