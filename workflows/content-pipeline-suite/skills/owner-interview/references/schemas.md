# Pack and record schemas

Frozen for Phase 2. JSON is authoritative; markdown is a render. Filenames: `{Company-Slug}-owner-interview-{scope}-{YYYY-MM-DD}.{json,md}` in `{campaign}/01-intake/1.1-docs/interviews/owner/`, `scope` = offering slug or `company`. Lists also accept a legacy flat copy in `1.1-docs/`.

## Question

```
id
type
pd_field
grid_row
prompt
answer_shape
followup
claim { text, source }     # Verify only
publish_link               # id of the Publish? question
conflict?                  # optional; text naming the PD Conflicts and Verification Needs item(s) this question resolves
```

Question IDs: `q-{scope}-{field-slug}-{type}-{n}`. Verify IDs append a 6-char hash of `claim.text`, so a regenerated pack keeps its IDs when the claim text is unchanged.

Standing exception: `q-company-who-may-answer-describe-1`.

`conflict` (a string or an array of strings) links a question to a Conflicts and Verification Needs item. Compile clears a conflict item only through a real link: the question's `claim.text`, or `conflict`. Each link text names an item when the item contains it, or contains all of its words (case and punctuation ignored). The question's prompt and the owner's answer never link, so an answer that merely mentions "license" does not clear the license conflict. Use `conflict` on a Describe question seeded from a conflict; a Verify seeded from one already carries the claim.

`type` ∈ `describe` | `verify` | `publish`.
`answer_shape` ∈ `free text` | `choice` | `number with unit` | `true / partly / false`.

## Record header

```
campaign
scope
pack_file
opened
state
source_id
who_may_answer[]
voice_calls[]?             # Phase 2 amendment; omitted when empty
```

`who_may_answer[]` is filled only on the company record and read by every other record in the campaign.

`state` ∈ `open` | `captured` | `compiled` | `superseded`.

`--add-answer` and `--mark-unanswered` move `open → captured` on the first write. `--set-source-id` moves `captured → compiled`. A second `--create` for the same scope marks the first `superseded`.

The Source Ledger `File` column cites the `.md` basename; the `.json` shares the stem.

## Record answers[]

```
question_id
answered_by
role
authorized
date
channel
raw
facts[{ text, publish, publish_source?, publish_set_by?, publish_set_on?, review? }]
status
needs_publish_decision
skip_count
transcript_ref?            # optional; Phase 2
review?                    # optional; owner words on a Publish? answer (see "Owner words on a Publish? answer")
```

`status` ∈ `answered` | `unanswered` | `declined`.
`channel` ∈ `call-notes` | `form` | `chat` | `voice`.
`publish` ∈ `public` | `framing-only` | `internal`.

`facts[]` is per answer: a Describe answer often yields several facts with different publication decisions. The skill never auto-extracts a fact the owner did not say; a number that was not asked for stays in `raw` only.

## Example pack (excerpt)

```json
{
  "campaign": "Ridgeline-Tree-Care",
  "scope": "deep-root-fertilization",
  "opened": "2026-09-12",
  "questions": [
    {
      "id": "q-deep-root-fertilization-delivery-process-describe-1",
      "type": "describe",
      "pd_field": "Delivery Process",
      "grid_row": "How it is delivered",
      "prompt": "Walk me through a fertilization visit from arrival to leaving.",
      "answer_shape": "free text",
      "followup": "If it depends, what does it depend on?"
    },
    {
      "id": "q-deep-root-fertilization-delivery-process-verify-1-a1b2c3",
      "type": "verify",
      "pd_field": "Delivery Process",
      "grid_row": "How it is delivered",
      "prompt": "Your live page says \"Custom Nutrient Formula → High-Pressure Root Injection\". True, partly, or not how you work?",
      "answer_shape": "true / partly / false",
      "followup": "If it depends, what does it depend on?",
      "claim": {
        "text": "Custom Nutrient Formula → High-Pressure Root Injection",
        "source": "live page"
      }
    },
    {
      "id": "q-deep-root-fertilization-delivery-process-describe-2",
      "type": "describe",
      "pd_field": "Delivery Process",
      "grid_row": "Techniques or tools",
      "prompt": "What rig or equipment do you use, and may we name the brand?",
      "answer_shape": "free text",
      "followup": "If it depends, what does it depend on?",
      "publish_link": "q-deep-root-fertilization-delivery-process-publish-1"
    },
    {
      "id": "q-deep-root-fertilization-delivery-process-publish-1",
      "type": "publish",
      "pd_field": "Delivery Process",
      "grid_row": "Techniques or tools",
      "prompt": "May we publish the rig or brand you just named? public, framing-only, or internal?",
      "answer_shape": "choice",
      "followup": "If it depends, which part may be public?"
    }
  ]
}
```

## Example record (excerpt)

