# Harness mapping (v1 — student-ready stubs)

Canonical ICM content lives in **CONTEXT** files and **`PROJECT-RULES.mdc`** (campaign or project root). Harness files are **thin pointers** — do not duplicate the full tree inside them.

## Interview harness strings (accepted values)

| Interview answer | Normalize to | Files to write (relative to scaffold root) |
|------------------|--------------|--------------------------------------------|
| Cursor | `cursor` | `AGENTS.md` + `.cursor/rules/project-rules.mdc` |
| Claude Code / Claude | `claude` | `CLAUDE.md` |
| Codex | `codex` | `AGENTS.md` |
| OpenClaw | `openclaw` | `AGENTS.md` + `TOOLS.md` |
| Unknown / other | `unknown` | `AGENTS.md` + `CLAUDE.md` + handoff note: best-effort stubs |

Also write the **canonical** `PROJECT-RULES.mdc` at the ICM project/campaign root (Agency: under campaign; WorkFlows: under project root). The Cursor `.cursor/rules/project-rules.mdc` is a thin pointer to that body + CONTEXT — not a second full copy of rules.

## Template sources

| Output file | Template |
|-------------|----------|
| `AGENTS.md` | `templates/harness/AGENTS.md` |
| `CLAUDE.md` | `templates/harness/CLAUDE.md` |
| `.cursor/rules/project-rules.mdc` | `templates/harness/project-rules.mdc` |
| `TOOLS.md` | `templates/harness/TOOLS.md` |
| `.cursorrules` (optional legacy) | `templates/harness/cursorrules` |

Optional `.cursorrules`: only if the user explicitly asks for legacy Cursor root rules. Default Cursor path is `AGENTS.md` + `.cursor/rules/project-rules.mdc`.

## Placeholder rules

Replace at write time:

- `{{PROJECT_OR_CAMPAIGN_NAME}}`
- `{{CONTEXT_PATH}}` — e.g. `CONTEXT.md` or `CAMPAIGN-CONTEXT.md` (relative from harness file or project root; prefer paths relative to scaffold root)
- `{{PROJECT_RULES_PATH}}` — e.g. `PROJECT-RULES.mdc` or `{Campaign}/PROJECT-RULES.mdc`
- `{{HARNESS_NOTE}}` — for unknown/claude: short "best-effort stub this week" sentence

## Branch notes

- **Agency Client:** harness files usually sit at **campaign** root (alongside `CAMPAIGN-CONTEXT.md`). If scaffold root is the client folder, still place harness entrypoints next to the campaign CONTEXT unless the user asks otherwise.
- **WorkFlows:** harness files sit at the WorkFlows project root next to `CONTEXT.md`.

## Deferred (next Thursday polish)

Richer per-harness router content beyond stubs. Do not block student-ready on polish.
