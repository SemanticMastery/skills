# Semantic Mastery - Agent Skills

Private catalog of agent skills and **workflows** (multi-skill bundles) for [Semantic Mastery](https://semanticmastery.com) coaching and fulfillment.

**Organization:** [SemanticMastery on GitHub](https://github.com/SemanticMastery)

## Layout

| Path | What it is |
|------|------------|
| `workflows/<id>/` | Installable **workflow** - may include several `skills/` folders, shared `scripts/`, legal files, and `INSTALL.md` |
| `skills/<name>/` | Standalone **single skill** (one `SKILL.md` tree students copy as-is) |

Students and mastermind members:

- **Workflow:** open the workflow folder, follow its `INSTALL.md`, and copy skill subfolders into `~/.cursor/skills/` or `~/.claude/skills/` (or project-local `.cursor/skills/`).
- **Standalone skill:** copy `skills/<name>/` so the final path is `.cursor/skills/<name>/SKILL.md` (same for `.claude/skills/` if using Claude Code).

## Skills

| Name | Folder | Description |
|------|--------|-------------|
| `icm-architect` | [skills/icm-architect/](skills/icm-architect/) | Interview wizard that scaffolds Interpretable Context Methodology (ICM) trees for **WorkFlows** and **Agency Client Direct** (`Client -> Campaign`). Invoke `/icm-architect`. See that folder's `INSTALL.md` and `COACHING-README.md`. |

## Workflows

| ID | Display name | Folder | Description |
|----|--------------|--------|-------------|
| `local-schema` | **Local Schema Generator** | [workflows/local-schema/](workflows/local-schema/) | Local SEO JSON-LD: `schema-markup-generator`, `knowsabout-entity-research`, `business-dossier`, plus dossier compose scripts |

## Releases

- Workflow zips are built from each workflow's `scripts/build-bundle.ps1` (e.g. `workflows/local-schema/dist/local-schema-YYYYMMDD.zip`).
- Standalone skills may also ship a zip from the authoring repo (e.g. `icm-architect` student zip) as a non-git fallback; the tree in this catalog is the GitHub install source.

## Canonical editing

Bradley's day-to-day canonical copies remain under the synced `.cursor/skills/` tree (and authoring repos such as `icm-architect`). Published skills/workflows here are **snapshots** built for distribution unless noted otherwise in the skill or workflow README.
