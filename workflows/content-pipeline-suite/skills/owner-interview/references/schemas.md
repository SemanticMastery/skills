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
```

Question IDs: `q-{scope}-{field-slug}-{type}-{n}`. Verify IDs append a 6-char hash of `claim.text`, so a regenerated pack keeps its IDs when the claim text is unchanged.

Standing exception: `q-company-who-may-answer-describe-1`.

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
facts[{ text, publish, review? }]
status
needs_publish_decision
skip_count
transcript_ref?            # optional; Phase 2
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
- `voice_calls[]` — optional ledger `{ call_id, pulled_at, question_ids[], unanswered_ids[] }`. Omitted when empty. Used so a repeat pull of the same call does not increment `skip_count` again.
- `voice_session_id` / `voice_url` — optional; written by `--create-link`. Status and pull read `voice_session_id`.

The Publish? decision applies to the parent question's facts. The Publish? row itself carries the owner's raw words and no facts.
