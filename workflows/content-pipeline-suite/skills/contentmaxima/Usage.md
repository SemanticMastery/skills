# ContentMaxima

Automates Content Maxima through two paths:

- Official Playwright UI automation for exact `.xlsx` and `.pdf` exports.
- Reverse-engineered prompt pipeline for workflow-friendly `.csv` and `.json` matrix artifacts.

## When to use

- Running NLP analysis on a keyword before building content strategy
- Getting a Content Maxima matrix for a topic (foundation for topical maps)
- Getting algorithm trigger words without the official XLSX export
- Generating audience personas for a keyword or product
- Building content pathways for a specific entity and persona
- Running a full Content Maxima "Train AI" sequence for a topic
- Getting linguistic signatures for an entity (brand, person, or concept)

## Modules

| Module | Input | Output | Best for |
|--------|-------|--------|----------|
| Analysis | keyword + related/tier2 | .xlsx | Keyword NLP with related term expansion |
| Reverse-engineered Matrix | keyword | .csv + .json | Semantic matrix + algorithm trigger words |
| Matrix | keyword | .xlsx | Official semantic matrix export |
| Personas | keyword | .xlsx | Audience personas |
| Pathways | entity + persona | .pdf | Content pathways for entity–persona pairing |
| Perspectives | keyword + categories | .xlsx | Topic perspectives by category |
| Signatures | entity | .pdf | Linguistic signatures |
| Train AI | keyword | 6 files | All 6 modules in one run |

## Reverse-engineered matrix

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

## Official export output location

Default: `./ContentMaxima/` under the current working directory. Override with `--output <dir>`.

## Setup

See [INSTALL.md](INSTALL.md).

Official UI exports need:

```
CONTENT_MAXIMA_EMAIL=you@example.com
CONTENT_MAXIMA_PASSWORD=your_password
```

Reverse-engineered matrix needs:

```
OPENAI_API_KEY=sk-...
```

## Customization

Optional preferences: `~/.contentmaxima/preferences.md`
