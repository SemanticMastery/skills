---
name: icm-migrate
description: >-
  Retrofit ICM harness onto existing PARA or operations roots (or similar trees): CONTEXT.md
  router + .cursor/rules/project-rules.mdc, optional AGENTS.md, inventory markers,
  and light nudge-only hooks. Use when /icm-migrate, /icm-refresh-context, after
  /icm-setup routes here, or user asks to add ICM to an existing non-empty
  workspace root. Sibling to icm-architect (greenfield) and icm-setup (router) —
  this skill does not refuse existing content.
disable-model-invocation: true
metadata:
  version: "1.1.0"
---

# icm-migrate

Put an ICM **router harness** on an existing folder tree. Do **not** renumber Agency children. Do **not** auto-rewrite policy files from hooks.

Sibling of `icm-architect` (greenfield scaffold) and `icm-setup` (thin router). This skill is for **retrofit**.

## Modes

| Mode | Status | What it does |
|------|--------|--------------|
| **1 — PARA or operations-root router harness** | **Ship first** | `CONTEXT.md` + `.cursor/rules/project-rules.mdc` (+ optional `AGENTS.md`); inventory markers; optional project nudge hooks |
| **2 — Deeper migrate** | Later (maintainer stub) | Map folders toward ICM stages / Agency shapes; propose-then-confirm only; never silent destructive renames |

Default: Mode 1 unless the user explicitly asks for deeper migrate.

**Coaching / student pack:** teach and run **Mode 1 only**. Mode 2 is foreshadowing for maintainers — do **not** invent a Mode 2 procedure until this skill defines one.

## Hard gates

1. **Propose → confirm → write** — never write ICM files on a live root without explicit create/update approval (see `references/confirm-checklist.md`).
2. **Hooks are nudge-only** — never auto-edit `project-rules.mdc`; never full auto-rewrite of CONTEXT prose.
3. **Refresh** updates only `<!-- ICM:INVENTORY -->` … `<!-- /ICM:INVENTORY -->` blocks (and the inventory hash file).
4. **Do not** run `icm-architect` greenfield refuse logic here — existing content is expected.

## When to use

- User says `/icm-migrate`, "add ICM to a PARA or operations root", "router harness on this root"
- `/icm-setup` handed off here after triage
- `/icm-refresh-context` or "refresh CONTEXT inventory"
- After MCP PARA relocate, when a root needs CONTEXT + first-read rules

## When NOT to use

- Empty greenfield project → use `icm-architect` (or `/icm-setup` → architect)
- User wants full Agency Client Direct scaffold from scratch → `icm-architect`
- User wants silent auto-rewrite of rules on every folder change → refuse; explain nudge-only design
- User is unsure new vs existing → offer `/icm-setup` first

## Skill paths

Resolve relative to this skill folder:

| Role | Path |
|------|------|
| Install (global) | `~/.cursor/skills/icm-migrate/` |
| Pack siblings | `icm-setup/`, `icm-architect/` next to this folder |

## Procedure — Mode 1 (migrate)

### 1. Preflight

1. Confirm target **workspace root** (absolute path). Prefer a PARA or operations root, a projects root, or an areas root. Use the path the user names.
2. Detect existing: `CONTEXT.md`, `.cursor/rules/project-rules.mdc`, `AGENTS.md`, `.cursor/mcp.json`, `.cursor/hooks.json`, and dossier trees.
3. If CONTEXT + project-rules already look complete: offer **refresh** or **update propose**, not blind overwrite.
4. List top-level children (dirs + notable files) for the router inventory (agreed depth: default **top-level only**).

### 2. Interview (short)

Ask only what is missing:

| Question | Default |
|----------|---------|
| Which root? | Current workspace root when it is the PARA or operations root the user named |
| Mode? | 1 |
| Include thin `AGENTS.md`? | Yes for Cursor |
| Install light project hooks? | Yes on pilot / when asked |
| Active-path convention? | User pins active subpath in chat or in CONTEXT "Active path" section |
| Sync sensitivity? | Note if SharePoint/OneDrive; avoid secrets in CONTEXT |

### 3. Propose (must show all three)

1. **File list** — every path to create/update
2. **Draft summaries** — CONTEXT outline (goals stub + inventory table + routing) and project-rules bullet list
3. **Rationale** — 2–6 bullets (root-open habit, MCP pack, soft boundary honesty)

Wait for explicit create/update approval (`Create it`, `Confirmed — write harness`, etc.). Ambiguous "looks good" is not enough.

### 4. Write (after approval)

Create/update:

| File | Role |
|------|------|
| `CONTEXT.md` | Router: purpose, open-as-workspace note, active path, inventory markers, task routing |
| `.cursor/rules/project-rules.mdc` | **Canonical** Mode 1 policy (`alwaysApply: true`) — not a thin pointer |
| `AGENTS.md` (optional) | Thin entry: read CONTEXT + project-rules first |
| `.cursor/hooks.json` + scripts (optional) | Nudge-only sessionStart / stop |
| `.cursor/icm-inventory.sha256` | Hash of top-level listing for stale detection |

Fill templates from `templates/`. Replace placeholders. Seed inventory between markers via `scripts/refresh-inventory.cjs` or equivalent listing.

### 5. Handoff

- Tell user: open this folder as the Cursor workspace root.
- Point to `/icm-refresh-context` when children change.
- Include short ICM attribution (Jake Van Clief / Clief Notes) — see `references/attribution.md`.

## Procedure — refresh (`/icm-refresh-context`)

1. Resolve root (workspace root or path user gave).
2. Require `CONTEXT.md` with inventory markers. If markers missing: offer to insert empty marker pair (propose → confirm), then refresh.
3. Run `node scripts/refresh-inventory.cjs --root "<abs>"` (or perform the same marker-only edit).
4. Update `.cursor/icm-inventory.sha256`.
5. Report: what changed in the inventory block only. Do not rewrite goals/routing/project-rules.

## project-rules.mdc must include

- Read root `CONTEXT.md` before substantive work
- Confirm / pin active subpath before edits
- Prefer edits under the active path
- Soft boundary only — router is not a sandbox
- Skill/hooks may update CONTEXT **inventory markers**; humans/skills change project-rules rarely
- Open this root as workspace so project MCP loads

## Hooks (nudge only)

| Event | Behavior |
|-------|----------|
| `sessionStart` | If `CONTEXT.md` present → soft remind: read CONTEXT first (fail open) |
| `stop` | If top-level hash ≠ `.cursor/icm-inventory.sha256` → nudge `/icm-refresh-context` (fail open) |

**Never:** edit `project-rules.mdc`, rewrite CONTEXT outside inventory markers, fail closed, or watch disk while Cursor is closed.

Prefer **project** hooks under the ICM root (they travel with the project).

## Reuse boundaries vs icm-architect

See `references/reuse-boundaries.md`.

## References

| Need | File |
|------|------|
| Confirm gate | `references/confirm-checklist.md` |
| Refresh contract | `references/refresh-inventory.md` |
| Architect reuse | `references/reuse-boundaries.md` |
| Attribution | `references/attribution.md` |
| Templates | `templates/` |
| Scripts | `scripts/refresh-inventory.cjs`, `scripts/inventory-hash.cjs` |
| Hook scripts | `templates/hooks/` |
