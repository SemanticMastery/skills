# 01 — Gates

A gate is a stop with one way through. Tell the skill to continue past a gate and it will either refuse or write fiction about the business. Let it stop.

## Copy model

Ask this on the first run, in the same turn as gate mode, when the run manifest has no `copywriting_model`.

| Choice | What you tell it | What it does |
|---|---|---|
| Inherit | This chat is already Grok 4.6 or ChatGPT-5.6 Terra | Writes copy in this chat |
| Pin | `cursor-grok-4.6-high-fast` or `gpt-5.6-terra-medium` | Writes copy in this chat on that model |
| External | You name the model and the other app | Stops after the slot is chosen and hands you brief through polish. Images and schema resume here after polish exists |

Anthropic is refused for brief, draft, edit, and polish. That includes Claude, Sonnet, Opus, and Haiku, and it includes **inherit when this chat is Claude**. Switch the chat, or pin a non-Anthropic id. Images ignore the copy pin. Schema follows the schema stage prompt.

You can orchestrate on another model. The refusal is the stages that write client-facing prose.

## Gate mode

Persist `gate_mode` on the run manifest. `review` or `auto`.

| Mode | Behavior |
|---|---|
| `review` | After every produce stage, stop and wait for OK, approve, proceed, or a revise. Recommended on a new campaign. |
| `auto` | Chain brief through schema for **this one slot**. Stop on a missing input, an error, or schema complete. |

`auto` does not skip the question when two Voice DNA files exist. It does not approve photos. It does not start a second post.

Change mode mid-run with `advance-run.mjs --set-gate-mode`. That affects later stages only.

## Keyword gate (init)

If Matrix, Personas, People Also Ask, or fanout is missing, init stops and asks you for:

- **keywords** — seed terms for Content Maxima and fanout
- **location** — city, region, or country, when PAA is missing

It will not read keywords out of the dossier, the campaign context, or an audit. Resume in the same session after you supply them.

## Paid calls (init)

| Action | Clear it by |
|---|---|
| Business dossier compose | Say yes after the dry-run. It spends a Grok compose. |
| DataForSEO on-page crawl | Say yes. It needs the dossier domain first. |
| DataForSEO PAA and fanout | Keywords, plus location for PAA. Spend follows those skills. |
| Content Maxima Matrix and Personas | Keywords, and your Content Maxima login. |

Init dispatches a companion only for a **missing** class. A class that already has a non-empty file is skipped.

## Horizon (init)

The roadmap is 13 weeks (39 posts) or 26 weeks (78 posts). Init asks. It does not pick. First campaign: choose 13.

## Init complete

`status: init_complete` requires all of these:

- eight resource classes present as real files in `01-resources/`
- `01-resources/ai-isms.md`
- `02-plan/editorial-roadmap.md`
- `02-plan/siteswarm-tag-taxonomy.md`

Anything short of that stays `init_partial`, `awaiting_horizon`, `awaiting_plan`, or `awaiting_taxonomy`. Photo classify stops without the taxonomy. The run stops without the roadmap or the taxonomy.

## One slot

Run produces the post you named, through schema, then stops. The next row is another invoke. Do not ask it to write the whole roadmap in one session.

## Accounts, when you reach them

| Step | Account or key |
|---|---|
| Dossier compose | The compose approval in chat |
| On-page, PAA, fanout | DataForSEO |
| Matrix, Personas | Content Maxima |
| Photo classify | `GEMINI_API_KEY` (default model `gemini-2.5-flash`) |
| Image miss at 3.5 | `FAL_AI_API_KEY` or `FAL_KEY` |
| Expert series and voice link | The suite voice host, on your Cloudflare account |

You can hand-place a finished research file and skip that companion. Init only checks the file.
