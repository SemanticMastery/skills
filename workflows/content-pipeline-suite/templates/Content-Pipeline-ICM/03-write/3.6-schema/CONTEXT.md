# 3.6-schema — Stage Context

## Job

Write one blog-post schema package after `3.5-images`. Read `{campaign_dir}/02-deliverables/2.4-schema/` first and reuse its graph: a `WebPage` whose `mainEntity` is the `BlogPosting`. Then follow `schema-markup-generator`. Overwrite this post’s JSON-LD when a file for the same slug is already there, so the schema matches the new content. Do not insert the script into a CMS.

## Inputs

- Images package from `3.5-images/post-{NN}-images/post-{NN}-images.md` (Technical Suite, Image Manifest, Publication Asset)
- `{campaign_dir}/02-deliverables/2.4-schema/` when it exists (`homepage.jsonld`, `blog/blogpost-*.jsonld`, `blog/homepage.jsonld`)
- Skill: `schema-markup-generator` at `schema-markup-generator/SKILL.md`

## Process

When this stage runs, execute the **Agent prompt** below exactly.

## Outputs

- `post-{NN}-schema/post-{NN}-schema.jsonld` — script-wrapped JSON-LD
- `post-{NN}-schema/post-{NN}-schema.md` — which sample was reused, which `@id`s were copied, and any omitted date or image URL
- The same JSON-LD at `{campaign_dir}/02-deliverables/2.4-schema/blog/blogpost-{slug}.jsonld` plus `blogpost-{slug}-implementation.md`. Overwrite those files when they already exist.

## Notes

- `content-pipeline-run` continues into this stage after `3.5-images`. It does not stop at images.
- This stage does not call SiteSwarm. `schema-publish-kit` owns insert after the post is live.
- Point agents here from the root `CONTEXT.md` task table and `03-write/CONTEXT.md`.

---

## Agent prompt

When asked to run `3.6-schema`, follow this prompt verbatim:

<prompt>
<role>
You write one BlogPosting schema package for a local-business blog post. You reuse the campaign’s existing schema graph when it is already on disk, and you follow schema-markup-generator for the markup rules.
</role>

<context>
The post package is `3.5-images/post-{NN}-images/post-{NN}-images.md`.
Campaign schema, when it exists, is `{campaign_dir}/02-deliverables/2.4-schema/`.
A finished blog post in that folder is a `WebPage` whose `mainEntity` is the `BlogPosting`. The `BlogPosting` points back with `mainEntityOfPage`. The same file also carries the short Corporation, local-business, author, Blog, and WebSite nodes, and a `BreadcrumbList` when the sample has one.
schema-markup-generator is `schema-markup-generator/SKILL.md`.
</context>

<instructions>
1. Read the images package. Confirm `{NN}`, the title, the meta description, the URL slug, and the publication asset. If that file is missing, stop.

2. List `{campaign_dir}/02-deliverables/2.4-schema/` before writing anything. Read `homepage.jsonld` when it is there. Read `blog/aboutpage.jsonld`. Read one existing `blog/blogpost-*.jsonld` when any exist, plus `blog/homepage.jsonld` when it is there. These files are the graph pattern. Reuse their `@id`s. Do not mint a second business. The author is the `Person` who is `mainEntity` of `blog/aboutpage.jsonld`. If that file or that Person is missing, stop. Do not invent an author.

3. A file named `blog/blogpost-{slug}.jsonld` is the previous schema for this slug. Read it, then overwrite it. A new post often has no file yet. Other posts’ files stay as they are. Use them only as the graph pattern.

4. When a blog-post sample exists:
   - Match that sample’s linking style, including `@graph` when the sample uses `@graph`. The skill’s single-root rule yields to this sample.
   - `WebPage.mainEntity` is the `BlogPosting` (an `@id` reference when the sample links that way).
   - Copy Corporation, local-business, Blog, and WebSite `@id`s from the sample and from `homepage.jsonld`. Keep the local-business `@type` the homepage already uses.
   - Copy `publisher`, `mentions`, and `isPartOf` the way the sample does.
   - `BlogPosting.author` is required. Set it to `{ "@type": "Person", "@id": "<About page Person @id>" }`. The `@id` is the `Person` who is `mainEntity` of `blog/aboutpage.jsonld`, the same author that page features. A bare `@id` with no `@type` is not enough. When the post graph includes a `Person` node, that node uses this same `@id` and `@type` `Person`. Do not invent a second person. Do not copy a sample `author` that omits `@type`.
   - Add `BreadcrumbList` only when the sample post has one.
   - Skip schema-markup-generator Steps 0b, 0c, 2b, and 2c. Those gates mint a new local-business graph. This post only references the graph that already exists.
   - Still follow the skill for the script wrapper, client-facing copy, `significantLink`, and dedicated LocalBusiness `@id`.

5. When `02-deliverables/2.4-schema/` has no schema files:
   - Read `schema-markup-generator` and follow it from Step 0, including its stop gates.
   - The file is still one `WebPage` root with the `BlogPosting` nested as `mainEntity`. Do not use `@graph`. Do not emit a bare `BlogPosting` root.
   - `BlogPosting.author` is still `{ "@type": "Person", "@id": "<About page Person @id>" }`. Stop when `blog/aboutpage.jsonld` has no Person.
   - If the skill path is missing, stop and say `schema-markup-generator` is not installed.

6. Fill the post from the images package. `headline` and `description` match the Technical Suite. `significantLink` equals the post URL. Build that URL by taking an existing blog-post URL and replacing only the slug. If no blog sample exists and no blog host is on disk, stop and ask for the blog host. Do not invent a domain.
   - `datePublished` only when the publication asset prints a published date. Otherwise omit it and say so in the note.
   - `image` / `primaryImageOfPage` only when a public image URL is already known from the sample’s host pattern or the operator. A local PNG path is not a public URL. Do not invent a CDN URL. Do not write the working `post-{NN}-img-{KK}` name into the graph. The images manifest names a public JPEG; after upload that basename is the `/media/` path, and `siteswarm-publish-kit` writes those URLs.

7. Write:
   - `3.6-schema/post-{NN}-schema/post-{NN}-schema.jsonld` (script wrapper required)
   - `3.6-schema/post-{NN}-schema/post-{NN}-schema.md` (sample path used, `@id`s copied, omitted date or image)
   - `{campaign_dir}/02-deliverables/2.4-schema/blog/blogpost-{slug}.jsonld` and `blogpost-{slug}-implementation.md` (overwrite when present)
</instructions>

<constraints>
- One post only. Overwrite this slug’s `blogpost-{slug}.jsonld` and the stage copy. Leave every other slug’s file alone.
- `BlogPosting.author` must be `{ "@type": "Person", "@id": "<the Person @id that is mainEntity of blog/aboutpage.jsonld>" }`. That is the author featured on the blog About page. Do not omit `@type`. Do not invent a different person.
- Do not invent NAP, `sameAs`, geo, reviews, dates, or image URLs.
- Do not call SiteSwarm or `update_page_json_ld`.
- Do not edit `3.5-images/` or the polish package.
- Visible strings in the JSON-LD match the publication asset. Do not copy pipeline notes into the graph.
</constraints>

<output_format>
`post-{NN}-schema.jsonld` is one `<script type="application/ld+json">` block.
The `WebPage` `mainEntity` is the `BlogPosting`.
`BlogPosting.author` is `{ "@type": "Person", "@id": "<About page Person @id>" }`.
`post-{NN}-schema.md` names the pattern file, the reused `@id`s, and anything omitted because it was not on disk.
</output_format>
</prompt>
