# Install Guide — icm-architect

Shareable Cursor skill for scaffolding Interpretable Context Methodology (ICM) project trees.

## Authoring vs install paths

| Role | Path |
|------|------|
| **Authoring (this repo)** | `skills/icm-architect/` |
| **Student install (Cursor)** | `<project>/.cursor/skills/icm-architect/` |
| **Claude Code adapter** | `<project>/.claude/skills/icm-architect/` (same package layout) |
| **GitHub catalog (push here)** | [SemanticMastery/skills](https://github.com/SemanticMastery/skills) → `skills/icm-architect/` (`master`) |

**Agent note:** The local authoring `icm-architect` git repo may have **no remote**. Publishing means copying this skill folder into `SemanticMastery/skills` at `skills/icm-architect/` and pushing `master` — not searching for a remote on the authoring repo.

The zip ships the **skill root** (files that live inside `icm-architect/`), not an extra `skills/` prefix. After expand/copy you must have:

```text
<project>/.cursor/skills/icm-architect/SKILL.md
```

## 1) Place the skill folder

**From zip:** Expand so `SKILL.md` is at `.cursor/skills/icm-architect/SKILL.md`.

**From private GitHub:** Clone or copy the skill tree into `.cursor/skills/icm-architect/`.

**From this authoring repo (developers):** Copy `skills/icm-architect/` → `.cursor/skills/icm-architect/`.

## 2) Verify required files

Confirm these exist under the install folder:

- `SKILL.md`
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
2. Invoke `/icm-architect` (or: "scaffold ICM", "new project architecture", "set up ICM folders").
3. Answer the Standard interview (location → type → harness → goal → outcome → tools/services). For Agency, a root dossier is recommended — the skill will suggest one if missing.
4. Optionally **go deeper** for why-these-stages (not a full ICM course).
5. Review the proposed tree + file list + short rationale (Agency: full catalog → omit any? → renumber).
6. Explicitly approve create (e.g. `Create it` / `Confirmed — scaffold`). "Looks good" alone is not enough.
7. After write, open `HOW-TO-WORK-THIS-PROJECT.md` for next steps and Clief Notes link.

## 4) Hard gates (read before class)

- **Never scaffold before confirm.** Propose → confirm → write.
- **Greenfield only.** Substantial existing content → refuse writes; migration deferred.
- **Trivial non-empty** (only `.git` and/or one README) → soft-warn, may proceed.
- **Business dossier exception:** root `*dossier*.md` / `*dossier*.docx` (alone or with trivial starters) is allowed; scaffold alongside it and use it for campaign context.

## 5) Attribution

ICM by Jake Van Clief — [Interpreted Context Methodology](https://github.com/RinDig/Interpreted-Context-Methdology). Deeper study: [Clief Notes](https://www.skool.com/cliefnotes).
