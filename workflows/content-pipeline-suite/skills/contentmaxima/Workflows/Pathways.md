# Pathways Workflow

Generate Content Maxima pathways for an entity/persona pair and download the .pdf.

## Status

```
Running the **Pathways** workflow from the **ContentMaxima** skill...
```

## Intent-to-flag mapping

### Entity (required — positional)

The topic/entity from the user request.

### Persona (required)

| User says | Flag |
|-----------|------|
| "as a marketing manager" | `--persona "marketing manager"` |
| "for a content strategist" | `--persona "content strategist"` |
| "persona: SEO specialist" | `--persona "SEO specialist"` |

If the user doesn't specify a persona, **ask them** — it's required.

### Model / output / display

Same as Matrix workflow — see `Workflows/Matrix.md`.

## Execute

```bash
cd "$CONTENT_MAXIMA_SKILL_ROOT"
bun Tools/Pathways.ts \
  "<ENTITY>" \
  --persona "<PERSONA>" \
  [--model <MODEL>] \
  [--output <DIR>] \
  [--headless <true|false>]
```
