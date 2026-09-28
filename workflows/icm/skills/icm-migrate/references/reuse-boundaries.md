# Reuse boundaries — icm-migrate vs icm-architect

## Reuse (copy patterns / adapt)

| Pattern | From architect | Migrate adaptation |
|---------|----------------|--------------------|
| Propose → confirm → write | `confirm-checklist.md` | Same gate; drop Agency omit-renumber; drop greenfield refuse |
| Thin `AGENTS.md` | `templates/harness/AGENTS.md` | Pointer to root CONTEXT + project-rules |
| Attribution | `references/attribution.md` | Same Jake Van Clief / Clief Notes credit |
| Placeholder tokens | harness-map | `{{ROOT_NAME}}`, `{{CONTEXT_PATH}}`, `{{INVENTORY_TABLE}}`, etc. |

## Do not reuse

| Pattern | Reason |
|---------|--------|
| Greenfield-only refuse on substantial trees | Migrate targets existing PARA or operations-root content |
| Agency Client Direct stage/module scaffold | Mode 1 harness-only |
| WorkFlows numbered stage folders | Mode 1 does not invent stages |
| Thin `.cursor/rules/project-rules.mdc` → separate `PROJECT-RULES.mdc` | Mode 1: Cursor rule file is the policy body |
| `HOW-TO-WORK-THIS-PROJECT.md` full tree dump as required | Optional; Mode 1 handoff can stay short |

## Ownership

| Skill | Owns |
|-------|------|
| `icm-setup` | Triage only (new vs existing) → hand off; no scaffold/migrate body |
| `icm-architect` | Empty / near-empty greenfield ICM trees |
| `icm-migrate` | Retrofit harness + inventory refresh + nudge hooks on existing roots |

If a user asks architect to scaffold onto a full operations-root tree, redirect to `/icm-migrate` (or `/icm-setup` if unsure).
If a user is unsure new vs existing, prefer `/icm-setup`.
