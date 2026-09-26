# Signatures Workflow

Generate Content Maxima linguistic signatures for an entity and download the .pdf.

## Status

```
Running the **Signatures** workflow from the **ContentMaxima** skill...
```

## Intent-to-flag mapping

### Entity (required)

Extract the entity/keyword from the user's request.

### Model / output / display

Same as Matrix workflow — see `Workflows/Matrix.md`.

## Execute

```bash
cd "$CONTENT_MAXIMA_SKILL_ROOT"
bun Tools/Signatures.ts \
  "<ENTITY>" \
  [--model <MODEL>] \
  [--output <DIR>] \
  [--headless <true|false>]
```
