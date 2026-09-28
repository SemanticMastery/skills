# icm-migrate — Install README

**What this is:** A Cursor skill that retrofits a thin Interpretable Context Methodology (ICM) **router harness** onto an **existing** folder tree (`CONTEXT.md` + `.cursor/rules/project-rules.mdc`, optional `AGENTS.md`, inventory markers, optional nudge-only hooks). It does **not** scaffold a full Agency/WorkFlows tree from scratch — that is `icm-architect`.

**Install:** From the public catalog bundle `workflows/icm/`, set `HOST_SKILLS_ROOT` and run `scripts/flatten-install.ps1`, `scripts/flatten-install.sh`, or `node scripts/flatten-install.mjs`. That places `icm-setup/`, `icm-architect/`, and `icm-migrate/` side by side. `icm-pack.zip` is the fallback.

---

## ICM router (`/icm-setup`)

If you are unsure whether the folder is **new** or **existing**, invoke **`/icm-setup`** first.

| Slash | Role |
|-------|------|
| `/icm-setup` | Thin router: auto-detect (or ask) → hand off to architect or migrate |
| `/icm-migrate` | Direct: retrofit harness on this existing root (this skill) |
| `/icm-architect` | Direct: greenfield scaffold only |
| `/icm-refresh-context` | Refresh inventory markers in an existing `CONTEXT.md` |

The router does **not** write files itself. After triage it reads and follows this skill or `icm-architect`.

**Coaching / class scope:** Use **Mode 1** only (harness + refresh + optional nudge hooks). A “Mode 2 — deeper migrate” line may appear in `SKILL.md` for maintainers; it is **not** a finished class workflow — do not ask the agent to invent folder renumbers or Agency remaps for class.

---

## Choose: project-level vs global

| | **Project-level** | **Global (user-level)** |
|--|-------------------|-------------------------|
| **Where it lives** | `<project>/.cursor/skills/icm-migrate/` | `~/.cursor/skills/icm-migrate/` |
| **Best when** | One operations root you share | You retrofit many roots on this machine |
| **Pack install** | Expand the zip into `<project>/.cursor/skills/` so **all three** skill folders appear | Expand into `~/.cursor/skills/` |

You need **icm-setup** and **icm-architect** siblings installed if you want `/icm-setup` routing. Direct `/icm-migrate` only needs this folder.

---

## Before you install

1. Save the zip and note its full path.
2. Open the **existing** workspace root you want to harness (not an empty greenfield folder — use `/icm-architect` for that).
3. Prefer expanding the **full pack** so router + architect + migrate stay in sync.

---

## Option A — Project-level install (pack)

### Final paths you must have

```text
<project>/.cursor/skills/icm-setup/SKILL.md
<project>/.cursor/skills/icm-architect/SKILL.md
<project>/.cursor/skills/icm-migrate/SKILL.md
```

### Windows PowerShell (one-line, paste-safe)

```powershell
$project = "C:\path\to\your-project"; $zip = "C:\path\to\icm-pack.zip"; New-Item -ItemType Directory -Force -Path "$project\.cursor\skills" | Out-Null; Expand-Archive -Path $zip -DestinationPath "$project\.cursor\skills" -Force; (Test-Path "$project\.cursor\skills\icm-migrate\SKILL.md") -and (Test-Path "$project\.cursor\skills\icm-setup\SKILL.md")
```

### macOS / Linux

```bash
PROJECT="/path/to/your-project"; ZIP="/path/to/icm-pack.zip"; mkdir -p "$PROJECT/.cursor/skills" && unzip -o "$ZIP" -d "$PROJECT/.cursor/skills" && test -f "$PROJECT/.cursor/skills/icm-migrate/SKILL.md" && echo "OK"
```

---

## Option B — Global install (pack)

### Final path (this skill)

| OS | Path |
|----|------|
| **Windows** | `C:\Users\<YourName>\.cursor\skills\icm-migrate\SKILL.md` |
| **macOS / Linux** | `~/.cursor/skills/icm-migrate/SKILL.md` |

### Windows PowerShell (one-line, paste-safe)

```powershell
$zip = "C:\path\to\icm-pack.zip"; $skills = Join-Path $env:USERPROFILE ".cursor\skills"; New-Item -ItemType Directory -Force -Path $skills | Out-Null; Expand-Archive -Path $zip -DestinationPath $skills -Force; Test-Path (Join-Path $skills "icm-migrate\SKILL.md")
```

### macOS / Linux

```bash
ZIP="/path/to/icm-pack.zip"; mkdir -p "$HOME/.cursor/skills" && unzip -o "$ZIP" -d "$HOME/.cursor/skills" && test -f "$HOME/.cursor/skills/icm-migrate/SKILL.md" && echo "OK"
```

---

## Verify install

Under `icm-migrate/` you should see at least:

- `SKILL.md`, `README.md`, `INSTALL.md`
- `references/`, `templates/`, `scripts/`

Wrong layout: nested `icm-migrate/icm-migrate/SKILL.md`, or only files dumped into `skills/` without the folder name.

---

## First run (after either install)

1. Open the **existing** root as the Cursor workspace.
2. Prefer **`/icm-setup`** if unsure; or invoke **`/icm-migrate`** directly.
3. Complete the short interview; review the propose (file list + drafts + rationale).
4. Approve with **`Create it`** or **`Confirmed — write harness`** (“Looks good” alone is not enough).
5. Later, when top-level children change: **`/icm-refresh-context`**.

Hard rules:

- **Propose → confirm → write**
- Existing content is **expected** (do not use architect’s greenfield refuse here)
- Hooks are **nudge-only** (never auto-rewrite `project-rules.mdc`)
- Class: **Mode 1 only**

---

## Updating later

Replace the three pack folders (`icm-setup`, `icm-architect`, `icm-migrate`) from a new zip into the same parent `skills/` directory.

---

## Help & attribution

- Maintainer install notes: `INSTALL.md`
- Router pack entry: sibling `../icm-setup/README.md`
- **ICM** by Jake Van Clief — [Interpretable Context Methodology](https://github.com/RinDig/Interpretable-Context-Methodology)
- Deeper study: [Clief Notes](https://smshort.link/clief-notes)

Questions about the skill package: ask your coach (Semantic Mastery).
