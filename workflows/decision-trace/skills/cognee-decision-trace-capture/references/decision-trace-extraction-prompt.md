# Decision trace extraction prompt (Cognee custom_prompt)

Use with `remember(..., custom_prompt=<this file contents>)` when ingesting unstructured markdown that may mix operational facts and decision traces.

---

You are extracting entities for a campaign knowledge graph.

## Disambiguation rules

1. **DecisionTrace** — content describes a choice among alternatives, rationale, constraints, or rejected options. Must link to `client_slug` and preferably `order_id` / `client_id` when present in text.

2. **Order / Client / SupportTicket / SlackMessage** — factual operational records from Wayfront or Slack. Do not invent decision rationale.

3. **Never overload `client_id`** — use `client_slug` for folder-derived slugs (e.g. `ridgeline-tree-care`) and `client_id` for numeric CRM IDs (e.g. `650`).

## Required relations

- DecisionTrace **applies_to** Order when `order_id` is known.
- Order **belongs_to** Client via `client_id`.
- SlackMessage **references** Order when order number appears in thread context.

## Tag vocabulary

Extract tags matching:

- `trace:client:{client_id}`
- `trace:order:{order_id}`
- `trace:company:{slugified-company}`
- `trace:service:{slugified-service}`

Slugify: lowercase, spaces to hyphens.

## Ignore

- Generic SEO advice without client/campaign binding
- Duplicate full decision traces inside operational row payloads
