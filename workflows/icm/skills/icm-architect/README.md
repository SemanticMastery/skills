# icm-architect — Install README

**What this is:** A Cursor skill that interviews you and scaffolds Interpretable Context Methodology (ICM) folder trees — **WorkFlows** (ops/automation stages) or **Agency Client Direct** (`Client → Campaign`).

**Install:** From the public catalog bundle `workflows/icm/`, set `HOST_SKILLS_ROOT` and run `scripts/flatten-install.ps1`, `scripts/flatten-install.sh`, or `node scripts/flatten-install.mjs`. That places `icm-setup/`, `icm-architect/`, and `icm-migrate/` side by side. `icm-pack.zip` is the fallback: expand it into the same skills folder. Pick project-level or global below; only the destination changes.

---

## ICM router (`/icm-setup`)

If you are unsure whether the folder is **new** (greenfield) or **existing**, invoke **`/icm-setup`** first.

| Slash | Role |
|-------|------|
| `/icm-setup` | Thin router: auto-detect (or ask) → hand off to architect or migrate |
| `/icm-architect` | Direct: greenfield scaffold (this skill) |
| `/icm-migrate` | Direct: retrofit harness on an existing tree |
| `/icm-refresh-context` | Refresh inventory on a migrate harness |

The router does **not** scaffold itself. After triage it reads and follows this skill or `icm-migrate`. Direct `/icm-architect` still works when you already know you need a greenfield tree.

Pack install must leave siblings next to this folder:

```text
.cursor/skills/icm-setup/SKILL.md
.cursor/skills/icm-architect/SKILL.md
.cursor/skills/icm-migrate/SKILL.md
```

---

## Choose: project-level vs global

| | **Project-level** | **Global (user-level)** |
|--|-------------------|-------------------------|
| **Where it lives** | Inside one project: `<project>/.cursor/skills/icm-architect/` | On your machine for all projects: `~/.cursor/skills/icm-architect/` |
| **Best when** | You only need ICM scaffolding in **this** client/campaign repo, or you want the skill versioned with a shared project | You scaffold many greenfield folders and want `/icm-architect` available **everywhere** without re-copying |
| **Who sees it** | Anyone who clones that project (if you commit `.cursor/skills/`) | Only your Cursor user account on this computer (unless you sync `.cursor` yourself) |
| **Typical coaching choice** | Class demo in a throwaway folder; client workspaces you share | Consultants who start many empty project folders |

You can install **both** if you want (global for daily use + project copy for a shared repo). If both exist, Cursor may load either; prefer one source of truth and update both when the skill changes.

---

## Before you install

1. Download and save the zip (e.g. Desktop or Downloads).
2. Note the full path to the zip — you’ll use it in the commands below.
3. After install, open or create a **greenfield** folder to run this skill (empty, or only `.git` / a single README / a business `*dossier*.md` or `*dossier*.docx`). For an existing messy tree, use `/icm-setup` or `/icm-migrate` instead.

---

## Option A — Project-level install

Use this when the skill should live **only in one project**.

### Final paths you must have (pack)

```text
<project>/.cursor/skills/icm-setup/SKILL.md
<project>/.cursor/skills/icm-architect/SKILL.md
<project>/.cursor/skills/icm-migrate/SKILL.md
```

### Steps (any OS — File Explorer / Finder)

1. Open (or create) your project folder in Cursor.
2. Create folders if needed: `.cursor` → `skills`.
3. Expand the zip **into** `.cursor/skills/` so you get folders named `icm-setup`, `icm-architect`, and `icm-migrate` (not nested double folders).
4. Confirm each `SKILL.md` is at the paths above.
5. In chat, invoke **`/icm-setup`** (unsure) or **`/icm-architect`** (greenfield).

### Windows PowerShell (one-line, paste-safe)

Replace the two paths, then run:

```powershell
$project = "C:\path\to\your-project"; $zip = "C:\path\to\icm-pack.zip"; New-Item -ItemType Directory -Force -Path "$project\.cursor\skills" | Out-Null; Expand-Archive -Path $zip -DestinationPath "$project\.cursor\skills" -Force; (Test-Path "$project\.cursor\skills\icm-architect\SKILL.md") -and (Test-Path "$project\.cursor\skills\icm-setup\SKILL.md") -and (Test-Path "$project\.cursor\skills\icm-migrate\SKILL.md")
```

`True` means install succeeded.

### macOS / Linux (Terminal)

