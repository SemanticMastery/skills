# {{CAMPAIGN_NAME}} — Campaign Context

## Campaign

- **Client:** {{CLIENT_NAME}}
- **Campaign:** {{CAMPAIGN_NAME}}
- **Goal:** {{GOAL}}
- **Desired outcome:** {{OUTCOME}}
- **Tools / services:** {{TOOLS_SERVICES}}

## Stages (always)

| Stage | Job |
|-------|-----|
| `01-intake/` | Collect inputs, assets, and constraints |
| `02-deliverables/` | Produce client-facing work products |
| `03-decisions/` | Record decisions and communications worth keeping |
| `04-archives/` | Store inactive or troubleshooting material |

## Modules

{{MODULE_LIST}}

## Task routing

{{TASK_ROUTING_TABLE}}

| Example task | Route to |
|--------------|----------|
| New intake asset | Matching `01-intake/1.x-*` module |
| Ship a deliverable | Matching `02-deliverables/2.x-*` module |
| Log a decision | `03-decisions/` (comms or traces module) |
| Park a failed experiment | `04-archives/troubleshooting/` (if present) else `04-archives/` |

## Rules

Canonical rules: `PROJECT-RULES.mdc`. Harness entry files are thin pointers only.
