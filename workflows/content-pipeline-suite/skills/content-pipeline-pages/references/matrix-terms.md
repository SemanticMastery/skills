# Matrix terms (algorithm trigger words)

Each approved page has one Content Maxima Matrix at `pages/matrix/{slug}/*_matrix.xlsx`. Use the **Algorithm Trigger Words** sheet (`Term`, `Count` / Frequency Score). Do not skim Language Analysis Reports for heading language.

## Before the brief (hard stop)

Do **not** write `page-{slug}-brief.md` until one of these is recorded on `runs[slug].matrix_terms`:

1. **Operator-selected terms** — the user lists the terms to use on this page.
2. **Default high-impact** — only after the user authorizes it. Default = every term with `Count >= 40`.

Ask first:

> Provide the specific algorithm trigger words for this page, or authorize the default high-impact list (Count 40+)?

If they list terms, persist `source: operator`. If they authorize the default (and do not provide a list), run `extract-matrix-terms.mjs` and persist `source: high_impact_default`.

Per-page operator selection is the safer habit. Never assume the 40+ default just because a prior page used it — ask on every slug until the operator tells you to stop asking for this campaign.

## How to use the terms

- Prefer them in **H1 / H2 / H3** when they fit the page.
- Sprinkle them through **body copy** (paragraph text) when they fit naturally. Same evidence-grid rule: a term in a sentence is still a claim.
- Terms are heading and phrasing candidates, not permission to invent service facts. If product documentation marks hours, pricing, crane, or insurance Unknown, do not turn a trigger word into a promised capability.
- Do not dump the whole list into the body. Use a term where a visitor would actually say it.

```bash
node scripts/extract-matrix-terms.mjs --campaign-dir "<abs>" --slug emergency-service
node scripts/advance-page.mjs --campaign-dir "<abs>" --slug emergency-service --set-terms-file terms.txt
node scripts/advance-page.mjs --campaign-dir "<abs>" --slug emergency-service --authorize-default-terms
```
