# Voice DNA (optional)

Resolve **before** `3.2-draft`. Edit and polish keep whatever voice the draft set. Voice DNA is optional: never block produce if none exists.

## Discover

Scan `{pipeline_dir}/01-resources/` (top level first) for files whose names match, case-insensitive:

- `*voice-dna*`
- `*voice_dna*`
- `*brand-voice*`
- `*author-voice*`

Accept `.json` or `.md`. Typical extract from the voice-extractor skill is `{name}-voice-dna.json` with `meta.author`. The producer is `voice-interview`: it lands that file in `01-resources/` after HITL. This file only describes how draft resolves it.

Classify when useful:

| Signal | Treat as |
|--------|----------|
| Filename or `meta` contains `brand` | Brand voice |
| Filename or `meta.author` is a person; or name contains `author` | Author voice |

Do not invent a Voice DNA file. Do not read intake copies outside `01-resources/` unless the operator points there.

## Select

| Files found | Action |
|-------------|--------|
| **0** | Default clean professional tone. Heuristic **Voice source:** `none — default professional`. |
| **1** | Read it. Write the draft in that voice. Do not ask. |
| **2+** (usually author + brand) | **Stop and ask** which file to use as the article / author voice. Do not guess. Do not blend both. After they pick, read only that file. |

`gate_mode=auto` does **not** skip the two-file question.

## Draft / edit / polish

- Draft: match the selected file (POV, cadence, vocabulary). Still obey `ai-isms.md` and the no-em-dash rule even if the DNA uses those patterns.
- Heuristic Summary must include **Voice source** (path + speaker, or none).
- Edit and polish: keep that voice. Do not flatten an author voice back to generic professional.
