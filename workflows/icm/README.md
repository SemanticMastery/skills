# ICM

Install `icm-setup`, `icm-architect`, and `icm-migrate` together. `/icm-setup` is the entry point: it routes a new folder to `icm-architect` and an existing folder to `icm-migrate`.

| Skill | What it does |
|---|---|
| `icm-setup` | Asks whether the folder is new or existing, then hands off |
| `icm-architect` | Interviews you and scaffolds a new project tree |
| `icm-migrate` | Adds a thin router harness to a folder tree you already have |

See `INSTALL.md` for the flatten script and the zip fallback. ICM is by Jake Van Clief. See `NOTICE`.
