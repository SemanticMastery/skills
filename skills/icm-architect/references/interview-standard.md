# Standard interview questions (normative order)

Ask in this order. Do not invent a different sequence. Branch-specific follow-ups come after the shared spine (see `setup-interview.md`).

## Shared spine (always)

1. **Location** — Scaffold in the current workspace root, or inside a named subfolder?  
   - If named subfolder: collect folder name (prefer `lowercase-with-hyphens` or Title-Case client names for Agency). All proposed paths root under that name.
2. **Project type** — WorkFlows (ops/automation) **or** Agency Client (Direct: Client → Campaign)?
3. **Harness** — Cursor, Claude Code, Codex, OpenClaw, or Other/unknown? (Map via `harness-map.md`.)
4. **Goal** — What is this project trying to accomplish? (1–3 sentences)
5. **Desired outcome** — What does "done" or "working" look like in the near term?
6. **Tools / services** — What tools, APIs, platforms, or agency services are available or in scope?

## After shared spine (order is mandatory)

1. **Branch follow-ups first** (so stages/modules are known before any teaching pass):
   - Agency → `agency-client-direct.md` (client/campaign display names + folder slugs, services → modules, optional archived-campaigns)
   - WorkFlows → `workflows-mode.md` (stage derivation from goal/outcome)
2. **Then** offer **go deeper** (`go-deeper-guidance.md`) using the concrete stages/modules you are about to propose. Default is Standard (skip if user declines).
3. **Then** Propose.

Do not offer go-deeper before branch follow-ups — you cannot explain why *these* stages/modules until they exist.

## Depth modes

| Mode | Behavior |
|------|----------|
| **Standard** (default) | Collect answers (incl. branch) → propose tree with short rationale |
| **Go deeper** | After branch follow-ups and before propose, explain why *these* stages/folders for *this* goal; include Clief Notes pointer; do not dump full ICM course |

## State

Keep interview answers in chat unless the user asks to save a transcript file.
