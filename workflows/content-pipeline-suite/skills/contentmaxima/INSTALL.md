# ContentMaxima Skill — Installation Guide

**For humans and Cursor agents.** Follow every step in order. Do not skip verification.

If you are a **Cursor agent** installing this for the user: execute each step yourself using the terminal/shell. Ask the user only when you need credentials, admin approval, or a choice between install options. Report success/failure after each major step.

---

## What you are installing

The **ContentMaxima** Cursor skill — SEO/content automation for Content Maxima:

- Official Playwright exports (Analysis, Matrix, Personas, Pathways, Perspectives, Signatures, Train AI)
- Reverse-engineered OpenAI matrix pipeline (CSV/JSON algorithm trigger words)

**Skill folder name:** `contentmaxima-cursor` (source) → installed as `~/.cursor/skills/contentmaxima` (or `%USERPROFILE%\.cursor\skills\contentmaxima` on Windows).

---

## Step 0 — Unpack (if needed)

If the user gave you a zip file:

| OS | Command |
|----|---------|
| **Windows (PowerShell)** | `Expand-Archive -Path contentmaxima-cursor-skill.zip -DestinationPath $env:USERPROFILE` |
| **macOS / Linux** | `unzip contentmaxima-cursor-skill.zip -d ~` |

After unpack, the skill root should be:

- **Windows:** `%USERPROFILE%\contentmaxima-cursor`
- **macOS / Linux:** `~/contentmaxima-cursor`

If the zip extracted as a nested folder (e.g. `~/contentmaxima-cursor/contentmaxima-cursor`), use the inner folder that contains `SKILL.md` and `setup.sh`.

Set `CONTENT_MAXIMA_SKILL_ROOT` to that absolute path for all later steps.

---

## Step 1 — Install prerequisites

### 1a. Bun (required)

**Windows (PowerShell):**
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```
Close and reopen the terminal, then verify: `bun --version`

**macOS / Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
```
Restart the terminal (or `source ~/.bashrc` / `~/.zshrc`), then verify: `bun --version`

### 1b. System libraries for Playwright (Linux only)

On Debian/Ubuntu, if Chromium later fails to launch:

```bash
# Playwright can install deps for you:
cd "$CONTENT_MAXIMA_SKILL_ROOT"
bunx playwright install-deps chromium
```

Or skip until smoke test; only needed for official UI exports.

---

## Step 2 — Run skill setup

Installs npm deps (`playwright`, `openai`, `exceljs`), downloads Chromium, creates `.env` template.

### Windows (PowerShell)

```powershell
cd $env:USERPROFILE\contentmaxima-cursor
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\setup.ps1
```

### macOS / Linux

```bash
cd ~/contentmaxima-cursor
chmod +x setup.sh
./setup.sh
```

**Expected:** `bun install` succeeds, Chromium installs, `.env` created from `.env.example`.

---

## Step 3 — Install into Cursor skills directory

Cursor discovers personal skills at:

| OS | Path |
|----|------|
| **Windows** | `%USERPROFILE%\.cursor\skills\contentmaxima` |
| **macOS / Linux** | `~/.cursor/skills/contentmaxima` |

### Windows (PowerShell)

**Option A — Copy (simplest, no admin):**
```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.cursor\skills"
if (Test-Path "$env:USERPROFILE\.cursor\skills\contentmaxima") {
  Remove-Item -Recurse -Force "$env:USERPROFILE\.cursor\skills\contentmaxima"
}
Copy-Item -Recurse "$env:USERPROFILE\contentmaxima-cursor" "$env:USERPROFILE\.cursor\skills\contentmaxima"
```

**Option B — Junction (one folder, no duplicate):**
```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.cursor\skills"
cmd /c mklink /J "%USERPROFILE%\.cursor\skills\contentmaxima" "%USERPROFILE%\contentmaxima-cursor"
```

### macOS / Linux

```bash
mkdir -p ~/.cursor/skills
ln -sfn ~/contentmaxima-cursor ~/.cursor/skills/contentmaxima
```

**Verify:** `SKILL.md` exists at the skills path:
- Windows: `Test-Path "$env:USERPROFILE\.cursor\skills\contentmaxima\SKILL.md"`
- Unix: `test -f ~/.cursor/skills/contentmaxima/SKILL.md && echo OK`

---

## Step 4 — Configure credentials

The skill reads keys from (first match wins):

1. `{skill-root}/.env`
2. `~/.env` (Windows: `%USERPROFILE%\.env`)
3. `~/.contentmaxima/.env`
4. Shell environment variables

### Official UI exports (Playwright)

Need a Content Maxima account at https://content-maxima.web.app

```
CONTENT_MAXIMA_EMAIL=you@example.com
CONTENT_MAXIMA_PASSWORD=your_password_here
```

