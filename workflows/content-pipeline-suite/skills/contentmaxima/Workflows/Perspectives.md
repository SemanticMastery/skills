# Perspectives Workflow

Generate Content Maxima perspectives for a keyword and download the .xlsx file.

## Status

```
Running the **Perspectives** workflow from the **ContentMaxima** skill...
```

## Intent-to-flag mapping

### Keyword (required)

Extract the keyword from the user's request.

### Categories

| User says | Flag | Default |
|-----------|------|---------|
| (nothing) | all categories | Yes |
| "just SEO and conversion" | `--categories "seo_search_engine_optimized_content,conversion_engagement_content"` | |

Available category IDs:
- `persona_audience_insights`
- `customer_journey_intent_mapping`
- `positioning_strategy`
- `content_types_formats`
- `trend_review_based_content`
- `seo_search_engine_optimized_content`
- `seasonal_geographic_cultural_content`
- `legal_compliance_risk_reduction_content`
- `conversion_engagement_content`
- `pricing_value_based_positioning`
- `post_purchase_loyalty_content`
- `innovation_future_proofing_content`

### Model / output / display

Same as Matrix workflow — see `Workflows/Matrix.md`.

## Execute

```bash
cd "$CONTENT_MAXIMA_SKILL_ROOT"
bun Tools/Perspectives.ts \
  "<KEYWORD>" \
  [--categories "<IDS>"] \
  [--model <MODEL>] \
  [--output <DIR>] \
  [--headless <true|false>]
```
