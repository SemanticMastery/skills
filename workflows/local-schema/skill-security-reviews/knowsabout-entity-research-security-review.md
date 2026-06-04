# Security Review: knowsabout-entity-research (student bundle)

**Review date:** 2026-06-04  
**Bundle:** Local Schema Generator (`local-schema`)  
**Verdict:** **CONDITIONAL** — approve after acknowledging network script behavior

---

## Scope

Shipped path: `skills/knowsabout-entity-research/` including `scripts/resolve-entity-urls.mjs`.

## Package contents

| File | Type |
|------|------|
| `SKILL.md`, `reference.md`, `references/*.md` | Markdown |
| `scripts/resolve-entity-urls.mjs` | Node 18+ script (HTTPS to Wikipedia/Wikidata/Grokipedia APIs) |

## Provenance

- SemanticMastery original skill (not from upstream seo-geo-claude-skills)
- Companion to bundled `schema-markup-generator`

## Malicious-pattern scan (script)

- Uses Node `fetch` / HTTPS to public knowledge APIs (documented purpose)
- No hardcoded API secrets in repository
- No eval, child_process shell, or arbitrary file execution
- Writes CSV only to user-specified `project_dir` paths per SKILL instructions

## Risk assessment

| Risk | Level | Notes |
|------|-------|-------|
| Network egress | Medium | Script contacts third-party APIs; rate-limit responsibly |
| Supply chain | Low | Single `.mjs` file; no npm dependencies in skill folder |
| Data exfiltration | Low | No unknown webhook endpoints in shipped script |
| Operational | Low | Batch runs may create many CSV files in client projects |

## Recommendation

**CONDITIONAL:** Safe for coaching install when students understand the resolver performs **outbound HTTPS** and requires **Node 18+**. No BLOCK items for mastermind zip.
