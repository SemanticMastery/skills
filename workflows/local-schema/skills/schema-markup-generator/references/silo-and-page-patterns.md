# Site Silo & Page-Type Patterns

Use this reference for local-service contractor sites (tree care, HVAC, roofing, etc.) and any site with a flat vs nested URL structure. **Determine silo type before choosing schema per page.**

---

## Silo types (MUST identify first)

### Simple Silo

**Definition:** Every indexable page is a **top-level URL** — a direct child of the homepage. There is no `parent/child` directory depth in paths.

| Signal | Example |
|--------|---------|
| Service pages | `https://example.com/tree-removal` |
| Location pages | `https://example.com/austin-tx` |
| **Not** | `https://example.com/services/tree-removal` |

**Schema rules:**

- **DO NOT** add `BreadcrumbList` — breadcrumbs are for sites whose URL structure has multiple directory levels that match navigation.
- Use `@graph` with page-appropriate types only (e.g. `WebPage` + `Service`).
- `WebPage.isPartOf` → `WebSite` is still appropriate.

### Complex Silo

**Definition:** URLs have **multiple path segments** reflecting hierarchy: `root` → `parent` → `child` → optional `post`.

| Signal | Example |
|--------|---------|
| Nested services | `https://example.com/services/tree-removal` |
| Blog / resources | `https://example.com/blog/2024/how-to-trim-oaks` |

**Schema rules:**

- **DO** add `BreadcrumbList` when the visible breadcrumb trail matches real URL depth (typically 2+ levels below root).
- Link from `WebPage` via `"breadcrumb": { "@id": "[canonical]#breadcrumb" }`.
- Breadcrumb `item` URLs must match actual canonical paths.

### Quick detection

1. Read sitemap or sample URLs.
2. If all money pages are `domain.com/[single-slug]` → **Simple Silo**.
3. If money pages use `domain.com/[category]/[slug]` or deeper → **Complex Silo**.
4. When unsure, ask the user: *"Is this a Simple Silo (all top-level pages) or Complex Silo (nested directories)?"*

---

## Location landing page & GBP

The **location landing page** is the URL linked from the Google Business Profile as the website.

| Scenario | GBP website URL | Homepage schema |
|----------|-------------------|-----------------|
| **Single location / one GBP** | Homepage (`/`) | Homepage **is** the location landing page |
| **Multi-location / multiple GBPs** | Dedicated city page (e.g. `/leander-tx`) | Homepage: entity/brand only; **each city page** gets `LocalBusiness` subtype |

---

## Page-type schema matrix

### Homepage (single GBP — also location landing)

Use `@graph` with **two** entities:

| Node | `@type` | `@id` suffix | Holds |
|------|---------|--------------|-------|
| Legal entity | `Corporation` (preferred for for-profit contractors over generic `Organization`) | `#corporation` | `legalName`, `foundingDate`, `founder`, `logo` (after **Step 0c**), `sameAs` (after **Step 0b**) |
| Local presence | `LocalBusiness` subtype (e.g. `HomeAndConstructionBusiness`) | **Dedicated ID URI** if provided; else `#localbusiness` | `geo` + `image` (after **Step 0c**), `hasMap`, hours, `areaServed`, `aggregateRating` |

Link: `"parentOrganization": { "@id": "https://[domain]/#corporation" }` on the `LocalBusiness` node.

**Dedicated ID URI:** When the client publishes a standalone entity page (e.g. `https://…/id.html`), that URL is `@id` on this node and on **every** `provider` / `mainEntity` / `about` reference site-wide. See [dedicated-id-uri.md](dedicated-id-uri.md). Do not use `[domain]/#localbusiness` on child pages when a dedicated URI is already in use.

Deploy homepage `@graph` **site-wide** (or on every page) so `provider` / `@id` references resolve.

### Homepage (sparse site — few money pages)

When the campaign has **no dedicated service or city URLs** and the user wants offerings + service-area + topic entities on the homepage, extend the `@graph` to **three** nodes. Full rules: **[sparse-site-homepage-patterns.md](sparse-site-homepage-patterns.md)**.

