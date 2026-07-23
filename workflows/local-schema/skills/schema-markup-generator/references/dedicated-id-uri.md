# Dedicated ID URI — LocalBusiness `@id` (mandatory)

When a client publishes a **dedicated ID page** (or any standalone entity URI) for the local business, that URL is the **only** canonical `@id` for the `LocalBusiness` subtype node and for **every** cross-page reference to that entity.

## When this applies

| Signal | Example |
|--------|---------|
| User or dossier specifies an ID page URL | `https://s3.amazonaws.com/slstacks/woodlawntrees/id.html` |
| Homepage `LocalBusiness` already uses an external `@id` | Same URI on the published `HomeAndConstructionBusiness` node |
| Session mandate: “ID page is the entity URI” | Use that URL everywhere — do not invent `#localbusiness` on the marketing domain |

**Default (no dedicated ID):** `https://[canonical-domain]/#localbusiness` on the homepage `LocalBusiness` node only; child pages reference that fragment URI.

## Rule (universal)

1. **Homepage `LocalBusiness` node** — set `"@id"` to the dedicated ID URI (not `[domain]/#localbusiness` when a dedicated URI exists).
2. **Service pages** — `"provider": { "@id": "[dedicated ID URI]" }` (exact match).
3. **Location / city pages (single GBP)** — `"mainEntity": { "@id": "[dedicated ID URI]" }` and first `about` entry `{ "@id": "[dedicated ID URI]" }` (exact match).
4. **Never mix** dedicated ID and `#localbusiness` on the same project unless the user explicitly requests a migration with two published nodes (rare; document in handoff).

## Where to discover the URI

| Source | Action |
|--------|--------|
| Existing `homepage.jsonld` | Read `HomeAndConstructionBusiness` / `LocalBusiness` `@id` — treat as source of truth |
| `homepage-implementation.md` or handoff | “ID page (LocalBusiness `@id`)” row |
| Dossier `[V] DIGITAL ECOSYSTEM` or user message | ID page URL in `sameAs` or stated as entity URI |
| User / Bradley in session | Record in `{project}/02-deliverables/2.4-schema/*-implementation.md` `@id` map (legacy: `resources/schema/`) |

If homepage JSON-LD and handoff disagree, **stop** and reconcile before generating service or location JSON-LD.

## `sameAs` vs `@id`

- The dedicated ID URI belongs in **`@id`** on the homepage `LocalBusiness` node.
- Also include it in **`sameAs`** on `Corporation` and `LocalBusiness` unless the user says omit (see [sameas-intake.md](sameas-intake.md)).
- Marketing site URL (`https://[domain]/`) remains `url` / `mainEntityOfPage` on the business node as appropriate — do not replace `@id` with the homepage URL when a dedicated ID exists.

## Implementation handoff

Every `*-implementation.md` for contractor sites must list:

```markdown
| Local business (canonical `@id`) | `https://…/id.html` |
```

Preflight checklist before shipping service or location files:

- [ ] `provider` / `mainEntity` / `about[0]` use the **same** dedicated ID URI as homepage `LocalBusiness.@id`
- [ ] No `[domain]/#localbusiness` references when a dedicated ID URI is in use

## Anti-patterns

| Wrong | Right |
|-------|--------|
| Service `provider` → `id.html`, location `mainEntity` → `#localbusiness` | All references → `id.html` |
| Homepage `@id` = `id.html`, child pages → `#localbusiness` “for convenience” | All references → `id.html` |
| Assume `#localbusiness` because the user said “reference local business” | Read published homepage `@id` first |

## Integration

| Doc | Role |
|-----|------|
| [silo-and-page-patterns.md](silo-and-page-patterns.md) | Service + location page patterns use `[localBusinessId]` placeholder |
| [schema-templates.md](schema-templates.md) | JSON-LD templates |
| [dossier-preflight.md](dossier-preflight.md) | Capture ID URI from dossier / homepage artifact |
| Main [SKILL.md](../SKILL.md) | Mandatory rule under LocalBusiness section |
