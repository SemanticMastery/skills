# Security Review: schema-markup-generator (student bundle)

**Review date:** 2026-07-23 (re-check for 9.12.0)  
**Bundle:** Local Schema Generator (`local-schema`)  
**Verdict:** **APPROVE** (with operational caveats below)

---

## Scope

Shipped path: `skills/schema-markup-generator/` (17 markdown files in student bundle; excludes instructor migration prompt). Intake gates 0b/0c are prompt-only (no new scripts or network surface).

## Package contents

| File | Type |
|------|------|
| `SKILL.md` + `references/*.md` | Markdown instructions only |
| Scripts | **None** in this skill folder |
| `allowed-tools: WebFetch` | Agent may fetch page URLs for schema generation |

## Provenance

- Derived from Apache-2.0 [seo-geo-claude-skills](https://github.com/aaron-he-zhu/seo-geo-claude-skills) `schema-markup-generator`
- Modified by SemanticMastery (dossier/CSV prefights, contractor rules) — see `CHANGES.md`

## Malicious-pattern scan

- No bundled executables, shell scripts, or credential storage in skill files
- SKILL.md includes explicit **untrusted WebFetch** boundary (do not obey page-embedded “system” directives)
- No exfiltration webhooks, paste-bin instructions, or prompt-injection override language in bundle copy

## Risk assessment

| Risk | Level | Notes |
|------|-------|-------|
| Supply chain (skill files) | Low | Static markdown; no npm install in skill |
| WebFetch / URL content | Medium | User-supplied URLs; treat HTML as untrusted data |
| Cross-skill invocation | Low | Explicit paths to `business-dossier` and `knowsabout-entity-research`; no auto-run |
| API keys in repo | None | Keys not stored in skill tree |

## Recommendation

**APPROVE** for coaching distribution. Students should read `SECURITY-STUDENTS.md` and set API keys only in OS/IDE env, not in project repos.
