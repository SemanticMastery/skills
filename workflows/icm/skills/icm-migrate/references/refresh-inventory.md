# Inventory refresh contract

## Markers

Exactly these HTML comments in `CONTEXT.md`:

```markdown
<!-- ICM:INVENTORY -->
…generated inventory markdown…
<!-- /ICM:INVENTORY -->
```

- One pair per CONTEXT (Mode 1).
- Agent/human prose outside the pair is **untouchable** by refresh.
- Optional companion hash: `.cursor/icm-inventory.sha256` (not inside CONTEXT).

## What refresh may change

- Lines strictly between the markers
- `.cursor/icm-inventory.sha256` contents
- Timestamp line inside the inventory block (optional `Updated:` row)

## What refresh must not change

- Goals, desired outcome, MCP notes, routing policy prose
- Active path section (unless user explicitly asks to clear/set it)
- `.cursor/rules/project-rules.mdc`
- `AGENTS.md`
- Hook scripts / `hooks.json`

## Default inventory content

Top-level directories (and optionally top-level markdown files), as a markdown table:

| Path | Type | Notes |
|------|------|-------|
| `clients/` | dir | … |

Skip: `.git`, `.cursor`, `node_modules`, obvious junk (`.tmp`, `Thumbs.db`).

Depth default: **1** (top-level only). Deeper scan only if user asks.

## Slash / skill entry

`/icm-refresh-context` → run Mode refresh procedure in `SKILL.md`.

## CLI

```text
node "<skill>/scripts/refresh-inventory.cjs" --root "<absolute-root>"
node "<skill>/scripts/inventory-hash.cjs" --root "<absolute-root>" --write
```

Fail open: missing CONTEXT or markers → print clear error; exit non-zero; do not create CONTEXT silently.
