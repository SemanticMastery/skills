# {{ROOT_NAME}} — Context (Layer 1 router)

## Workspace habit

**Open this folder as the Cursor workspace root** so project MCP (`.cursor/mcp.json`) and rules load. Opening a nested leaf alone will not inherit parent MCP.

## Purpose

- **Root:** {{ROOT_NAME}}
- **Goal:** {{GOAL}}
- **Desired outcome:** {{OUTCOME}}
- **MCP pack:** {{MCP_NOTES}}

## Active path

Pin the subfolder you are working in before substantive edits:

- **Active:** {{ACTIVE_PATH}}
- **How to change:** Tell the agent the new active path (or edit this line). Prefer edits under the active path.

## Inventory

Top-level children of this root (refresh with `/icm-refresh-context`):

<!-- ICM:INVENTORY -->
{{INVENTORY_TABLE}}
<!-- /ICM:INVENTORY -->

## Task routing

| If the task is about… | Go to / use |
|-----------------------|-------------|
{{ROUTING_ROWS}}

## Rules

Canonical agent policy: `.cursor/rules/project-rules.mdc`.

- Read this `CONTEXT.md` before substantive work.
- Confirm active path before edits.
- Soft boundary only: this router is not a sandbox.

## Going deeper on ICM

This workspace uses Interpretable Context Methodology (ICM) ideas from **Jake Van Clief**.
`icm-migrate` added a router harness on an existing tree — it is not a full ICM course.
For deeper learning: [Clief Notes](https://smshort.link/clief-notes) and the
[ICM repository](https://github.com/RinDig/Interpretable-Context-Methodology).
