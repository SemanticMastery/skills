---
name: contentmaxima
description: >-
  Content Maxima automation and reverse-engineered prompt workflows for SEO
  analysis, keyword matrix, personas, pathways, perspectives, signatures, and
  full Train AI exports. Use when the user mentions content maxima, matrix,
  algorithm trigger words, personas, pathways, perspectives, signatures, train
  AI, keyword matrix, or SEO matrix.
metadata:
  version: "1.0.0"
---

# ContentMaxima (Cursor)

Automate Content Maxima through the official Playwright UI path or the
reverse-engineered OpenAI prompt pipeline.

## Adherence contract

When ContentMaxima is triggered, the selected workflow governs the whole export
or reverse-engineered run: tool execution, output capture, artifact naming, and
final report. Do not replace an official export or reverse-engineered matrix run
with a manual SEO summary unless the user explicitly accepts that degraded path.
If Playwright login, OpenAI credentials, the runner (`bun` / `npx tsx`), or
output capture cannot run, stop and report the blocked/degraded condition
before presenting results.

## Human input gates

Pause and ask the user before:
- Accepting degraded/manual output
- Choosing expensive/broad export scope (especially full Train AI)
- Publishing matrix/signature conclusions as final strategy

Proceed without pause for: login/download automation, reverse-engineered prompt
execution, file capture, and deterministic artifact checks — once keyword/path
are known.

## Prerequisites

**Skill root** — set before running scripts:

```bash
export CONTENT_MAXIMA_SKILL_ROOT="/path/to/contentmaxima-cursor"  # e.g. ~/.cursor/skills/contentmaxima
```

First-time install: follow **INSTALL.md**. One-time setup: `setup.sh` (Unix) or
`setup.ps1` (Windows).

| Variable | Required for |
|----------|----------------|
| `CONTENT_MAXIMA_EMAIL` | Official UI exports (Playwright) |
| `CONTENT_MAXIMA_PASSWORD` | Official UI exports (Playwright) |
| `OPENAI_API_KEY` | Reverse-engineered matrix pipeline |

**System:** `bun` (setup + reverse-engineered path), Playwright browsers
(`bunx playwright install chromium`). Official UI exports on Windows also need
Node 18+ (for `npx tsx` — see runner note below).

Credentials load from (first match wins): skill `.env` → `~/.env` →
`~/.contentmaxima/.env` → shell env.

Optional preferences file (if present, read and apply):
`~/.contentmaxima/preferences.md`

### Windows runner (official Playwright tools)

On Windows, **do not use `bun` for `Tools/*.ts`**. Bun + Playwright often hangs
at browser launch (`TimeoutError: launch … exceeded` after Chromium/Chrome
spawns — CDP/`remote-debugging-pipe` never connects). Node works.

**Default on Windows** for Analysis, Matrix, Personas, Pathways, Perspectives,
Signatures, Train AI:

```powershell
cd $env:CONTENT_MAXIMA_SKILL_ROOT
npx --yes tsx Tools/Matrix.ts "keyword" --output <dir>
```

Keep `bun` for `setup.ps1`, `bun install`, Playwright browser install, and
`ReverseEngineering/*.ts` (OpenAI path — no browser). If `npx tsx` also fails
to launch, stop and report blocked (do not invent manual SEO substitutes).

---

## Routing

| Intent | Workflow | Notes |
|--------|----------|-------|
| Reverse-engineered Matrix | `ReverseEngineering/full-matrix-run.ts` | Keyword → CSV/JSON via OpenAI; no ContentMaxima login |
| Analysis | `Workflows/Analysis.md` | Keyword + related/tier2 → .xlsx |
| Matrix | `Workflows/Matrix.md` | Keyword → .xlsx matrix |
| Personas | `Workflows/Personas.md` | Keyword → .xlsx personas |
| Pathways | `Workflows/Pathways.md` | Entity + persona → .pdf |
| Perspectives | `Workflows/Perspectives.md` | Keyword + categories → .xlsx |
| Signatures | `Workflows/Signatures.md` | Entity → .pdf linguistic signatures |
| Train AI | `Workflows/TrainAI.md` | Keyword → ALL 6 modules |

Read the matching workflow file, then execute from the skill root — on Windows
use `npx tsx` for official `Tools/*.ts`; `bun` is fine on Unix and for
`ReverseEngineering/`.

## Tools

Official export tools share login/download logic via `Tools/shared.ts`.

| Tool | Input | Output | Extra flags |
|------|-------|--------|-------------|
| `Tools/Analysis.ts` | keyword | .xlsx | `--related N --tier2 N` |
| `Tools/Matrix.ts` | keyword | .xlsx | — |
| `Tools/Personas.ts` | keyword | .xlsx | — |
| `Tools/Pathways.ts` | entity | .pdf | `--persona "..."` (required) |
| `Tools/Perspectives.ts` | keyword | .xlsx | `--categories "id1,id2"` |
| `Tools/Signatures.ts` | entity | .pdf | — |
| `Tools/TrainAI.ts` | keyword | 6 files | — |
| `ReverseEngineering/full-matrix-run.ts` | keyword | .csv/.json | `--keyword`, `--model`, `--output`, `--concurrency` |

**Common flags** (official tools): `--output <dir>`, `--headless false`, `--model <model>`

Run pattern (Windows — preferred):

```powershell
cd $env:CONTENT_MAXIMA_SKILL_ROOT
npx --yes tsx Tools/Matrix.ts "press releases" --output ./ContentMaxima
```

Run pattern (Unix / macOS):

```bash
cd "$CONTENT_MAXIMA_SKILL_ROOT"
bun Tools/Matrix.ts "press releases" --output ./ContentMaxima
```

## Reverse-engineered matrix

> **Personal use only.** `ReverseEngineering/` reproduces Content Maxima's matrix
> semantics through your own OpenAI key. Use it for your own client work. Do not
> redistribute it, resell it, publish the prompts, or offer it as a standalone
> product or service. When in doubt, or when Content Maxima's terms and your
> intended use pull in different directions, run the official export path in
> `Tools/` against your own subscription instead.

Use when you need matrix semantics / algorithm trigger words without official XLSX:

```bash
cd "$CONTENT_MAXIMA_SKILL_ROOT"
bun ReverseEngineering/full-matrix-run.ts \
  --keyword "press release distribution for agencies" \
  --model gpt-4o \
  --output ./ContentMaxima/reverse-engineered
```

Outputs:
- `<keyword>_language_analysis_reports.csv`
- `<keyword>_algorithm_trigger_words.csv`
- `<keyword>_raw.json`

Cheap validation (5 of 62 methods):

```bash
bun ReverseEngineering/test-matrix.ts
```

## Examples

**Single module:** "Generate content maxima personas for press releases"
→ Personas workflow → `.xlsx`

**Train AI:** "Run content maxima train AI for SEO"
→ TrainAI → 6 files (analysis, matrix, pathways, personas, perspectives, signatures)

**Pathways:** "Generate content maxima pathways for press releases as a marketing manager"
→ Pathways with `--persona "marketing manager"` → `.pdf`

**Reverse matrix:** "Build a reverse-engineered content maxima matrix for local SEO"
→ `full-matrix-run.ts` → CSV/JSON

## Additional resources

- [Usage.md](Usage.md) — when to use which module
- [Examples.md](Examples.md) — more prompt examples
- [INSTALL.md](INSTALL.md) — install for humans and Cursor agents
- [ReverseEngineering/README.md](ReverseEngineering/README.md) — RE architecture notes
