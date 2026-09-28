# Install Guide — icm-migrate

Shareable Cursor skill for retrofitting an ICM **router harness** onto existing folder trees.

**Students / coaching members:** start with **`README.md`** in this folder — project vs global install, pack layout, and **Mode 1 class scope**.

## Install paths

Primary install is the catalog bundle `workflows/icm/`: set `HOST_SKILLS_ROOT` and run `scripts/flatten-install.ps1`, `scripts/flatten-install.sh`, or `node scripts/flatten-install.mjs`. `icm-setup/` and `icm-architect/` must sit next to this folder so `/icm-setup` can route.

| Role | Path |
|------|------|
| **Project-level (Cursor)** | `<project>/.cursor/skills/icm-migrate/` |
| **Global / user-level (Cursor)** | `~/.cursor/skills/icm-migrate/` |
| **Pack siblings (required for `/icm-setup`)** | `icm-setup/` + `icm-architect/` next to this folder |

After flatten, or after expanding the `icm-pack.zip` fallback, you must have:

```text
.../skills/icm-setup/SKILL.md
.../skills/icm-architect/SKILL.md
.../skills/icm-migrate/SKILL.md
```

## 1) Place the skill folder

**From the catalog bundle:** run the flatten script with `HOST_SKILLS_ROOT` set to `<project>/.cursor/skills` or `~/.cursor/skills`.

**From the zip fallback:** expand `icm-pack.zip` into that same skills folder.

## 2) Verify required files

- `SKILL.md`
- `README.md`
- `INSTALL.md`
- `references/confirm-checklist.md`
- `references/refresh-inventory.md`
- `references/reuse-boundaries.md`
- `references/attribution.md`
- `templates/CONTEXT.md`, `templates/project-rules.mdc`, `templates/AGENTS.md`
- `templates/hooks/`
- `scripts/refresh-inventory.cjs`, `scripts/inventory-hash.cjs`

## 3) First run

1. Open an **existing** workspace root.
2. `/icm-setup` (router) or `/icm-migrate` (direct).
3. Propose → explicit confirm → write.
4. Use `/icm-refresh-context` when top-level children change.

## 4) Hard gates (read before class)

- **Never write harness files before confirm.**
- **Mode 1 for class** — harness + inventory refresh + optional nudge hooks only.
- Mode 2 stub in `SKILL.md` is maintainer foreshadowing — **not** a student procedure; do not invent destructive remaps.
- Do **not** apply `icm-architect` greenfield refuse logic on existing trees.
- Hooks are nudge-only; never auto-edit `project-rules.mdc`.

## 5) Attribution

ICM by Jake Van Clief — [Interpretable Context Methodology](https://github.com/RinDig/Interpretable-Context-Methodology). Deeper study: [Clief Notes](https://smshort.link/clief-notes).
