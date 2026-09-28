# icm-setup — ICM skills pack (router)

**What this is:** A thin Cursor skill that asks (or auto-detects) whether you need a **new** ICM folder tree or a **retrofit** on an existing folder, then hands off to the right skill.

Install the public catalog bundle `workflows/icm/` with its flatten script so these three folders land as siblings. The `icm-pack.zip` archive is the fallback when you cannot run the script. Either way you should end up with:

```text
.cursor/skills/icm-setup/SKILL.md
.cursor/skills/icm-architect/SKILL.md
.cursor/skills/icm-migrate/SKILL.md
```

| Skill | Slash | Use when |
|-------|-------|----------|
| **icm-setup** (this) | `/icm-setup` | Unsure new vs existing — recommended coaching entry |
| **icm-architect** | `/icm-architect` | Greenfield scaffold (WorkFlows or Agency Client Direct) |
| **icm-migrate** | `/icm-migrate` | Existing tree → thin ICM harness + inventory refresh |

Direct `/icm-architect` and `/icm-migrate` still work if you already know which you need.

---

## Install

Primary: from the catalog bundle folder `workflows/icm/`, set `HOST_SKILLS_ROOT` to the host skills directory and run `scripts/flatten-install.ps1`, `scripts/flatten-install.sh`, or `node scripts/flatten-install.mjs`. That writes the three sibling skills. Do not run it without `HOST_SKILLS_ROOT` on a machine that already has these skills.

Fallback: expand `icm-pack.zip` **into** the `skills` folder (not into a nested double folder). Pick **project-level** or **global**.

### Project-level (Windows PowerShell, one-line)

```powershell
$project = "C:\path\to\your-project"; $zip = "C:\path\to\icm-pack.zip"; New-Item -ItemType Directory -Force -Path "$project\.cursor\skills" | Out-Null; Expand-Archive -Path $zip -DestinationPath "$project\.cursor\skills" -Force; (Test-Path "$project\.cursor\skills\icm-setup\SKILL.md") -and (Test-Path "$project\.cursor\skills\icm-architect\SKILL.md") -and (Test-Path "$project\.cursor\skills\icm-migrate\SKILL.md")
```

### Global (Windows PowerShell, one-line)

```powershell
$zip = "C:\path\to\icm-pack.zip"; $skills = Join-Path $env:USERPROFILE ".cursor\skills"; New-Item -ItemType Directory -Force -Path $skills | Out-Null; Expand-Archive -Path $zip -DestinationPath $skills -Force; (Test-Path (Join-Path $skills "icm-setup\SKILL.md")) -and (Test-Path (Join-Path $skills "icm-architect\SKILL.md")) -and (Test-Path (Join-Path $skills "icm-migrate\SKILL.md"))
```

`True` means all three skills installed.

### macOS / Linux

```bash
ZIP="/path/to/icm-pack.zip"; DEST="$HOME/.cursor/skills"; mkdir -p "$DEST" && unzip -o "$ZIP" -d "$DEST" && test -f "$DEST/icm-setup/SKILL.md" && test -f "$DEST/icm-architect/SKILL.md" && test -f "$DEST/icm-migrate/SKILL.md" && echo "OK"
```

(For project-level, set `DEST="/path/to/your-project/.cursor/skills"`.)

---

## First run — router

1. Open the folder you want to set up (empty or existing).
2. Invoke **`/icm-setup`**.
3. The skill auto-detects greenfield vs existing when obvious; if unclear, it asks once.
4. It then continues as **icm-architect** or **icm-migrate** — follow that flow (propose → confirm → write).

---

## Sibling docs

- Greenfield install detail: `../icm-architect/README.md`
- Retrofit / Mode 1 class notes: `../icm-migrate/README.md`

## Attribution

ICM by Jake Van Clief — [Interpretable Context Methodology](https://github.com/RinDig/Interpretable-Context-Methodology). Deeper study: [Clief Notes](https://smshort.link/clief-notes).
