---
name: icm-setup
description: >-
  Thin ICM router that triages greenfield vs existing folders, then hands off to
  icm-architect or icm-migrate. Use when the user invokes /icm-setup, or is unsure
  whether to scaffold a new ICM tree or retrofit a harness onto an existing root.
  Does not scaffold or migrate itself — only routes.
disable-model-invocation: true
metadata:
  version: "1.1.0"
---

# icm-setup

Thin **router** for Interpretable Context Methodology (ICM) skills. Triage only — then hand off.

| Sibling | Role |
|---------|------|
| `icm-architect` | Greenfield scaffold (WorkFlows or Agency Client Direct) |
| `icm-migrate` | Retrofit harness on an **existing** tree + inventory refresh |

**Hard rule:** Do **not** copy architect or migrate procedure bodies into this skill. After triage, **read and follow** the target skill’s `SKILL.md`.

Direct entrypoints still work: `/icm-architect`, `/icm-migrate`, `/icm-refresh-context`.

## When to use

- User invokes `/icm-setup`
- User asks to “set up ICM” and it is unclear whether the folder is new or existing
- User installed the coaching pack and wants the guided entry

## When NOT to use

- User already named `/icm-architect` or `/icm-migrate` → follow that skill directly
- Inventory-only refresh → `/icm-refresh-context` / `icm-migrate` refresh procedure

## Procedure

### 1. Confirm target folder

Resolve the absolute path the user wants to set up (usually the current workspace root, or a named subfolder they specify).

### 2. Triage (auto-detect; ask if ambiguous)

Inspect the target (top-level listing is enough).

| Signal | Route |
|--------|--------|
| Empty, or only trivial starters (`.git`, a single README, and/or root `*dossier*.md` / `*dossier*.docx`) | **architect** |
| Substantial other content (existing PARA or operations-root / project tree, multiple real folders/files beyond trivial starters) | **migrate** |
| Ambiguous mix, or user intent unclear | **Ask** once: new/greenfield scaffold vs retrofit harness on existing content |

Say which path you chose and why (one short sentence). If asking, wait for the answer before handoff.

### 3. Hand off (mandatory)

**Architect path**

1. Tell the user you are continuing as **icm-architect** (greenfield).
2. Read `../icm-architect/SKILL.md` (or the installed sibling `icm-architect/SKILL.md` next to this skill).
3. Follow that skill from the top (preflight → interview → propose → confirm → write). Do not invent a shorter scaffold.

**Migrate path**

1. Tell the user you are continuing as **icm-migrate** (retrofit / Mode 1 harness).
2. Read `../icm-migrate/SKILL.md` (or installed sibling `icm-migrate/SKILL.md`).
3. Follow that skill from the top. Do **not** apply architect’s greenfield refuse logic.

### 4. Missing sibling

If the chosen sibling skill folder is not installed next to this one (and not findable under `~/.cursor/skills/`), stop and tell the user to install the full pack (`icm-setup` + `icm-architect` + `icm-migrate`) or install the missing skill. Do not improvise the missing procedure.

## Coaching scope note

Class use of migrate is **Mode 1** (router harness + refresh). Mode 2 (deeper folder mapping) may appear as a stub in `icm-migrate` for maintainers — do not invent a Mode 2 procedure unless that skill later defines one and the user explicitly asks.

## Attribution

ICM by Jake Van Clief — see sibling `references/attribution.md` under architect or migrate.
