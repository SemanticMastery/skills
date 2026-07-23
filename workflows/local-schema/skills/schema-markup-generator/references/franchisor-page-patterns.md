# Franchisor site page patterns

Use when the client is a **franchisor** (sells franchise opportunities and systems support) rather than a **field-trade contractor** performing installation/repair at the HQ address. Complements [silo-and-page-patterns.md](silo-and-page-patterns.md) (contractor-default rules).

**Reference implementation:** Landscape Lighting Franchise, LLC — `Landscape Lighting Franchise` campaign folder.

---

## Detect franchisor vs contractor

| Signal | Franchisor | Field contractor |
|--------|------------|------------------|
| Primary revenue | Franchise fees / royalties; B2B to franchise buyers | Consumer/commercial jobs at service area |
| HQ entity role | Corporate HQ, training, marketing support | Shop that dispatches crews |
| Homepage copy | “Own a franchise”, franchisee support, territories | “We install/repair…”, service area cities |
| `LocalBusiness` subtype | Plain **`LocalBusiness`** | Trade subtype when accurate (`Plumber`, `HomeAndConstructionBusiness`, etc.) |

**Do not** use `HomeAndConstructionBusiness` on a franchisor HQ simply because franchisees work in construction-adjacent trades.

---

## Homepage (franchisor, single location HQ)

`@graph`: **`Corporation`** `#corporation` + **`LocalBusiness`** `#localbusiness` (no trade subtype).

| Node | Holds |
|------|--------|
| `Corporation` | `legalName`, `founder`, `logo`, `sameAs`, franchise-brand description |
| `LocalBusiness` | NAP, hours, `geo`, `areaServed`, franchisor-facing description (lead with franchise **support**, not field install) |

**`knowsAbout`:** Optional curated `Thing` list on **`#localbusiness`** only (e.g. digital marketing, lead generation, franchising, CRM). Use for site-wide franchisor expertise — not field-trade topics unless verified.

Deploy homepage `@graph` **site-wide** so cross-page `@id` references resolve.

---

## `Service` pages — two franchisor flavors

Both use **`WebPage`** + **`Service`** (Simple Silo — no `BreadcrumbList`). Step 2b entity CSV required for `WebPage.about` topic entities.

### A. Franchise opportunity page (offering being sold)

**Example slugs:** `/franchise-opportunity/`, `/own-a-franchise/`

| Field | Value |
|-------|--------|
| `Service.name` | Match H1 (e.g. “Franchise Opportunity”) |
| `Service.serviceType` | `"Franchise Opportunity"` or `"Business Franchising"` |
| **`Service.provider`** | **`#corporation`** (franchisor sells the opportunity) |
| `WebPage.about` | Franchising-topic CSV (entrepreneurship, business model, landscape lighting industry, etc.) |
| `offers` / price | **Omit** unless investment amounts are visible on **this** URL |

### B. Operational support page (what franchisees receive)

**Example slugs:** `/lead-generation-marketing/`, `/training/`, `/ongoing-support/`

| Field | Value |
|-------|--------|
| `Service.name` | Support offering (e.g. “Lead Generation & Marketing”) |
| **`Service.provider`** | **`#localbusiness`** (or dedicated ID URI) — same as contractor service pages |
| `WebPage.about` | Topic CSV aligned to support area (digital marketing, training, etc.) |

**Decision rule:** If the page sells **becoming a franchisee** → provider `#corporation`. If the page describes **support included in the system** → provider `#localbusiness`.

---

## About page (`AboutPage`)

**Example:** `/our-team/`

| Node | `@type` | Notes |
|------|---------|-------|
| Page | `AboutPage` | `significantLink`, `isPartOf` → `#website` |
| People | `Person` | `worksFor` → `#corporation` with **`@type` + `@id` + `name`** (validator) |
| References | typed | `mainEntity` / `about` → `#corporation`, `#localbusiness` with `@type` |

Artifact naming: **`aboutpage.jsonld`** + **`aboutpage-implementation.md`** at schema root (fixed filenames — not `about-{slug}.*`). Legacy read: `about-*.jsonld`, `about-*-implementation.md`.

---

## Contact page (`ContactPage`)

**Example:** `/contact-us/`

| Node | `@type` | Notes |
|------|---------|-------|
| Page | `ContactPage` | `mainEntity` → typed `LocalBusiness` `#localbusiness` |
| Contact | `ContactPoint` | **Only fields visible on the page** (often phone + hours only) |
| Full NAP | homepage | Street address / email stay on `#localbusiness` if not on contact page |

Artifact naming: **`contactpage.jsonld`** + **`contactpage-implementation.md`** at schema root (fixed filenames — not `contact-{slug}.*`). Legacy read: `contact-*.jsonld`, `contact-*-implementation.md`.

---

## Cross-graph references (validator-critical)

[Schema.org Validator](https://validator.schema.org/) may treat bare `{ "@id": "..." }` as `Thing`. When referencing nodes defined in another script block (homepage graph), include the target **`@type`**:

```json
"worksFor": {
  "@type": "Corporation",
  "@id": "https://[domain]/#corporation",
  "name": "[Legal name]"
}
```

Apply the same pattern to `mainEntity`, `about[]`, and `provider` when using cross-page `@id` references.

---

## Deliverable format (Semantic Links client handoff)

Wrap all `*.jsonld` deliverables for CMS paste. **Universal rule:** [jsonld-script-wrapper.md](jsonld-script-wrapper.md) (all contractor/local campaigns — not franchisor-only).

```html
<script type="application/ld+json">
{ ... }
</script>
```

Document in implementation handoff: strip wrapper when pasting into Schema.org Validator.

---

## Preflight checklist (franchisor)

| Check | Required |
|-------|----------|
| Read `{project}/02-deliverables/2.4-schema/field-learnings.md` if present | Yes |
| Homepage `LocalBusiness` is not a trade subtype unless HQ performs that trade | Yes |
| Franchise-opportunity `provider` → `#corporation` | Yes |
| Support-service `provider` → `#localbusiness` | Yes |
| `WebPage.significantLink` === `url` on all `WebPage` subtypes | Yes |
| Typed `@type` on cross-graph `@id` references | Yes |
| Entity CSV before service/franchise-opportunity JSON-LD | Yes (Step 2b) |

---

## Related

- [silo-and-page-patterns.md](silo-and-page-patterns.md) — Simple/Complex silo, contractor service/location matrix
- [validation-guide.md](validation-guide.md) — `worksFor` / typed reference errors
- [schema-artifact-layout.md](schema-artifact-layout.md) — folder layout
- Per-client overrides: `{project}/02-deliverables/2.4-schema/field-learnings.md` (legacy: `resources/schema/field-learnings.md`)