| Node | Holds |
|------|--------|
| `Corporation` | unchanged |
| `LocalBusiness` subtype | `makesOffer` → `Offer.itemOffered` → `#…-service`; **`knowsAbout`** → topic `Thing` list; **`areaServed`** → places with entity `sameAs` |
| `Service` (sibling) | Primary offering; `provider` → local business `@id` |

**Validator-critical:** **`about` is not valid on `LocalBusiness` / `HomeAndConstructionBusiness`.** Do not reuse the service-page `WebPage.about` pattern on the local business node — [validator.schema.org](https://validator.schema.org/) rejects it. Geography belongs in **`areaServed`** only.

Run **`resolve-entity-urls.mjs`** for every `knowsAbout` / `areaServed` entity (Grokipedia included) even when Step 2b CSV preflight is skipped.

### Service page (Simple Silo)

Use `@graph` with **two** entities — **no** `BreadcrumbList`:

| Node | `@type` | `@id` suffix |
|------|---------|--------------|
| Page | `WebPage` | `#webpage` |
| Offering | `Service` | `#service` |

**Service (required patterns):**

- `"provider": { "@id": "[LocalBusiness canonical @id]" }` — dedicated ID URI when provided; else `https://[domain]/#localbusiness` (see [dedicated-id-uri.md](dedicated-id-uri.md))
- `"serviceType"`: short label matching page (e.g. `"Tree Removal"`)
- `description`, `image`, `url`: match visible page content and meta
- `areaServed`: City list with `containedInPlace` → `State` only (**no** `addressCountry` on `State` — see LocalBusiness rules in SKILL.md)
- **Omit** `offers` / `price` unless current price is visible on the page
- **Omit** `aggregateRating` unless reviews are visible on that page

**WebPage:**

- `"significantLink": "[canonical URL]"` — **required**; same string as `url` ([webpage-significantlink.md](webpage-significantlink.md))
- `"mainEntity": { "@id": "[canonical]#service" }`
- `"about"`: **array** — `[{ "@id": "[canonical]#service" }, ...Thing entities]` (see [schema-templates.md § Service page](schema-templates.md#service-page-simple-silo-contractor-sites--validated-pattern))
- **DO NOT** use `knowsAbout` on `WebPage` or `Service` (validator rejects; use `about` for topic entities)
- `"isPartOf": { "@type": "WebSite", "@id": "https://[domain]/#website", ... }`
- `"primaryImageOfPage"`: page hero image when available

**Topic entities (optional, recommended for E-E-A-T):**

- Source: per-service CSV (`Entity Name`, relevance, Wikipedia / Wikidata / **Grokipedia** columns). Grokipedia must be verified per row via **knowsabout-entity-research** (not optional). Incomplete CSV (all Grokipedia `-`) blocks JSON-LD until resolved or user waives.
- Structure each as `Thing` with `sameAs` URL array; `@id` = Wikidata when available
- Place **only** on `WebPage.about`, not on `Service`
- For site-wide expertise, `knowsAbout` may be used on homepage `Corporation` / `Organization` nodes only

### Service page (Complex Silo)

Same as Simple Silo, **plus** `BreadcrumbList` when URL depth and on-page breadcrumbs justify it.

### Location / city page (Simple Silo)

**Single GBP (business HQ in one city, city pages for SEO):** `@graph` with **two** entities — `WebPage` + `ItemList` (service catalog). **Do not duplicate** `LocalBusiness` on city pages; reference the homepage `LocalBusiness` `@id` (dedicated ID URI or `#localbusiness`).

| Node | `@type` | `@id` suffix | Holds |
|------|---------|--------------|-------|
| Page | `WebPage` | `#webpage` | `mainEntity` → `[LocalBusiness @id]`; `mentions` → service catalog `ItemList`; `about` → `[LocalBusiness @id]` + target `City` + `Thing` entities |
| Service catalog | `ItemList` | `#service-catalog` | `itemListElement` → each service `#service` `@id` (sibling node in `@graph`, not nested under `WebPage`) |

**WebPage (required patterns):**

- `"significantLink": "[canonical URL]"` — **required**; same string as `url` ([webpage-significantlink.md](webpage-significantlink.md))
- `"mainEntity": { "@id": "[LocalBusiness canonical @id]" }` — same URI as homepage `LocalBusiness.@id` and service `provider` (see [dedicated-id-uri.md](dedicated-id-uri.md))
- `"mentions"`: `{ "@id": "...#[slug]#service-catalog" }` on `WebPage` — **do not use `hasPart`** (`hasPart` only accepts `CreativeWork`, not `ItemList`)
- Separate `@graph` node: `ItemList` (`#[slug]#service-catalog`) listing every service via `ListItem.item` → `https://[domain]/[service-slug]#service`
- `"about"`: **array** — `[{ "@id": "[LocalBusiness canonical @id]" }, { "@type": "City", ... }, ...Thing entities from per-city CSV]`
- **DO NOT** use `knowsAbout` on `WebPage` (use `about` for topic entities — same rule as service pages)
- `"isPartOf"` → `WebSite`; `"primaryImageOfPage"` when hero image is known
- **Omit** `BreadcrumbList` (Simple Silo)

**Topic entities:** source from per-location CSV (`Entity Name`, relevance, Wikipedia / Wikidata / Grokipedia). Same `Thing` pattern as service pages. Include target `City` in `about` with `containedInPlace` → `State` only.

**Deploy homepage** `Corporation` + `LocalBusiness` schema site-wide so the `LocalBusiness` `@id` and per-service `#service` `@id` references resolve.

**Reference implementation:** Box Tree Care `location-leander-tx.jsonld`.

### Location page (multi-GBP)

City URL is the location landing for that GBP; include full `LocalBusiness` subtype on that page, not duplicated on homepage.

### Franchisor sites (franchise sales + franchisee support)

When the client is a **franchisor** (not a field contractor at HQ), use **[franchisor-page-patterns.md](franchisor-page-patterns.md)** instead of contractor defaults for:

- Homepage `LocalBusiness` subtype and `knowsAbout`
- `Service.provider` → `#corporation` vs `#localbusiness` by page role
- `AboutPage`, `ContactPage`, and CMS script-wrapper deliverables

Read `{project}/02-deliverables/2.4-schema/field-learnings.md` when present for client-specific slug/provider table (legacy read: `resources/schema/field-learnings.md`).

---

## `@id` conventions (stable across site)

| Entity | Pattern |
|--------|---------|
| Corporation | `https://[domain]/#corporation` |
| Local business | Dedicated ID URI if provided; else `https://[domain]/#localbusiness` ([dedicated-id-uri.md](dedicated-id-uri.md)) |
| WebSite | `https://[domain]/#website` |
| Service (per page) | `https://[domain]/[slug]#service` |
| WebPage (per page) | `https://[domain]/[slug]#webpage` |
| Service catalog (location page) | `https://[domain]/[city-slug]#service-catalog` |
| About page (per page) | `https://[domain]/[slug]#webpage` |
| Person (about page) | `https://[domain]/[slug]#[person-slug]` |
| Contact point (contact page) | `https://[domain]/[slug]#contactpoint` |
| Breadcrumb (complex silo only) | `https://[domain]/[path]#breadcrumb` |

---

## Preflight by silo + page type

| Check | Simple Silo | Complex Silo |
|-------|-------------|----------------|
| `BreadcrumbList` absent on flat URLs | Required | N/A |
| `BreadcrumbList` present when URL depth ≥ 2 | N/A | When breadcrumbs are visible |
| `provider` / location `mainEntity` → same `LocalBusiness` `@id` as homepage | Required | Required |
| `WebPage.significantLink` === `WebPage.url` on service/location pages | Required | Required |
| Homepage `@graph` deployed for `@id` resolution | Required | Required |
| `addressCountry` only on `PostalAddress` | Required | Required |
