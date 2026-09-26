# TrainAI Workflow

Run ALL Content Maxima modules for a keyword and download all generated files.

Aggregator: Analysis, Matrix, Pathways, Personas, Perspectives, and Signatures,
then downloads all 6 files.

## Status

```
Running the **TrainAI** workflow from the **ContentMaxima** skill...
```

## Intent-to-flag mapping

### Keyword (required)

Extract the keyword from the user's request.

### Model / output / display

Same as Matrix workflow — see `Workflows/Matrix.md`.

## Execute

```bash
cd "$CONTENT_MAXIMA_SKILL_ROOT"
bun Tools/TrainAI.ts \
  "<KEYWORD>" \
  [--model <MODEL>] \
  [--output <DIR>] \
  [--headless <true|false>]
```

## Expected output

6 files downloaded (names may vary slightly by site):
- analysis `.xlsx`
- matrix `.xlsx`
- pathways `.pdf`
- personas `.xlsx`
- perspectives `.xlsx`
- linguistic signature `.pdf`

## Timing

Typically ~2–10 minutes. The script polls progress and reports module completion.
