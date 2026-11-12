# Service pages — Context

Router for campaign service-page setup and one-page produce. Blog folders under `03-write/` stay untouched.

## Project

- **Setup skill:** `pipeline-pages-init` — extract crawl vs catalog, reconcile leftovers, confirm seeds, run one Content Maxima Matrix per approved page.
- **Produce skill:** `content-pipeline-pages` — one approved page through brief → draft → edit → polish. That skill still stops after polish.
- **Later stages on this tree:** `p.5-images` (image files) and `p.6-schema` (`WebPage` with `Service` as `mainEntity`, plus published FAQs). `p.6-schema` overwrites that slug’s JSON-LD. `content-pipeline-pages` does not roll into it.
- **Manifest:** `../pipeline-pages-manifest.json`

## Task routing

| If the task is about… | Go to |
|-----------------------|-------|
| Extract / reconcile / seeds / Matrix | this file + `pipeline-pages-init` |
| Approved list + seed table (projection) | `service-pages.md` |
| Per-page Matrix workbook | `matrix/{slug}/` |
| Page brief | `p.1-brief/` |
| Page draft | `p.2-draft/` |
| Page edit | `p.3-edit/` |
| Sectioned polish | `p.4-polish/` |
| Page images | `p.5-images/` |
| Page schema | `p.6-schema/` |
| Blog produce | `../03-write/` (`content-pipeline-run` only) |

## Rules

- One service page per `content-pipeline-pages` invoke. That skill stops after polish.
- Copy stages keep `[IMAGE:` markers out of the body. No CMS push from this router.
- `p.5-images` writes the image files when the operator asks. It does not rewrite the polish body.
- `p.6-schema` runs from its own `CONTEXT.md` when the operator asks. This router does not generate JSON-LD.
- Do not write `03-write/`, `04-publish/`, or `05-archives/`.
- Copy stages honor the suite copywriting-model rules (Anthropic prohibited). Owners: `content-pipeline-run/references/{copywriting-model,gate-modes,voice-dna}.md`.
- Before each page brief: stop and ask for Algorithm Trigger Words from that page’s Matrix, or authorization to use the default high-impact list (`Count >= 40`). Use selected terms in headings/subheadings and sprinkle them through body copy when they fit. See `content-pipeline-pages/references/matrix-terms.md`.
- FAQs are optional. Ask first. If yes, DataForSEO PAA (`dataforseo-paa-queries`) before SerpAPI or Monid. See `content-pipeline-pages/references/faqs.md`.
- Visitor-facing copy reads at a 7th–8th grade level. See `content-pipeline-pages/references/reading-level.md`.
- SEO title is `[Service Name] | [Company Name]` (no location). H1 restates (does not repeat) that service as a close variant. Service area allowed. Word it like a Google Ads headline. See `content-pipeline-pages/references/title-h1.md`.
- Polish emits top-of-page (main) and bottom-of-page (FAQs), each in Markdown and `<article>` HTML. See `content-pipeline-pages/references/polish-output.md`. Do not push SiteSwarm unless asked.
