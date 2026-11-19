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
- SiteSwarm post URL pattern: `{blog-host}/blog/{post-slug}`. Example: `https://blog.example.com/blog/welcome-to-the-blog`. Keep the `/blog/` segment. Do not put the slug at the host root.

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
A finished blog post is one `WebPage`. Nest the `BlogPosting` on `mainEntity` with no `@id`, no `url`, no `description`, no `mainEntityOfPage`, and no `isPartOf`. An `@id` on the article makes the validator list a second CreativeWork. `isPartOf` pointing at the Blog `@id` is worse: that Blog node is not in this file, and `isPartOf` expects a CreativeWork, so the validator invents a CreativeWork that is not attached to the page. Nest one `ImageObject` on `primaryImageOfPage` with no `@id`. `BlogPosting.image` is that same URL string, not a second `ImageObject`. The logo is a URL string, not an `ImageObject`. Nest the `Corporation` once on `isPartOf.publisher`. `parentOrganization` is `{ "@id": "<that Corporation @id>" }` only. Do not use `@graph`. Do not emit a second script or a bare `BlogPosting` root.
schema-markup-generator is `schema-markup-generator/SKILL.md`.
</context>

<instructions>
1. Read the images package. Confirm `{NN}`, the title, the meta description, the URL slug, and the publication asset. If that file is missing, stop.

2. List `{campaign_dir}/02-deliverables/2.4-schema/` before writing anything. Read `homepage.jsonld` when it is there. Read `blog/aboutpage.jsonld`. Read one existing `blog/blogpost-*.jsonld` when any exist, plus `blog/homepage.jsonld` when it is there. These files are the graph pattern. Reuse their `@id`s. Do not mint a second business. The author is the `Person` who is `mainEntity` of `blog/aboutpage.jsonld`. If that file or that Person is missing, stop. Do not invent an author.

3. A file named `blog/blogpost-{slug}.jsonld` is the previous schema for this slug. Read it, then overwrite it. A new post often has no file yet. Other posts’ files stay as they are. Use them only as the graph pattern.

4. One `WebPage` root. Do not copy an `@graph` from an older sample.
   - Nest the `BlogPosting` on `WebPage.mainEntity` only. Give it no `@id`, no `url`, no `mainEntityOfPage`, and no `isPartOf`. Do not list it in `about`.
   - Nest one `ImageObject` on `primaryImageOfPage` with no `@id`. `BlogPosting.image` is that image URL as a string. The logo is a URL string.
   - Copy Corporation, local-business, Blog, and WebSite `@id`s from `homepage.jsonld` and the blog pages. Keep the local-business `@type` the homepage already uses. Reference them. Do not paste a second full copy of a node that is already nested in this file.
   - `BlogPosting.author` is required. Set it to `{ "@type": "Person", "@id": "<About page Person @id>" }`. The `@id` is the `Person` who is `mainEntity` of `blog/aboutpage.jsonld`, the same author that page features. A bare `@id` with no `@type` is not enough. When the post graph includes a `Person` node, that node uses this same `@id` and `@type` `Person`. Do not invent a second person. Do not copy a sample `author` that omits `@type`.
   - Add `BreadcrumbList` only when the sample post has one.
   - Skip schema-markup-generator Steps 0b, 0c, 2b, and 2c. Those gates mint a new local-business graph. This post only references the graph that already exists.
   - Still follow the skill for the script wrapper, client-facing copy, `significantLink`, and dedicated LocalBusiness `@id`.

5. When `02-deliverables/2.4-schema/` has no schema files:
   - Read `schema-markup-generator` and follow it from Step 0, including its stop gates.
   - The file is still one `WebPage` root. Nest the `BlogPosting` on `mainEntity`. Do not use `@graph`. Do not emit a bare `BlogPosting` root. Do not give the `BlogPosting` the page `url`.
   - `BlogPosting.author` is still `{ "@type": "Person", "@id": "<About page Person @id>" }`. Stop when `blog/aboutpage.jsonld` has no Person.
   - If the skill path is missing, stop and say `schema-markup-generator` is not installed.

6. Fill the post from the images package. `WebPage.name` and `BlogPosting.headline` match the Technical Suite title. `WebPage.description` matches the Technical Suite meta description. Do not copy that description onto the `BlogPosting`. `significantLink` equals `WebPage.url`. SiteSwarm blog posts use `{blog-host}/blog/{post-slug}`. `{blog-host}` is the production blog origin, for example `https://blog.example.com`. Example: `https://blog.example.com/blog/welcome-to-the-blog`. Replace only `{post-slug}`. Keep the `/blog/` segment. Do not put the slug at the host root, and do not invent a domain.
   - `datePublished` only when the publication asset prints a published date, or when this post is already live and `published_at` is known. Otherwise omit it and say so in the note.
   - Nest one `ImageObject` on `primaryImageOfPage` only when a public image URL is already known. `BlogPosting.image` references that `@id`. A local PNG path is not a public URL. Do not invent a CDN URL. Do not write the working `post-{NN}-img-{KK}` name into the graph. The images manifest names a public JPEG; after upload that basename is the `/media/` path, and `siteswarm-publish-kit` writes those URLs.

7. Write:
   - `3.6-schema/post-{NN}-schema/post-{NN}-schema.jsonld` (script wrapper required)
   - `3.6-schema/post-{NN}-schema/post-{NN}-schema.md` (sample path used, `@id`s copied, omitted date or image)
   - `{campaign_dir}/02-deliverables/2.4-schema/blog/blogpost-{slug}.jsonld` and `blogpost-{slug}-implementation.md` (overwrite when present)
</instructions>

<constraints>
- One post only. Overwrite this slug’s `blogpost-{slug}.jsonld` and the stage copy. Leave every other slug’s file alone.
- One JSON-LD script. One root, and that root is the `WebPage`. No `@graph`. The `BlogPosting` does not carry the page `url` or a second copy of the description. The image node appears once.
- `BlogPosting.author` must be `{ "@type": "Person", "@id": "<the Person @id that is mainEntity of blog/aboutpage.jsonld>" }`. That is the author featured on the blog About page. Do not omit `@type`. Do not invent a different person.
- Do not invent NAP, `sameAs`, geo, reviews, dates, or image URLs.
- Do not call SiteSwarm or `update_page_json_ld`.
- Do not edit `3.5-images/` or the polish package.
- Visible strings in the JSON-LD match the publication asset. Do not copy pipeline notes into the graph.
</constraints>

<output_format>
`post-{NN}-schema.jsonld` is one `<script type="application/ld+json">` block with one `WebPage` root.
The `BlogPosting` is nested on `mainEntity` and has no `@id`. It is not a second item.
The image is one `ImageObject` on `primaryImageOfPage`, also with no `@id`. `BlogPosting.image` is that URL string.
`BlogPosting.author` is `{ "@type": "Person", "@id": "<About page Person @id>" }`.
`post-{NN}-schema.md` names the pattern file, the reused `@id`s, and anything omitted because it was not on disk.
</output_format>
</prompt>
