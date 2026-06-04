# Security Review: business-dossier (student bundle)

**Review date:** 2026-06-04  
**Bundle:** Local Schema Generator (`local-schema`)  
**Verdict:** **CONDITIONAL** — requires student API keys and external CLIs

---

## Scope

- `skills/business-dossier/` (markdown + Glen Patel prompt template)
- Vendored `scripts/seo/compose-business-dossier.mjs`, `get-gbp-categories.mjs`, `lib/pregather-dossier.mjs`, `lib/markdown-dossier-docx.mjs`

## Package contents

| Component | Behavior |
|-----------|----------|
| Compose script | Calls xAI Grok API, SerpAPI, spawns `firecrawl` CLI |
| Pre-gather | `execFileSync` / `spawnSync` for Firecrawl and Node child for GBP script |
| DOCX writer | Builds OOXML locally; zips via **PowerShell** `Compress-Archive` on Windows |
| Prompt file | `prompts/glen-patel-system.md` (coaching content, no secrets) |

## Provenance

- SemanticMastery coaching skill (Semantic Links / Semantic Mastery workflow)
- Scripts vendored from the canonical `.cursor/scripts/seo` tree (minimal subset)

## Malicious-pattern scan

- No embedded API keys; reads `GROK_API_KEY`, `SERPAPI_API_KEY` from environment
- Firecrawl invoked only as documented CLI subprocess
- No connection to unknown hosts beyond xAI, SerpAPI, DataForSEO (optional fallback), and user-provided URLs
- Temp pre-gather artifacts deleted unless `--keep-artifacts`

## Risk assessment

| Risk | Level | Notes |
|------|-------|-------|
| API cost / quota | High (operational) | Grok + SerpAPI + Firecrawl billable; dry-run available |
| Credential handling | Medium | Keys must live in User env; never commit `.env` |
| Subprocess | Medium | `firecrawl`, `node` child, PowerShell zip |
| macOS DOCX | Medium | DOCX zip step is Windows-oriented today |

## Recommendation

**CONDITIONAL:** Distribute with `INSTALL.md` prerequisites. Students without keys can still use FAQ-only schema path. **No BLOCK** for mastermind shipping.
