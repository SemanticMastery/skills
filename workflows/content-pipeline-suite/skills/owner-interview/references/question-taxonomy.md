# Question taxonomy

Owner of the three question types, answer shapes, the "it depends" follow-up, the standing who-may-answer question, and the Publish? trigger list. Grid-row names come from [coverage-map.json](coverage-map.json); this file does not restate the row ↔ field map.

## Types

Every question has exactly one type.

| Type | Use | Answer set |
|------|-----|------------|
| **Describe** | Open narrative. Seeded from an Unknown field, an Open Question, or an Omissions bullet that needs a method / process / expectation. | Free text (and optional extracted `facts[]` after the owner speaks). |
| **Verify** | Test a quoted claim. Seeded from an Unverified company claim, a Conflict, a live-page / crawl claim, or a brief Omissions claim. | `true` / `partly` / `false` plus a correction when not true. The prompt quotes `claim.text` and names the **spoken** source. |
| **Publish?** | The owner's publication decision on a fact just given. Linked from a Describe or Verify via `publish_link`. | `public` / `framing-only` / `internal`. |

A Verify question always carries `claim { text, source }`. Stored source is `live page`, `dossier`, `crawl`, or a named intake file — never treated as delivery fact (R22). Owners never hear "dossier"; say **company documentation**. The voice host rewrites that word in prompts before the agent speaks.

## Answer shapes

Each question carries exactly one `answer_shape`:

- `free text`
- `choice` (choices listed in the prompt)
- `number with unit`
- `true / partly / false`

Publish? questions use `choice` with the three publication values.

## Follow-up

Every question includes one scripted `followup` for "it depends" (or equivalent hedge). The follow-up asks what it depends on. The pack generator adds this follow-up when the agent's draft omitted it. The skill never fills the hedge with an invented specific.

## Standing who-may-answer question

Company Details packs (`scope: company`) always include exactly one standing Describe question:

- **id (fixed):** `q-company-who-may-answer-describe-1`
- **pd_field:** `Open Questions`
- **grid_row:** `FAQs`
- **prompt:** name who besides the owner may answer future packs
- **Exempt** from the named-gap rule (R2). It is the only exemption.

Answers fill `who_may_answer[]` on the company record. Other records in the campaign read that list. An empty list means owner only (R29).

## Publish? trigger list

A question that could yield any of the following **must** have a `publish_link` pointing at a Publish? question (R9):

- price (range, fee, minimum, hourly, per-tree, per-job)
- brand
- product name
- credential
- tenure date
- vendor
- crew size

The pack script rejects a trigger question with no `publish_link` (`publish_link_required`). A Publish?-linked fact compiled with no decision is stored `internal` and re-asked on the next delta pack (R30).

## Order and caps

Pack order (R3): delivery → scope → customer expectation → timeline → pricing → verify items.

Caps: 15 questions per offering pack, 12 in the company-wide pack (including the standing who-may-answer question).
