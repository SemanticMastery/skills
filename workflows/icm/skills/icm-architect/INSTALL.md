# Install Guide — icm-architect

Shareable Cursor skill for scaffolding Interpretable Context Methodology (ICM) project trees.

**Students / coaching members:** start with **`README.md`** in this folder — it covers **project-level** vs **global** install, the pack zip, and the **`/icm-setup`** router.

## Pack siblings

The coaching zip (`icm-pack.zip`) installs three skills side by side:

| Skill | Slash | Role |
|-------|-------|------|
| `icm-setup` | `/icm-setup` | Thin router (new vs existing) → hand off |
| `icm-architect` | `/icm-architect` | Greenfield scaffold (this skill) |
| `icm-migrate` | `/icm-migrate` | Retrofit harness on existing trees |

Direct `/icm-architect` remains valid. Prefer `/icm-setup` when the student is unsure.

## Install paths

Primary install is the catalog bundle `workflows/icm/`: set `HOST_SKILLS_ROOT` and run `scripts/flatten-install.ps1`, `scripts/flatten-install.sh`, or `node scripts/flatten-install.mjs`.

| Role | Path |
|------|------|
| **Project-level (Cursor)** | `<project>/.cursor/skills/icm-architect/` |
| **Global / user-level (Cursor)** | `~/.cursor/skills/icm-architect/` (Windows: `%USERPROFILE%\.cursor\skills\icm-architect\`) |
| **Claude Code adapter** | `<project>/.claude/skills/icm-architect/` (same package layout) |
| **Catalog bundle** | [SemanticMastery/skills](https://github.com/SemanticMastery/skills) → `workflows/icm/` (`master`) |

The zip fallback ships **three skill roots** (not an extra `skills/` prefix). After flatten or expand you must have:

```text
# Project-level
<project>/.cursor/skills/icm-setup/SKILL.md
<project>/.cursor/skills/icm-architect/SKILL.md
<project>/.cursor/skills/icm-migrate/SKILL.md

# Global (user-level)
~/.cursor/skills/icm-setup/SKILL.md
~/.cursor/skills/icm-architect/SKILL.md
~/.cursor/skills/icm-migrate/SKILL.md
```

## 1) Place the skill folder

**From the catalog bundle:** run the flatten script with `HOST_SKILLS_ROOT` set to `<project>/.cursor/skills` or `~/.cursor/skills`.

**From the zip fallback:** expand `icm-pack.zip` into that same skills folder so all three skill folders appear.

Full student steps and one-line PowerShell/bash: see **`README.md`**.

## 2) Verify required files

Confirm these exist under the install folder:

- `SKILL.md`
- `README.md`
- `INSTALL.md`
- `setup-interview.md`
- `COACHING-README.md`
- `VALIDATION.md`
- `references/attribution.md`
- `references/harness-map.md`
- `references/interview-standard.md`
- `references/go-deeper-guidance.md`
- `references/agency-client-direct.md`
- `references/workflows-mode.md`
- `references/confirm-checklist.md`
- `templates/agency/` (CONTEXT + rules + handoff)
- `templates/workflows/` (CONTEXT + rules + stage + handoff)
- `templates/harness/` (thin entrypoints)

## 3) First run

1. Open a **greenfield** project folder (empty, or only `.git` and/or a single README, and/or a business dossier `*dossier*.md` / `*dossier*.docx`).
2. Prefer `/icm-setup` if unsure new vs existing; or invoke `/icm-architect` directly (or: "scaffold ICM", "new project architecture").
3. Answer the Standard interview (location → type → harness → goal → outcome → tools/services). For Agency, a root dossier is recommended — the skill will suggest one if missing.
4. Optionally **go deeper** for why-these-stages (not a full ICM course).
5. Review the proposed tree + file list + short rationale (Agency: full catalog → omit any? → renumber).
6. Explicitly approve create (e.g. `Create it` / `Confirmed — scaffold`). "Looks good" alone is not enough.
7. After write, open `HOW-TO-WORK-THIS-PROJECT.md` for the folder tree diagram, next steps, and Clief Notes link.

## 4) Hard gates (read before class)

- **Never scaffold before confirm.** Propose → confirm → write.
- **Greenfield only.** Substantial existing content → refuse writes; redirect to `/icm-setup` or `/icm-migrate`.
- **Trivial non-empty** (only `.git` and/or one README) → soft-warn, may proceed.
- **Business dossier exception:** root `*dossier*.md` / `*dossier*.docx` (alone or with trivial starters) is allowed; scaffold alongside it and use it for campaign context.

## 5) Attribution

ICM by Jake Van Clief — [Interpretable Context Methodology](https://github.com/RinDig/Interpretable-Context-Methodology). Deeper study: [Clief Notes](https://smshort.link/clief-notes).
