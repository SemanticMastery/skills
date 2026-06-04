# Semantic Mastery — Agent Skills

Private catalog of agent skills and **workflows** (multi-skill bundles) for [Semantic Mastery](https://semanticmastery.com) coaching and fulfillment.

**Organization:** [SemanticMastery on GitHub](https://github.com/SemanticMastery)

## Layout

| Path | What it is |
|------|------------|
| `workflows/<id>/` | Installable **workflow** — may include several `skills/` folders, shared `scripts/`, legal files, and `INSTALL.md` |
| *(future)* `skills/<name>/` | Standalone **single skill** when a workflow is not needed |

Students and mastermind members: open the workflow folder, follow its `INSTALL.md`, and copy skill subfolders into `~/.cursor/skills/` or `~/.claude/skills/`.

## Workflows

| ID | Display name | Folder | Description |
|----|--------------|--------|-------------|
| `local-schema` | **Local Schema Generator** | [workflows/local-schema/](workflows/local-schema/) | Local SEO JSON-LD: `schema-markup-generator`, `knowsabout-entity-research`, `business-dossier`, plus dossier compose scripts |

## Releases

Workflow zips are built from each workflow’s `scripts/build-bundle.ps1` (e.g. `workflows/local-schema/dist/local-schema-YYYYMMDD.zip`).

## Canonical editing

Bradley’s day-to-day canonical copies remain under the synced `.cursor/skills/` tree. Published workflows are **snapshots** built for distribution unless noted otherwise in the workflow README.
