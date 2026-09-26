# Personas Workflow

Generate Content Maxima personas for a keyword and download the .xlsx file.

## Status

```
Running the **Personas** workflow from the **ContentMaxima** skill...
```

## Intent-to-flag mapping

### Keyword (required)

Extract the keyword from the user's request.

### Model / output / display

Same as Matrix workflow — see `Workflows/Matrix.md`.

## Execute

```bash
cd "$CONTENT_MAXIMA_SKILL_ROOT"
bun Tools/Personas.ts \
  "<KEYWORD>" \
  [--model <MODEL>] \
  [--output <DIR>] \
  [--headless <true|false>]
```
