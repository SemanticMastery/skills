# Semantic Mastery - Agent Skills

Named bundles for [Semantic Mastery](https://semanticmastery.com) coaching and fulfillment. Students clone [SemanticMastery/skills](https://github.com/SemanticMastery/skills) (`master`).

**Organization:** [SemanticMastery on GitHub](https://github.com/SemanticMastery)  
**Local clone path:** `C:\Users\bradl\1-Projects\semantic-mastery-skills` (this folder — not under `icm-authoring/dist/`)

**Course (source of truth):** https://docshare.us/content-pipeline-suite-course/

The live interview Worker is not in this catalog.

## Bundles

| Bundle | Folder |
|--------|--------|
| Content Pipeline Suite | `workflows/content-pipeline-suite/` |
| Local Schema | `workflows/local-schema/` |
| ICM | `skills/icm-architect/` |

Install one bundle at a time: open its folder, run its `INSTALL`, and flatten. Each skill must land at `<host-skills-root>/<skill-name>/SKILL.md`. Do not point Cursor or Claude Code at the suite folder.

## License

Licenses are per bundle. The Content Pipeline Suite keeps the enrolled-students notice. Local Schema stays Apache-2.0 (`workflows/local-schema/LICENSE`). This repository has no single root license.

## Releases

- Workflow zips are built from each workflow's `scripts/build-bundle.ps1` (e.g. `workflows/local-schema/dist/local-schema-YYYYMMDD.zip`).
- Standalone skills may also ship a zip from the authoring repo (e.g. `icm-architect` student zip) as a non-git fallback; the tree in this catalog is the GitHub install source.
- `git pull` does not refresh skills already flattened into a host. Re-run that bundle's INSTALL flatten to update.

## Canonical editing

| Product | Day-to-day authoring | Publish into this catalog at |
|---------|----------------------|------------------------------|
| Content Pipeline Suite | Ops `.cursor/skills/` and Shareable staging | `workflows/content-pipeline-suite/` |
| ICM (setup / architect / migrate) | `1-Projects/icm-authoring/skills/` | `skills/icm-architect/` |
| Local Schema Generator | `~/.cursor/skills/` (+ notes in `workflows/local-schema/.authoring/`) | `workflows/local-schema/` |

Live installs remain under the synced `.cursor/skills/` tree. Snapshots here are for distribution / GitHub.
