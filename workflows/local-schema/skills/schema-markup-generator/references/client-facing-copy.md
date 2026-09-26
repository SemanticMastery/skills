# Client-facing copy (no skill bleed)

JSON-LD that ships to a CMS is **public**. Search engines and the client see every `description`, `name`, and `text` string. Skill instructions, tooling names, and research-process notes stay in handoffs, CSVs `Notes`, and `field-learnings.md` — **never** in `*.jsonld`.

Incident 2026-09-17 (Best Roofing Of Virginia, Newport News): `WebPage.about` descriptions included “ContentMaxima trigger (Count 42)” and resolver swap notes. Those strings came from Step 2c / knowsabout process copy and were invalid as Schema.org `description`.

## What may appear in `*.jsonld` strings

Public, visitor-facing language only: why the entity matters to this business or city, aligned with visible page copy. Same bar as on-page body text.

## Forbidden in `*.jsonld` (any string property)

Do **not** copy these from skills, supporting docs, geo-trigger CSVs, or resolver output:

| Bleed | Examples (do not ship) |
|-------|------------------------|
| Tool / skill names | ContentMaxima, contentmaxima, knowsabout, Grokipedia (as a word in `description`), schema-markup-generator |
| Process / gates | Step 0 / 0b / 0c / 2b / 2c, Matrix, Algorithm Trigger Words, geo-trigger, Count ≥ 40, `(Count 62)` |
| Research mechanics | swapped, resolver, opensearch, wiki via override, `grok: … → 404`, Wikipedia disambiguation, “no article” |
| Agent / file talk | SKILL.md, `locations-implementation.md`, “this location page” as a schema-role phrase, “area modifier” |

`sameAs` **URLs** to Wikipedia / Wikidata / Grokipedia are allowed. The **word** “Grokipedia” (or any tool name) in `description` is not.

## Mapping rule (CSV → JSON-LD)

When copying the knowsabout **Relevance** column into `Thing.description` (or `Place.description`):

1. Use only the public sentence (why this entity belongs on the page).
2. **Strip** any trailing process clause before write (`ContentMaxima…`, `Count…`, `Swapped…`, `resolver…`).
3. If Relevance is only process text, rewrite a public sentence — do not paste the process text.
4. Leave process detail in the CSV **Notes** column and in `*-implementation.md`.

Count values and swap decisions belong in `locations-implementation.md` / `field-learnings.md`, not in the graph.

## Pre-write scan (mandatory)

Before saving any client `*.jsonld`, search the file for:

`ContentMaxima`, `contentmaxima`, `Count ≥`, `(Count `, `geo-trigger`, `swapped`, `resolver`, `opensearch`, `Step 2c`, `knowsabout`, `SKILL.md`

If any match is inside a JSON string (not a comment — JSON-LD has no comments), **fix it** before handoff.

## Related

- [contentmaxima-location-preflight.md](contentmaxima-location-preflight.md) — Count ≥ 40 stays in the implementation mention table
- knowsabout-entity-research — Relevance column must be public-safe; Notes hold resolver/swap text
