# Semantic Mastery - Agent Skills

Named bundles for [Semantic Mastery](https://mastermind.semanticmastery.com/) coaching and fulfillment. Students clone [SemanticMastery/skills](https://github.com/SemanticMastery/skills) (`master`).

**Organization:** [SemanticMastery on GitHub](https://github.com/SemanticMastery)

**Local clone:** the `semantic-mastery-skills` checkout of this repository. Set `SEMANTIC_MASTERY_SKILLS_ROOT` to that folder. It is not an `icm-authoring` tree.

**Course (source of truth):** https://docshare.us/content-pipeline-suite-course/

The live interview Worker is not in this catalog.

## Bundles

| Bundle | Folder |
|--------|--------|
| Content Pipeline Suite | `workflows/content-pipeline-suite/` |
| Local Schema | `workflows/local-schema/` |
| ICM | `workflows/icm/` |
| Decision trace | `workflows/decision-trace/` |

Install one bundle at a time: open its folder, run its `INSTALL`, and flatten. Each skill must land at `<host-skills-root>/<skill-name>/SKILL.md`. Do not point Cursor or Claude Code at the bundle folder.

## License

Licenses are per bundle. This repository has no single license that covers every folder.

| Bundle | License |
|--------|---------|
| Content Pipeline Suite | [Semantic Mastery Member License](LICENSE-MEMBERS.md) |
| Decision trace | [Semantic Mastery Member License](LICENSE-MEMBERS.md) |
| Local Schema | Apache-2.0 (`workflows/local-schema/LICENSE`) |
| ICM | Apache-2.0 (`workflows/icm/LICENSE`) |

## Releases

- Workflow zips are built from each workflow's build script where one exists.
- The ICM zip fallback is `icm-pack-v<version>.zip`. The tree in this catalog is the install source.
- `git pull` does not refresh skills already flattened into a host. Re-run that bundle's INSTALL flatten to update.

## Canonical editing

| Product | Day-to-day authoring | Publish into this catalog at |
|---------|----------------------|------------------------------|
| Content Pipeline Suite | operations skills folder and the shareable staging lane | `workflows/content-pipeline-suite/` |
| ICM (setup / architect / migrate) | user skills folder (`~/.cursor/skills/`) | `workflows/icm/` |
| Decision trace | operations skills folder for the video and capture skills; user skills folder for `video-feedback` | `workflows/decision-trace/` |
| Local Schema Generator | user skills folder (`~/.cursor/skills/`) | `workflows/local-schema/` |

Live installs remain under the user skills folder. Snapshots here are for distribution.
