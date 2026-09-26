# Matrix Workflow

Generate a Content Maxima keyword matrix and download the .xlsx file.

## Status

```
Running the **Matrix** workflow from the **ContentMaxima** skill...
```

## Prerequisites

- `CONTENT_MAXIMA_EMAIL` and `CONTENT_MAXIMA_PASSWORD` set
- Playwright Chromium installed
- `CONTENT_MAXIMA_SKILL_ROOT` set (or `cd` to skill root)

## Intent-to-flag mapping

### Keyword (required)

| User says | Argument |
|-----------|----------|
| "matrix for press releases" | `"press releases"` |
| "generate matrix for SEO" | `"seo"` |
| "keyword matrix: link building" | `"link building"` |

### Model selection

| User says | Flag | Default |
|-----------|------|---------|
| (nothing) | _(site default: gpt-4o)_ | Yes |
| "use gpt-4o-mini" / "mini model" | `--model gpt-4o-mini` | |
| "use o3-mini" | `--model o3-mini` | |

### Output location

| User says | Flag | Default |
|-----------|------|---------|
| (nothing) | `./ContentMaxima` under cwd | Yes |
| "save to ~/Documents" | `--output ~/Documents` | |

### Display mode

| User says | Flag | Default |
|-----------|------|---------|
| (nothing) | headless | Yes |
| "show browser" / "headed" | `--headless false` | |

## Execute

```bash
cd "$CONTENT_MAXIMA_SKILL_ROOT"
bun Tools/Matrix.ts \
  "<KEYWORD>" \
  [--model <MODEL>] \
  [--output <DIR>] \
  [--headless <true|false>]
```

## Post-execution

1. Report the output file path
2. Optionally preview sheet names / row counts with spreadsheet tools

## Troubleshooting

| Error | Likely cause | Fix |
|-------|--------------|-----|
| Missing credentials | Env not set | Add email/password to `~/.env` or skill `.env` |
| Login timeout | Site down or bad creds | Run headed (`--headless false`) |
| Generation timeout (>3min) | Complex keyword / load | Retry |
| Download button not found | Site UI changed | Headed debug; update selectors in `Tools/` |
