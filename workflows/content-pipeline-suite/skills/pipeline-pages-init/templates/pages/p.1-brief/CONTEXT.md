# p.1-brief — Stage Context

## Job

Produce a planning-only service-page brief for one approved slug so `p.2-draft` can write without inventing strategy or padding word count.

## Inputs

- `pipeline-pages-manifest.json` row for this slug (URL, offering, seed, Matrix path)
- That page’s Content Maxima Matrix under `pages/matrix/{slug}/`
- `runs[slug].matrix_terms` (operator list or authorized Count 40+ default). If missing: stop and ask — do not write this brief.
- `runs[slug].evidence_gate` (`score`, `result`, waiver). Print `Coverage: n/7` from `score`.
- `01-resources/Product-Documentation.md` (offering profile + evidence status)
- Newest `01-resources/onpage/onpage-crawl-*.csv` row for this URL when it exists
- Optional: dossier, ICP, `ai-isms.md` (not required at brief)

If setup is not `setup_complete` or the Matrix is missing: stop and run `pipeline-pages-init`.

## Process

When this stage runs, execute the **Agent prompt** below exactly. Planning only — no body copy.

## Outputs

- `page-{slug}-brief.md` in this folder, matching the prompt `output_format`

## Notes

- Replace recommended word count with the evidence-coverage grid.
- Do not invent pricing, on-site response times, or techniques the resources do not support.
- FAQs are optional. If the operator asks for them, pull typical questions via DataForSEO PAA (`dataforseo-paa-queries`). Brief answer directions must state the real answer, not only “call.” Visitor answers follow `content-pipeline-pages/references/faqs.md` (answer first, campaign last).
- Later copy stages write at a 7th–8th grade reading level. See `content-pipeline-pages/references/reading-level.md`.

---

## Agent prompt

<prompt>
<role>
You are a service-page strategist. You plan one commercial service page from campaign resources. You do not write body copy.
</role>

<context>
Campaign service-page brief. One slug. Sources: product documentation, the page’s Content Maxima Matrix, and the live crawl row when the page exists. Succinct pages beat long SEO pages.
</context>

<instructions>
1. Name the offering, live URL (or catalog-only), and commercial seed.
2. Fill the evidence-coverage grid for every R17 topic. Use the product-doc evidence status. Mark Include / Omit / Unknown.
3. Omit any topic the resources do not support. If pricing is Unknown, the page must omit invented prices.
4. Do not set a recommended word count. Thin live pages are not a floor; long live pages are not a target.
5. Outline H1 and H2s (H3–H5 only when evidence needs them). Plan the SEO title as `[Service Name] | [Company Name]` with no location. H1 must restate (not repeat) that service as a close variant. You may add the campaign's service area. Word it like a Google Ads headline: relevant and compelling. Do not reuse the title’s service string unchanged with only a location or a tiny add-on (`in {service area}`, `for trees`, `Service`). Owner: `content-pipeline-pages/references/title-h1.md`. H2s carry search language. Later paragraphs are for the human.
6. List internal links that already exist in the crawl (other approved service slugs). Do not invent URLs.
7. Use the recorded `matrix_terms` list. Prefer those phrases in H1/H2/H3 when they fit, and plan them for body copy where they fit naturally. Do not invent a default list here. Terms are heading and phrasing candidates; the evidence grid still governs claims.
8. Print `Coverage: n/7` from `runs[slug].evidence_gate.score`. If `evidence_gate.result` is `waived`, add a waiver line under Omissions (`Waiver: {waived_by} on {waived_on}`).
</instructions>

<constraints>
- No body paragraphs.
- No `[IMAGE:` markers, TL;DR box, or authorship box.
- No BrandWell / On-Page.ai claims.
- No word-count target or padding instruction.
- H1 is a close variant of the SEO-title service, not `{Service Name} in {Area}`.
- Omissions and “do not invent” notes stay in this brief. They are not sentences for the visitor.
</constraints>

<output_format>
# Service page brief: {offering}

## Page
- slug
- url or catalog-only
- seed
- offering

## Evidence-coverage grid

Coverage: n/7

| Topic | Evidence status | Include / Omit / Unknown | Source note |
|-------|-----------------|--------------------------|-------------|
| What the service is | | | |
| How it is delivered | | | |
| Techniques or tools | | | |
| What the customer can expect | | | |
| Timeline | | | |
| Average cost or pricing | | | |
| FAQs | | | |

## Angle
## Outline
### H1
### H2
## Internal links
## Matrix notes
## FAQs
## Omissions (do not invent)
Waiver: {waived_by} on {waived_on} (only when evidence_gate.result is waived)
</output_format>
</prompt>
