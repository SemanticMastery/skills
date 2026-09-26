# Page FAQs (optional)

Ask once per page, before or while writing the brief:

> Generate an FAQ block for this page from live People Also Ask?

If no: FAQs stay Omit.

If yes: pull typical questions, then write answers that **answer the question first** and name the campaign as who to call. Do not invent prices, arrival times, or methods this business has not documented.

## Tool order

1. **DataForSEO PAA** via the existing `dataforseo-paa-queries` skill (`fetch-paa.mjs`). Seed = the page’s commercial seed (or the operator’s keyword). Location = the campaign market, formatted like `City,State,United States`. Prefer `--no-expand` unless the operator asks for a deeper tree.
2. Do not call SerpAPI, Monid, or Firecrawl for the same PAA job unless DataForSEO is blocked. Then say so and offer to switch.

PAA skill note: SERP Live Advanced is REST (`DATAFORSEO_USERNAME` / `DATAFORSEO_PASSWORD`), run through context-mode `ctx_batch_execute`, not Shell.

## What to keep

- Questions that match the offering (what counts as an emergency, who to call, fallen tree, storm damage).
- Drop off-market locations, legal-advice traps, and trivia.
- Cost questions: keep them if they are typical. Answer with how pricing works (free estimate / call) plus what drives cost in general. Do not invent a number.

## Answers

An FAQ must answer the question a visitor typed. A phone number is not an answer.

**Order**

1. Answer in plain English (7th–8th grade). Use general service knowledge when the product doc does not name this business's own mix, schedule, or protocol.
2. Then name this campaign and the next step (call, free estimate, phone).

**Do**

- Answer *when / what / who / how / whether* before you sell.
- Keep business-specific claims inside the evidence grid (licensed, phone, 24/7 answering if confirmed, free estimates).
- For “best product / how often / is it necessary”: say what usually decides it (tree, soil, species, condition). Do not pick a brand, NPK, or a fixed calendar unless documented.

**Do not**

- Replace the answer with “we offer this service” or “that is why people ask.”
- Invent prices, arrival times, business-specific methods, or a product shelf.
- Narrate omissions (“we will not invent a mix”). Honor Unknown business facts by teaching the general point, then inviting a look at *their* tree.

| Fail | Pass |
|------|------|
| Root feeding is the work. Call us. | The best feed depends on the tree and the soil, not one bag for every yard. Ridgeline Tree Care will look at your tree and talk through a free estimate. Call (555) 010-4477. |
| We list it as a named service. Call for a consult. | Not every tree needs it. It helps more when the tree is stressed, the soil is poor, or roots cannot get food from the surface. Call Ridgeline Tree Care and we will start from what you see. |
| Consultations and estimates are free. Call. *(as the whole answer to “how does an arborist evaluate a tree?”)* | They look at the tree: canopy, trunk, roots, and what you are seeing. Ridgeline Tree Care starts with a tree health assessment. Call for a free estimate. |

Cost / “how much” may stay short: no number, free estimate, call. Every other question needs a real first sentence.

Brief “answer direction” notes are planning only. Draft, edit, and polish write the visitor answer. Owner for grade level: [reading-level.md](reading-level.md).

## Files

Write PAA JSON where `dataforseo-paa-queries` already writes:

`{campaign}/01-intake/1.2-audit/paa-queries/paa-{keyword-slug}-{YYYY-MM-DD}.json`

Cite that path from the page brief. Do not invent a second FAQ tree.
