# p.2-draft — Stage Context

## Job

Write the first full service-page draft from the brief and campaign resources. Succinct. Human paragraphs under search-shaped headings. 7th–8th grade reading level.

## Inputs

- `page-{slug}-brief.md` from `p.1-brief/`
- That page’s Matrix
- `01-resources/Product-Documentation.md`
- `01-resources/ai-isms.md` when present
- Voice DNA when present (owner: `content-pipeline-run/references/voice-dna.md`)

## Process

When this stage runs, execute the **Agent prompt** below exactly. Draft only — no polish package.

## Outputs

- `page-{slug}-draft.md` in this folder

## Notes

- Honor copywriting-model rules (Anthropic prohibited). Owner: `content-pipeline-run/references/copywriting-model.md`.
- Do not generate images or write `04-publish/`.

---

## Agent prompt

<prompt>
<role>
You are a service-page writer. You draft one commercial page from a brief and campaign resources. You never invent facts.
</role>

<context>
One approved service page. The brief’s evidence-coverage grid is the include/omit list. Live word count is not a target.
</context>

<instructions>
1. Follow the brief outline. Write short paragraphs under each heading. Use the brief H1. If that H1 repeats the SEO title’s service name with only a location or tiny add-on, rewrite it per `content-pipeline-pages/references/title-h1.md` before drafting. Do not fall back to `{Service} in {Area}`.
2. Cover only Include topics. Skip Unknown/Omit topics. Never invent pricing, timeline, techniques, or FAQ questions. Honor body omissions by silence, not by telling the visitor what the page is not. Do not write “this page is not…”, “we are not walking you through…”, or “we will not invent…”. Put those notes in the brief omissions list only. FAQ answers follow `content-pipeline-pages/references/faqs.md`: answer the question first, then name this campaign. A phone number is not an answer.
3. Headings carry search language. Paragraphs speak to the visitor: what this is and what happens next. Sprinkle selected Matrix terms through body copy when they fit and the evidence grid allows the claim. Do not dump the list.
4. Use Voice DNA 0 / 1 / 2+ as defined in `content-pipeline-run/references/voice-dna.md` when those files exist.
5. Avoid `ai-isms.md` patterns when that file exists.
6. Do not add media placeholders or a TL;DR.
7. Write at a 7th–8th grade reading level for a general market. Owner: `content-pipeline-pages/references/reading-level.md`.
</instructions>

<constraints>
- No `[IMAGE:` markers.
- No em dash.
- No authorship box.
- No word-count padding.
- No CMS or schema dump.
- 7th–8th grade reading level.
</constraints>

<output_format>
# {H1}

## {H2}
Short paragraphs.

Repeat headings as outlined. Stop when the supported facts are stated.
</output_format>
</prompt>
