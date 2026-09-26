# Analysis Workflow

Generate a Content Maxima keyword analysis and download the .xlsx file.

## Status

```
Running the **Analysis** workflow from the **ContentMaxima** skill...
```

## Intent-to-flag mapping

### Keyword (required)

Extract the keyword from the user's request.

### Related terms count

| User says | Flag | Default |
|-----------|------|---------|
| (nothing) | `--related 5` | Yes |
| "10 related terms" | `--related 10` | |

### Tier 2 terms count

| User says | Flag | Default |
|-----------|------|---------|
| (nothing) | `--tier2 3` | Yes |
| "5 tier 2 terms" | `--tier2 5` | |

### Model / output / display

Same as Matrix workflow — see `Workflows/Matrix.md`.

## Execute

```bash
cd "$CONTENT_MAXIMA_SKILL_ROOT"
bun Tools/Analysis.ts \
  "<KEYWORD>" \
  [--related <N>] \
  [--tier2 <N>] \
  [--model <MODEL>] \
  [--output <DIR>] \
  [--headless <true|false>]
```