```json
{
  "campaign": "Ridgeline-Tree-Care",
  "scope": "deep-root-fertilization",
  "pack_file": "Ridgeline-Tree-Care-owner-interview-deep-root-fertilization-2026-09-12.md",
  "opened": "2026-09-12",
  "state": "open",
  "source_id": null,
  "who_may_answer": [],
  "answers": [
    {
      "question_id": "q-deep-root-fertilization-delivery-process-describe-1",
      "answered_by": "Jordan Hale",
      "role": "owner",
      "authorized": true,
      "date": "2026-09-12",
      "channel": "voice",
      "raw": "We walk the trees, inject, and leave watering notes.",
      "facts": [
        { "text": "Visit is walk, inject, watering notes.", "publish": "public" }
      ],
      "status": "answered",
      "needs_publish_decision": false,
      "skip_count": 0,
      "transcript_ref": null
    }
  ]
}
```

`channel` includes `voice`. `transcript_ref` is optional and unused in Phase 1.

## Phase 2 amendment

Two additive fields. Phase 1 records stay valid: a re-save omits both keys when they are empty.

- `facts[].review` — optional `{ reason, tokens[] }`. Present only when quote-grounding failed. Compile refuses any fact that still carries `review`. The render shows `[REVIEW: token, …]` on that fact line.

  Grounding (`lib/grounding.mjs`) checks that numbers, credentials, product names, brand names, and method verbs in a fact appear in the owner's words. Both sides are lemmatized: a method verb in a fact (inject, apply, prune, grind, treat, fertilize, spray, cut, remove, climb, chip, cable, brace, plant, water) is grounded by any form of it in speech, including derived forms ("grinding", "grinder", "removal", "injection", "cabling"). A plural or possessive of a name agrees with its singular ("grass" and "grasses"). A capitalized word that opens a sentence is a brand candidate only when it is not a common word (a determiner, question word, or adverb such as "Those", "What", "Sometimes", or a plural, -ing, -ly, or -ed form of five letters or more). A brand that opens a sentence ("Vermeer machines...") and an invented number or method are still flagged. "stump" is a noun here, not a method verb.
- `voice_calls[]` — optional ledger `{ call_id, pulled_at, question_ids[], unanswered_ids[] }`. Omitted when empty. Used so a repeat pull of the same call does not increment `skip_count` again.
- `voice_session_id` / `voice_url` — optional; written by `--create-link`. Status and pull read `voice_session_id`.

The Publish? decision applies to the parent question's facts. The Publish? row itself carries the owner's raw words and no facts.

## Owner words on a Publish? answer

A Publish? row carries no facts, so anything the owner says there beyond the decision would never reach a fact or the Product-Documentation. On a voice pull, `lib/publish-words.mjs` removes the decision words and conversational filler from the row's raw; when three or more distinct words remain, the row gets an answer-level flag:

```json
"review": { "reason": "owner_words_on_publish", "tokens": ["needs", "correcting", "certification"] }
```

`tokens` is at most 12 of those words; the full words stay in `raw`. A bare decision ("Public.", "Yes, you can make that public.") is never flagged. The flag:

- is listed by `--list-flagged` with `fact_index: null` and the owner's words as `text`;
- is written under `## Unmapped notes` in the record `.md`, with the question id, the date, and the words;
- makes compile refuse with `review_pending` for that question id until it is cleared;
- is cleared with `--review --question-id <publish-id> --clear` (no `--fact`). Clearing keeps `raw`.

A new answer to the same question replaces the flag; it does not inherit the old one. A skipped question from a voice pull is dated with the call date (`date` on the `unanswered` row), so Open Questions say `asked on` that day.

## Publish decisions amendment

Three optional keys on `facts[]`. A record without them stays valid: a re-save omits them when empty, and the render shows nothing extra.

- `publish_source` — who decided `publish`. `default`: the fact came from a Describe question with no Publish? link and took the default policy. `operator`: `interview-record.mjs --set-publish` set it. (`spoken` and `tap` are accepted and kept if present, but the skill does not write them.) Absent means the owner's own Publish? answer, an explicit `publish` in `--add-answer`, or a record from before these keys.
- `publish_set_by` — the name given with `--by`. Written with `operator`.
- `publish_set_on` — `YYYY-MM-DD` (UTC). Written with `operator`.

Key order on a fact is `text`, `publish`, `publish_source`, `publish_set_by`, `publish_set_on`, `review`. The record `.md` appends `(publish default)` or `(publish set by NAME on DATE)` to the fact line. The compile plan adds `- publish_source: default` or `- publish_source: operator` to the hunk item, except when the answer is not authorized (forced `internal`).

**Default policy** (`scripts/lib/publish-default.mjs`). It applies per fact to a Describe question with no `publish_link`, except the who-may-answer question. The fact is `public` only when it is plain description; otherwise `internal` until an operator decides. Held `internal`: any digit, currency symbol, `%`, or framing-lint hit; a spelled-out number; credential, insurance, or guarantee wording; a capitalized word that is not the first word of its sentence (a name, place, brand, or acronym), apart from "I". A name that is the first word of a sentence is not detected. Verify questions, Publish?-linked Describe questions, and facts with an explicit `publish` never take the default.

`needs_publish_decision` is true when a fact arrived with no usable `publish`, or the default held it `internal`. `--set-publish` clears it once no untouched fact in the answer is still held `internal`.
