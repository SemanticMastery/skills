# ContentMaxima — Cursor Skill

> **Personal use only.** `ReverseEngineering/` reproduces Content Maxima's matrix
> semantics through your own OpenAI key. Use it for your own client work. Do not
> redistribute it, resell it, publish the prompts, or offer it as a standalone
> product or service. When in doubt, or when Content Maxima's terms and your
> intended use pull in different directions, run the official export path in
> `Tools/` against your own subscription instead.

_The official Playwright path in `Tools/` needs your own Content Maxima account. Nothing here is licensed or hosted for you._

Standalone port of the **ContentMaxima** SEO/content skill for [Cursor](https://cursor.com).

## Install

**Full guide (Windows + macOS + Linux, agent-friendly):** see **[INSTALL.md](INSTALL.md)**

**Hand this to a friend's Cursor agent:**

```
Unpack this folder (or zip), then read INSTALL.md and install the ContentMaxima skill for me.
Ask me for Content Maxima login and/or OPENAI_API_KEY when needed.
```

Quick start (macOS / Linux):

```bash
cd contentmaxima-cursor
chmod +x setup.sh && ./setup.sh
mkdir -p ~/.cursor/skills
ln -sfn "$(pwd)" ~/.cursor/skills/contentmaxima
```

Quick start (Windows PowerShell):

```powershell
cd $env:USERPROFILE\contentmaxima-cursor
.\setup.ps1
# Then follow INSTALL.md Step 3 to copy into .cursor\skills\contentmaxima
```

Restart Cursor or start a **new chat** so the skill is discovered.

## Configure

In `~/.env` or skill `.env`:

```bash
# Official Playwright exports
CONTENT_MAXIMA_EMAIL=you@example.com
CONTENT_MAXIMA_PASSWORD=your_password

# Reverse-engineered matrix
OPENAI_API_KEY=sk-...
```

## System requirements

- [Bun](https://bun.sh)
- Playwright Chromium (installed by `setup.sh` / `setup.ps1`)

## Usage in Cursor

```
@contentmaxima generate a content maxima matrix for local SEO
```

```
@contentmaxima build a reverse-engineered matrix for press release distribution
```

```
@contentmaxima run train AI for cybersecurity tools
```

## Structure

```
contentmaxima-cursor/
├── SKILL.md              # Orchestrator instructions
├── INSTALL.md            # Human + agent install guide
├── Tools/                # Official UI automation (Playwright)
├── ReverseEngineering/   # OpenAI matrix pipeline + prompts
├── Workflows/            # Per-module SOPs
└── lib/                  # Env loading + OpenAI client
```

## Differences from the Claude/SteamSpire skill

| Original | This port |
|----------|-----------|
| `spire-bun` | `bun` |
| Gauge / Boiler / ToolRegistry | `.env` + `lib/resolve-env.ts` + OpenAI SDK |
| Hardcoded login email | `CONTENT_MAXIMA_EMAIL` |
| SteamSpire notify hooks | Status messages in chat |
| `~/.spire/preferences/` | `~/.contentmaxima/preferences.md` |

## Sharing

This copy came to you through the coaching program. Install it, use it on your own client work, and leave redistribution alone — see the notice at the top.

## Using this with the Content Pipeline Suite

The suite calls two of these workflows. Everything else here is yours to use, but nothing else is required.

| Suite step | Workflow | Where the file has to end up |
|------------|----------|------------------------------|
| `content-pipeline-init` resource class `matrix` | Matrix | `{campaign}/01-intake/1.2-audit/contentmaxima/*_matrix*` |
| `content-pipeline-init` resource class `personas` | Personas | `{campaign}/01-intake/1.2-audit/contentmaxima/*_personas*` |
| `pipeline-pages-init` Matrix loop, one per approved page | Matrix | `{campaign}/06-content-pipeline/pages/matrix/{slug}/` |

`content-pipeline-pages` reads the **Algorithm Trigger Words** sheet out of the per-page Matrix. That is the only sheet it needs, and it is why a hand-built substitute is worse than no Matrix at all — the skill treats whatever it finds as real keyword data.

Point `CONTENT_MAXIMA_SKILL_ROOT` at wherever you installed this skill, then run the Matrix from that root with `--output` set to the campaign path above. On Windows use `npx --yes tsx Tools/Matrix.ts`, not `bun`, for anything under `Tools/` (see the runner note in SKILL.md).

If Playwright or the Content Maxima login blocks, report it and stop.