```bash
PROJECT="/path/to/your-project"; ZIP="/path/to/icm-pack.zip"; mkdir -p "$PROJECT/.cursor/skills" && unzip -o "$ZIP" -d "$PROJECT/.cursor/skills" && test -f "$PROJECT/.cursor/skills/icm-architect/SKILL.md" && test -f "$PROJECT/.cursor/skills/icm-setup/SKILL.md" && echo "OK"
```

---

## Option B — Global (user-level) Cursor install

Use this when you want the skill available in **any** project on this machine.

### Final path you must have (this skill)

| OS | Path |
|----|------|
| **Windows** | `C:\Users\<YourName>\.cursor\skills\icm-architect\SKILL.md` |
| **macOS / Linux** | `~/.cursor/skills/icm-architect/SKILL.md` |

(`~` is your home directory. Pack siblings `icm-setup` and `icm-migrate` should sit next to this folder.)

### Steps (any OS)

1. Open your user home folder.
2. Open or create `.cursor` → `skills`.
3. Expand the zip **into** that `skills` folder so you get `icm-setup/`, `icm-architect/`, and `icm-migrate/`.
4. Restart Cursor or open a new agent chat so skills refresh (if `/icm-architect` does not appear immediately).
5. Open a greenfield project folder and invoke **`/icm-setup`** or **`/icm-architect`**.

### Windows PowerShell (one-line, paste-safe)

```powershell
$zip = "C:\path\to\icm-pack.zip"; $skills = Join-Path $env:USERPROFILE ".cursor\skills"; New-Item -ItemType Directory -Force -Path $skills | Out-Null; Expand-Archive -Path $zip -DestinationPath $skills -Force; Test-Path (Join-Path $skills "icm-architect\SKILL.md")
```

`True` means this skill installed (also confirm `icm-setup` and `icm-migrate` folders exist).

### macOS / Linux (Terminal)

```bash
ZIP="/path/to/icm-pack.zip"; mkdir -p "$HOME/.cursor/skills" && unzip -o "$ZIP" -d "$HOME/.cursor/skills" && test -f "$HOME/.cursor/skills/icm-architect/SKILL.md" && echo "OK"
```

---

## Verify install (both options)

Under the `icm-architect/` install folder you should see at least:

- `SKILL.md` (required)
- `README.md` (this file)
- `INSTALL.md`, `setup-interview.md`
- `references/` and `templates/` folders

Wrong layout examples (fix these):

```text
# Nested too deep
.cursor/skills/icm-architect/icm-architect/SKILL.md

# Missing the skill folder name
.cursor/skills/SKILL.md
```

---

## First run (after either install)

1. Open a **greenfield** project (empty or dossier-only is fine). Or use `/icm-setup` if unsure.
2. Invoke **`/icm-architect`** (or let `/icm-setup` hand off here).
3. Complete the short interview (location → type → harness → goal → outcome → tools).
4. Review the proposed tree; say **`Create it`** or **`Confirmed — scaffold`** when ready (“Looks good” alone is not enough).
5. Open the written **`HOW-TO-WORK-THIS-PROJECT.md`** — it includes the folder tree diagram and next steps.

Hard rules the skill enforces:

- **Propose → confirm → write** (nothing is created until you approve).
- **Greenfield only** for scaffolding; messy existing trees → use `/icm-setup` / `/icm-migrate`.
- Business dossier files (`*dossier*.md` / `*dossier*.docx`) at the root are allowed and help fill campaign context.

---

## Updating the skill later

1. Delete or replace the pack folders (`icm-setup`, `icm-architect`, `icm-migrate`) at the same install path you used (project or global).
2. Expand the new zip into that same parent `skills/` directory.
3. Confirm `SKILL.md` still sits at `.../icm-architect/SKILL.md` (and siblings exist).

---

## Claude Code (optional)

Same package layout. Copy each skill folder to:

- Project: `<project>/.claude/skills/<skill-name>/`
- Or your Claude Code user skills location, if you use one

Cursor remains the primary harness for this coaching package.

---

## Help & attribution

- Class walkthrough notes: `COACHING-README.md`
- Deeper install notes for maintainers: `INSTALL.md`
- Router pack entry: sibling `../icm-setup/README.md`
- Retrofit skill: sibling `../icm-migrate/README.md`
- **ICM** by Jake Van Clief — [Interpretable Context Methodology](https://github.com/RinDig/Interpretable-Context-Methodology)
- Deeper study: [Clief Notes](https://smshort.link/clief-notes)

Questions about the skill package: ask your coach (Semantic Mastery).