### Reverse-engineered matrix (OpenAI)

```
OPENAI_API_KEY=sk-...
```

**Recommended:** put keys in `~/.env` (shared across skills).

**Agent:** If the user has not provided credentials, stop and ask which path they need (official vs reverse), then ask for the matching keys. Do not invent credentials. Do not commit `.env` files.

---

## Step 5 — Set CONTENT_MAXIMA_SKILL_ROOT (recommended)

**Windows (PowerShell — current session):**
```powershell
$env:CONTENT_MAXIMA_SKILL_ROOT = "$env:USERPROFILE\.cursor\skills\contentmaxima"
```

**Windows (persistent):**
```powershell
[System.Environment]::SetEnvironmentVariable(
  "CONTENT_MAXIMA_SKILL_ROOT",
  "$env:USERPROFILE\.cursor\skills\contentmaxima",
  "User"
)
```

**macOS / Linux** — add to `~/.bashrc` or `~/.zshrc`:
```bash
export CONTENT_MAXIMA_SKILL_ROOT="$HOME/.cursor/skills/contentmaxima"
```

---

## Step 6 — Smoke test

### A. Reverse path (needs `OPENAI_API_KEY` only — cheaper)

**Windows:**
```powershell
$env:CONTENT_MAXIMA_SKILL_ROOT = "$env:USERPROFILE\.cursor\skills\contentmaxima"
cd $env:CONTENT_MAXIMA_SKILL_ROOT
bun ReverseEngineering/test-matrix.ts
```

**macOS / Linux:**
```bash
export CONTENT_MAXIMA_SKILL_ROOT="$HOME/.cursor/skills/contentmaxima"
cd "$CONTENT_MAXIMA_SKILL_ROOT"
bun ReverseEngineering/test-matrix.ts
```

**Success:** 5 methods return related terms; summary prints without API key errors.

### B. Official path (needs Content Maxima email/password)

```bash
cd "$CONTENT_MAXIMA_SKILL_ROOT"
bun Tools/Matrix.ts "seo" --output ./ContentMaxima/install-test
```

**Success:** An `.xlsx` appears under `ContentMaxima/install-test` (or the suggested download name).

Skip B if the user only wants reverse-engineered matrices.

---

## Step 7 — Use in Cursor

1. **Quit and reopen Cursor**, or start a **new Agent chat** (skills load at session start).
2. In Agent chat:

```
@contentmaxima generate a content maxima matrix for local SEO
```

Or:

```
Read INSTALL.md — installation is complete. Build a reverse-engineered content maxima matrix for press release distribution.
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `@contentmaxima` not found | Confirm `SKILL.md` at `.cursor/skills/contentmaxima/`; start **new chat** |
| `bun: command not found` | Reinstall Bun; restart terminal and Cursor |
| Missing credentials | Add to `~/.env` or skill `.env` |
| Playwright / Chromium fails | `bunx playwright install chromium`; on Linux try `bunx playwright install-deps chromium` |
| Login timeout | Check email/password; retry with `--headless false` |
| Symlink failed (Windows) | Use **copy** install (Step 3 Option A) |
| PowerShell blocks `setup.ps1` | `Set-ExecutionPolicy -Scope Process Bypass` then rerun |

---

## Agent install checklist

Copy and track when installing for a user:

```
- [ ] Step 0: Unpacked; SKILL.md found at skill root
- [ ] Step 1a: bun --version works
- [ ] Step 2: setup.sh / setup.ps1 completed
- [ ] Step 3: SKILL.md exists in .cursor/skills/contentmaxima/
- [ ] Step 4: User confirmed credentials for the path they need
- [ ] Step 5: CONTENT_MAXIMA_SKILL_ROOT set
- [ ] Step 6: smoke test passed (A and/or B)
- [ ] Step 7: user told to start new Cursor chat
```

---

## File map (post-install)

```
.cursor/skills/contentmaxima/
├── SKILL.md                 ← Cursor reads this
├── INSTALL.md               ← This file
├── Tools/                   ← Playwright official exporters
├── ReverseEngineering/      ← OpenAI matrix pipeline
├── Workflows/               ← Per-module SOPs
├── lib/                     ← Env + OpenAI helpers
├── setup.sh / setup.ps1
└── .env.example
```

---

## Uninstall

```powershell
# Windows
Remove-Item -Recurse -Force "$env:USERPROFILE\.cursor\skills\contentmaxima"
Remove-Item -Recurse -Force "$env:USERPROFILE\contentmaxima-cursor"   # if separate copy
```

```bash
# macOS / Linux
rm -rf ~/.cursor/skills/contentmaxima
# rm -rf ~/contentmaxima-cursor   # if desired
```
