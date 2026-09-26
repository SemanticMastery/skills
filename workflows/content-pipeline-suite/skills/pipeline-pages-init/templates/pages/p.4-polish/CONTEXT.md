# p.4-polish — Stage Context

## Job

Turn the edited page into a two-zone polish package for page-builder paste (SiteSwarm top-of-page and bottom-of-page). Each zone in Markdown and in `<article>` HTML. Stop after this file. No images. No CMS push unless the operator asks.

## Inputs

- `page-{slug}-edit.md` from `p.3-edit/`
- Live URL slug when the page exists (keep the existing path)
- Company name and service name for the SEO title
- Optional photo library: `01-resources/image-library/approved/` + `library-manifest.json` (`approved_tags`)
- `01-resources/ai-isms.md` when present
- `content-pipeline-pages/references/{title-h1,polish-output,reading-level}.md`

## Process

When this stage runs, execute the **Agent prompt** below exactly.

## Outputs

- `page-{slug}-polish/page-{slug}-polish.md` (nested because polish is a package)

## Notes

- Image suggestions are a list of types + library pointers only. Never `[IMAGE:` markers in the body.
- SEO title and H1 follow `title-h1.md`. Zones follow `polish-output.md`.

---

## Agent prompt

<prompt>
<role>
You are preparing one service page for a human to paste into a page builder. You do not generate images. You do not push a CMS unless asked.
</role>

<context>
Final polish for one approved slug. Two builder zones: top of page (main copy) and bottom of page (FAQs). Each zone in Markdown and in article HTML. Media stays out of the body.
</context>

<instructions>
1. Write `I. TECHNICAL SUITE`: SEO title, meta description, URL slug (existing live path when the page exists), H1, internal links used. SEO title is exactly `[Service Name] | [Company Name]` with no location. H1 must restate (not repeat) that service as a close variant. You may add the service area. Word it like a Google Ads headline: relevant and compelling. Do not reuse the title’s service string with only a location or tiny add-on. Owner: `content-pipeline-pages/references/title-h1.md`.
2. Write `II. TOP OF PAGE`: main copy only. No FAQs. Emit **Markdown**, then **HTML** (`<article>` body only). Open with the human H1.
3. Write `III. BOTTOM OF PAGE`: FAQs only. Emit **Markdown**, then **HTML** (`<article>` body only). If FAQs were Omit, write `Omit. No FAQ block.` in both formats.
4. Write `IV. IMAGE SUGGESTIONS`: image types only. If `library-manifest.json` exists, point at files under `01-resources/image-library/approved/` whose `approved_tags` match. Do not insert those files into the body.
5. Final `ai-isms.md` pass. No em dash. No invented pricing. No full HTML page.
6. Body, H1, FAQs, and meta description stay at a 7th–8th grade reading level. SEO title follows title-h1, not grade-level prose. Owners: `reading-level.md`, `polish-output.md`.
</instructions>

<constraints>
- Forbidden in the body: `[IMAGE:`, TL;DR box, authorship box, em dash, `<html>`, `<head>`, `<body>`.
- 7th–8th grade reading level on visitor-facing copy.
- Do not write `03-write/`, `04-publish/`, or `05-archives/`.
- Do not call Fal or SiteSwarm unless the operator asks.
</constraints>

<output_format>
# I. TECHNICAL SUITE

- SEO title: [Service Name] | [Company Name]
- Meta description:
- URL slug:
- H1:
- Internal links used:

# II. TOP OF PAGE

Paste into the top-of-page content area. Main copy only. No FAQs.

## Markdown

# {human H1}

## {H2}
Short paragraphs.

## HTML

<article>
  <h1>{human H1}</h1>
  <h2>{H2}</h2>
  <p>Short paragraphs.</p>
</article>

# III. BOTTOM OF PAGE

Paste into the bottom-of-page content area. FAQs only.

## Markdown

## Frequently asked questions

### {Question}

Answer.

## HTML

<article>
  <h2>Frequently asked questions</h2>
  <h3>{Question}</h3>
  <p>Answer.</p>
</article>

# IV. IMAGE SUGGESTIONS

- Type:
- Library pointer (if any):
</output_format>
</prompt>
