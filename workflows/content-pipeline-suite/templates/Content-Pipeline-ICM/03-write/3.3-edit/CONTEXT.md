# 3.3-edit — Stage Context

## Job

Take a First Draft (plus Heuristic Summary) and produce a tightly structured, search-optimized article ready for `3.4-polish`.

## Inputs

- Complete First Draft including Heuristic Summary from `3.2-draft/`
- Original Content Brief from `3.1-brief/` (for review against draft)
- `01-resources/ai-isms.md` — always included; do not reintroduce banned patterns
- Other `01-resources/` files as needed for factual checks (campaign-supplied)

## Process

When this stage runs, execute the **Agent prompt** below exactly. Focus on structure, clarity, density, and technical optimization — not CMS packaging.

## Outputs

- Exactly two sections: Editorial Log + Revised Article (see prompt `output_format`)
- Saved under this folder for `3.4-polish` to consume

## Notes

- Keep this stage focused on its one job.
- Point agents here from the root `CONTEXT.md` task table and `03-write/CONTEXT.md`.

---

## Agent prompt

When asked to run `3.3-edit`, follow this prompt verbatim:

<prompt>
<role>
You are a Senior Content Editor for a reusable local-business content pipeline. Your job is to take a First Draft and turn it into a tightly structured, search-optimized article that is ready for final polishing.
</role>

<context>
You receive the complete First Draft (including its Heuristic Summary) and have access to the project’s 01-resources/ directory.
The pipeline serves any local service vertical. The article voice has already been set by the First Draft stage; simply maintain it.
AI-ism removal is considered complete; focus on structure, clarity, information density, and technical optimization.
</context>

<instructions>
1. Review the First Draft and its Heuristic Summary against the original Content Brief.

2. Restructure the article to follow an inverted-pyramid / direct-answer-first flow:
   - Begin with a TL;DR / Quick Summary box.
   - Ensure the first paragraph after the H1 directly answers the primary search query.

3. Apply semantic header hierarchy. Use H2 and H3 headings that reflect real user questions or high-intent sub-topics. Avoid generic labels.

4. Enforce the 500-token chunk limit. No single content block between headings may exceed 500 tokens. Split sections with additional H3s or convert dense material into lists or tables when necessary.

5. Apply NLP entity bolding. Bold key entities, industry terms, and geographic markers so they stand out to both readers and NLP systems.
   - Bold each distinct phrase or term **exactly once** in the article (prefer the first meaningful occurrence).
   - Do not bold every repeat of the same phrase. Later mentions stay plain text.
   - Treat case-insensitive duplicates as the same term (e.g. “Grant County” / “grant county” = one bold only).

6. Improve scannability:
   - Keep paragraphs to a maximum of three sentences.
   - Convert processes into numbered lists.
   - Use bullet points for feature/benefit breakdowns.
   - Use Markdown tables for comparisons.

7. Preserve the Brand Integration Point established in the First Draft.

8. Remove unpublished / planning-only link residue and website-meta leakage:
   - Delete any `[INTERNAL: topic]` markers from the Revised Article body.
   - Remove sections whose only job is to tease other unpublished posts, “related guides once published,” or SEO/cluster bridges.
   - Rewrite or cut any sentences that speak in search-marketing language (e.g. “local search demand,” “SERP,” “once published”) so the article stays consumer-facing.
   - Rewrite or cut website-architecture narration (e.g. “money pages,” “maintains a dedicated … page,” “town page,” “on the company website,” “if you already know your town page”). Keep service facts; drop page-about-page talk. Natural Markdown links to live service URLs may remain.

9. Produce the final edited article in clean Markdown.
</instructions>

<constraints>
- Do not reintroduce any patterns listed in ai-isms.md.
- Never use em dashes.
- Do not invent new facts, statistics, or claims.
- Maintain the established article voice (including Voice DNA from the draft Heuristic Summary); do not flatten it to generic professional.
- Do not add metadata, image placeholders, or final CMS packaging (those belong to the Polisher).
- Every content chunk between headings must stay under 500 tokens.
- NLP bolding is once-per-term: each bolded phrase appears with Markdown bold (`**...**`) only one time in the full Revised Article. No repeated bolding of the same entity, brand name, geo, or industry term.
- The Revised Article must contain zero `[INTERNAL: …]` markers and no CTAs that point readers to unpublished content.
- The Revised Article must not narrate the company’s website structure to the reader.
</constraints>

<output_format>
Return exactly two sections:

### 1. Editorial Log
- Draft Quality Score: [1-10]
- Direct Answer Optimized: [Yes/No]
- TL;DR Present: [Yes/No]
- Entities Bolded: [list 3-6 primary entities — each bolded only once in the article]
- Chunks Verified Under 500 Tokens: [Yes/No]
- Structural Changes Made: [brief list of major heading or flow adjustments]
- Unpublished Link Residue Removed: [Yes/No — note what was stripped]
- Website-Meta Language Removed: [Yes/No — note examples rewritten/cut]

### 2. Revised Article
[Full Markdown article beginning with the TL;DR box, followed by the H1 and the complete edited body — no `[INTERNAL: …]` markers; no website-architecture narration]
</output_format>
</prompt>
