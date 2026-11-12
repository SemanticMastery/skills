# p.6-schema — Stage Context

## Job

Write one service-page schema package after `p.5-images` when that stage has run, or after `p.4-polish` when images were skipped. Read `{campaign_dir}/02-deliverables/2.4-schema/` first and reuse its graph: a `WebPage` whose `mainEntity` is the `Service`. Include FAQ markup for the FAQs that page actually publishes. Then follow `schema-markup-generator`. Overwrite this slug’s JSON-LD when a file is already there, so the schema matches the new page. Do not insert the script into a CMS.

## Inputs

- Polish package from `p.4-polish/page-{slug}-polish/page-{slug}-polish.md` (Technical Suite, top of page, bottom of page)
- Images package from `p.5-images/page-{slug}-images/page-{slug}-images.md` when it exists
- `{campaign_dir}/02-deliverables/2.4-schema/` when it exists (`homepage.jsonld`, `services/service-*.jsonld`, `knowsabout/{slug}-knowsabout.csv`)
- Skill: `schema-markup-generator` at `schema-markup-generator/SKILL.md`

## Process

When this stage runs, execute the **Agent prompt** below exactly.

## Outputs

- `page-{slug}-schema/page-{slug}-schema.jsonld` — script-wrapped JSON-LD
- `page-{slug}-schema/page-{slug}-schema.md` — which sample was reused, which `@id`s were copied, and whether FAQs were included or omitted
- The same JSON-LD at `{campaign_dir}/02-deliverables/2.4-schema/services/service-{slug}.jsonld`. Overwrite that file when it already exists, and replace this slug’s paragraph in `services-implementation.md`.

## Notes

- `content-pipeline-pages` still stops after polish unless the operator asks for this stage.
- This stage does not call SiteSwarm.
- Point agents here from `06-pages/CONTEXT.md`.

---

## Agent prompt

When asked to run `p.6-schema`, follow this prompt verbatim:

<prompt>
<role>
You write one service-page schema package. You reuse the campaign’s existing schema graph when it is already on disk, and you follow schema-markup-generator for the markup rules. The page type is WebPage. Its mainEntity is the Service. Published FAQs on that page get FAQ markup in the same file.
</role>

<context>
The page package is `p.4-polish/page-{slug}-polish/page-{slug}-polish.md`.
FAQs are section III. BOTTOM OF PAGE. `Omit. No FAQ block.` means this page has no FAQs.
Campaign schema, when it exists, is `{campaign_dir}/02-deliverables/2.4-schema/`.
An existing service file is a `WebPage` whose `mainEntity` is the `Service`. `provider` uses the same local-business `@id` as `homepage.jsonld`.
schema-markup-generator is `schema-markup-generator/SKILL.md`.
</context>

<instructions>
1. Read the polish package. Confirm the slug, SEO title, meta description, URL slug, H1, and section III. If the polish file is missing, stop. Read the images manifest when `p.5-images/page-{slug}-images/page-{slug}-images.md` exists. Do not require images.

2. List `{campaign_dir}/02-deliverables/2.4-schema/` before writing anything. Read `homepage.jsonld` when it is there. Read one existing `services/service-*.jsonld` when any exist. Read `knowsabout/{slug}-knowsabout.csv` when that slug has one. These files are the graph pattern. Reuse their `@id`s. Do not mint a second business.

3. A file named `services/service-{slug}.jsonld` is the previous schema for this page. Read it, then overwrite it. Other service files stay as they are. Use one of them only as the graph pattern.

4. When a service sample exists:
   - Match that sample’s linking style, including `@graph` when the sample uses `@graph`. The skill’s single-root rule yields to this sample.
   - `WebPage.mainEntity` is the `Service` (an `@id` reference when the sample links that way).
   - `Service.provider` is the same local-business `@id` and `@type` as `homepage.jsonld`.
   - Copy `isPartOf` and `areaServed` the way the sample does only when this page’s polish supports that same service area. Do not copy cities the polish does not serve.
   - `WebPage.about` topic entities come only from this slug’s `knowsabout` CSV. If that CSV is missing, omit new `about` Things and say so. Do not stop the stage for knowsabout when a service sample already exists.
   - Skip schema-markup-generator Steps 0b, 0c, 2b, and 2c. Those gates mint a new local-business graph.
   - Still follow the skill for the script wrapper, client-facing copy, `significantLink`, dedicated LocalBusiness `@id`, and `addressCountry` only on `PostalAddress`.

5. When `02-deliverables/2.4-schema/` has no schema files:
   - Read `schema-markup-generator` and follow it from Step 0, including its stop gates. Step 2b still applies: stop for a missing knowsabout CSV instead of inventing `about` entities.
   - The file is still one `WebPage` root with the full `Service` nested as `mainEntity`. Do not use `@graph`.
   - If the skill path is missing, stop and say `schema-markup-generator` is not installed.

6. Blog-post author rule, stated here so both schema stages carry it. This service page does not emit a `BlogPosting` or an `author`. Blog postings are `03-write/3.6-schema`. A `BlogPosting` there must set `author` to `{ "@type": "Person", "@id": "<the Person @id that is mainEntity of blog/aboutpage.jsonld>" }`. That Person is the author featured on the blog About page. A bare `@id` with no `@type` is not enough. Do not invent a second person.

7. FAQs. Read section III. If it says `Omit. No FAQ block.` or has no question, add no FAQ node. Otherwise add an `FAQPage` in the same file:
   - One `Question` per visible question. `name` is the question. `acceptedAnswer.text` is the answer. Copy the published words. Do not add a question that is not in section III.
   - When the file uses `@graph`, the `FAQPage` is another node and `WebPage.hasPart` points at its `@id`.
   - When the file is a single `WebPage` root, nest that `FAQPage` on `hasPart`.
   - `mainEntity` stays the `Service`. Do not replace it with the `FAQPage`.

8. `significantLink` equals the page URL. Build the host from an existing service file or from `homepage.jsonld`. If neither exists, stop and ask for the host. Do not invent a domain.
   - `image` only when a public image URL is already known. A local PNG path is not a public URL.

9. Write:
   - `p.6-schema/page-{slug}-schema/page-{slug}-schema.jsonld` (script wrapper required)
   - `p.6-schema/page-{slug}-schema/page-{slug}-schema.md` (sample path, `@id`s copied, FAQ included or omitted)
   - `{campaign_dir}/02-deliverables/2.4-schema/services/service-{slug}.jsonld` (overwrite when present) and replace this slug’s paragraph in `services-implementation.md`
</instructions>

<constraints>
- One slug only. Overwrite this slug’s `service-{slug}.jsonld` and the stage copy. Leave every other slug’s file alone.
- Blog postings are not this file. A `BlogPosting` `author` must be `{ "@type": "Person", "@id": "<the Person @id that is mainEntity of blog/aboutpage.jsonld>" }`, the author featured on the blog About page. Do not omit `@type`. Do not invent a different person.
- Do not invent NAP, `sameAs`, geo, reviews, prices, FAQs, or image URLs.
- Do not call SiteSwarm.
- Do not edit `p.4-polish/` or `p.5-images/`.
- Do not write `03-write/`, `04-publish/`, or `05-archives/`.
- Visible strings in the JSON-LD match the polish package.
</constraints>

<output_format>
`page-{slug}-schema.jsonld` is one `<script type="application/ld+json">` block.
The `WebPage` `mainEntity` is the `Service`.
Published FAQs are an `FAQPage` in that same file. An omitted FAQ block adds no FAQ node.
`page-{slug}-schema.md` names the pattern file, the reused `@id`s, and whether FAQs were included.
</output_format>
</prompt>
