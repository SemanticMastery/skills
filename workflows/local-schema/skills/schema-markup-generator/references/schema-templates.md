# Schema.org JSON-LD Templates

Compact starter blocks. Replace placeholders, remove unused fields, and validate before ship.

## Shared Rules

- Match visible page content exactly; omit fields that are not visible or verified.
- Use absolute canonical URLs.
- Use ISO 8601 for dates and durations.
- Remove placeholders before publishing.
- Only emit `aggregateRating` or `review` when visible, verifiable user reviews support the exact values.

## FAQPage

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "[Question text 1]",
      "acceptedAnswer": { "@type": "Answer", "text": "[Answer text 1]" }
    },
    {
      "@type": "Question",
      "name": "[Question text 2]",
      "acceptedAnswer": { "@type": "Answer", "text": "[Answer text 2]" }
    }
  ]
}
```

## HowTo

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "[How-to title]",
  "description": "[Brief description]",
  "totalTime": "PT[hours]H[minutes]M",
  "supply": [{ "@type": "HowToSupply", "name": "[Supply item]" }],
  "tool": [{ "@type": "HowToTool", "name": "[Tool]" }],
  "step": [{ "@type": "HowToStep", "position": 1, "name": "[Step title]", "text": "[Instructions]", "url": "[Page URL]#step1" }]
}
```

## Article / BlogPosting

Use `Article`, `BlogPosting`, `NewsArticle`, or `TechArticle` as `@type`.

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "[Title]",
  "description": "[Summary]",
  "image": ["[Image URL]"],
  "datePublished": "[ISO 8601 publish date-time]",
  "dateModified": "[ISO 8601 modified date-time]",
  "author": { "@type": "Person", "name": "[Author Name]" },
  "publisher": { "@type": "Organization", "name": "[Publisher Name]", "logo": { "@type": "ImageObject", "url": "[Logo URL]" } },
  "mainEntityOfPage": { "@type": "WebPage", "@id": "[Canonical URL]" }
}
```

## Product

Use `aggregateRating` and `review` only when counts and values match visible, verified user reviews.
Use `price`, `priceCurrency`, and `availability` only when the page shows current purchasable offer details.

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "[Product Name]",
  "image": ["[Image URL]"],
  "description": "[Product description]",
  "sku": "[SKU]",
  "brand": { "@type": "Brand", "name": "[Brand Name]" },
  "offers": {
    "@type": "Offer",
    "url": "[Product page URL]",
    "priceCurrency": "[ISO 4217 currency code]",
    "price": "[price]",
    "availability": "https://schema.org/[InStock/OutOfStock/PreOrder]"
  }
}
```

**Optional review extension**: add only when the page shows visible, verifiable user reviews that match the numbers.

```json
"aggregateRating": {
  "@type": "AggregateRating",
  "ratingValue": "[rating value]",
  "reviewCount": "[review count]",
  "bestRating": "5",
  "worstRating": "1"
},
"review": [{
  "@type": "Review",
  "author": { "@type": "Person", "name": "[Reviewer Name]" },
  "reviewRating": { "@type": "Rating", "ratingValue": "[rating value]", "bestRating": "5" },
  "reviewBody": "[Review text]",
  "datePublished": "[ISO 8601 review date]"
}]
```

## LocalBusiness

Use a specific subtype when possible, such as `Restaurant`, `Store`, `LegalService`, `Dentist`, `HomeAndConstructionBusiness`, or `AutoRepair`. Include `@id`, name, URL, phone, address, opening hours, and price range only when visible. **`sameAs`:** complete [sameas-intake.md](sameas-intake.md) (Step 0b) before populating — user list + dossier `[V]`, no guessed URLs. **Optional review extension**: reuse the Product review fragment only when local-business reviews are visible, verifiable, and policy-eligible.

> **MUST — `addressCountry`**: Put `addressCountry` **only** on `address` (`PostalAddress`). Never on `State`, `City`, or `areaServed` nested places — Schema.org validators warn on `State.addressCountry`.

**`areaServed` (City list)** — omit postal properties from nested `State`:

```json
"areaServed": [
  {
    "@type": "City",
    "name": "[City]",
    "containedInPlace": {
      "@type": "State",
      "name": "[State]"
    }
  }
]
```

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "[LocalBusiness canonical @id — dedicated ID URI or [Site URL]#localbusiness]",
  "name": "[Business Name]",
  "url": "[Business canonical URL]",
  "image": ["[Business image URL]"],
  "telephone": "[Phone]",
  "priceRange": "[Visible price range]",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "[Street address]",
    "addressLocality": "[City]",
    "addressRegion": "[Region]",
    "postalCode": "[Postal code]",
    "addressCountry": "[Country code]"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": "[latitude]", "longitude": "[longitude]" },
  "openingHoursSpecification": [{
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["[DayOfWeek]"],
    "opens": "[HH:MM]",
    "closes": "[HH:MM]"
  }],
  "sameAs": ["[Profile URL]"]
}
```

## Organization

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "[Organization Name]",
  "url": "[Website URL]",
  "logo": "[Logo URL]",
  "description": "[Company description]",
  "sameAs": ["[LinkedIn URL]", "[YouTube URL]"],
  "contactPoint": { "@type": "ContactPoint", "telephone": "[Phone]", "contactType": "[contact type]" }
}
```

## Service page (Simple Silo contractor sites) — validated pattern

**Reference implementation:** Box Tree Care `service-tree-removal.jsonld` (validator-clean).

**Simple Silo only** — top-level URL (`/tree-removal`). `@graph` with `WebPage` + `Service`. **Omit `BreadcrumbList`.** See [silo-and-page-patterns.md](silo-and-page-patterns.md).

**Deploy homepage** `Corporation` + `LocalBusiness` schema site-wide so `provider` → **same** `LocalBusiness` `@id` as homepage resolves ([dedicated-id-uri.md](dedicated-id-uri.md)).

### Topic entities (`knowsAbout` vs `about`)

| Property | Valid on | Use for |
|----------|----------|---------|
| `knowsAbout` | `Person`, `Organization` only | Homepage `#corporation` / `#localbusiness` if site-wide expertise is needed |
| `about` | `WebPage` / `CreativeWork` | **Service page topic entities** (adjacent concepts, processes, tools) |

**DO NOT** put `knowsAbout` on `Service` or `WebPage` — [validator.schema.org](https://validator.schema.org/) warns.

On **WebPage**, use **`about` as an array**: first item = service `@id`; remaining items = `Thing` objects from a CSV or brief (name, description, `sameAs` URL array per entity).

**Per-entity `Thing` pattern** (from `tree-removal-knowsabout.csv` or equivalent):

```json
{
  "@type": "Thing",
  "@id": "[Wikidata URL, or Wikipedia if no Wikidata]",
  "name": "[Entity name]",
  "description": "[Relevance to this service]",
  "sameAs": [
    "[Wikipedia URL if present]",
    "[Wikidata URL if present]",
    "[Grokipedia URL if present]"
  ]
}
```

- Include only valid `http(s)` URLs in `sameAs` (skip `-`, placeholders, non-URLs).
- Prefer `@id` = Wikidata URI when available.

### Full `@graph` template

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "[Canonical URL]#webpage",
      "url": "[Canonical URL]",
      "significantLink": "[Canonical URL]",
      "name": "[Page title from <title>]",
      "description": "[Meta description]",
      "isPartOf": {
        "@type": "WebSite",
        "@id": "[Site URL]#website",
        "name": "[Business Name]",
        "url": "[Site URL]"
      },
      "primaryImageOfPage": {
        "@type": "ImageObject",
        "url": "[Hero image absolute URL]"
      },
      "mainEntity": { "@id": "[Canonical URL]#service" },
      "about": [
        { "@id": "[Canonical URL]#service" },
        {
          "@type": "Thing",
          "@id": "[Wikidata or Wikipedia URI]",
          "name": "[Entity]",
          "description": "[Relevance]",
          "sameAs": ["[Wikipedia]", "[Wikidata]", "[Grokipedia]"]
        }
      ]
    },
    {
      "@type": "Service",
      "@id": "[Canonical URL]#service",
      "name": "[Service name — usually H1]",
      "serviceType": "[Short label, e.g. Tree Removal]",
      "description": "[Visible hero + supporting copy, aligned with page]",
      "url": "[Canonical URL]",
      "image": "[Hero image absolute URL]",
      "provider": { "@id": "[LocalBusiness canonical @id]" },
      "areaServed": [
        {
          "@type": "City",
          "name": "[City]",
          "containedInPlace": { "@type": "State", "name": "[State]" }
        }
      ]
    }
  ]
}
```

**Service node — omit unless visible on page:** `offers`, `price`, `aggregateRating`, `knowsAbout`, topic `Thing` list (topics live on `WebPage.about` only).

## Homepage location landing (single GBP)

`Corporation` + `LocalBusiness` subtype in `@graph`. See [silo-and-page-patterns.md](silo-and-page-patterns.md).

## Location page (Simple Silo, single GBP) — validated pattern

**Reference implementation:** Box Tree Care `location-leander-tx.jsonld`.

**Single GBP only** — top-level URL (`/leander-tx`). `@graph` with **`WebPage` + `ItemList`** (no duplicated `LocalBusiness`). **Omit `BreadcrumbList`.** Link service catalog via `WebPage.mentions` → `#service-catalog` (not `hasPart` — validator rejects `ItemList` as `hasPart` target).

### Topic entities

Same rules as service pages: **`WebPage.about` array** (not `knowsAbout`). First items: **same** `LocalBusiness` `@id` as homepage + target `City`; remaining items = `Thing` objects from per-location CSV. See [dedicated-id-uri.md](dedicated-id-uri.md).

### Full `@graph` template

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "[Canonical URL]#webpage",
      "url": "[Canonical URL]",
      "significantLink": "[Canonical URL]",
      "name": "[Page title from <title>]",
      "description": "[Meta description]",
      "isPartOf": {
        "@type": "WebSite",
        "@id": "[Site URL]#website",
        "name": "[Business Name]",
        "url": "[Site URL]"
      },
      "primaryImageOfPage": {
        "@type": "ImageObject",
        "url": "[Hero image absolute URL]"
      },
      "mainEntity": { "@id": "[LocalBusiness canonical @id]" },
      "mentions": { "@id": "[Canonical URL]#service-catalog" },
      "about": [
        { "@id": "[LocalBusiness canonical @id]" },
        {
          "@type": "City",
          "name": "[City]",
          "containedInPlace": { "@type": "State", "name": "[State]" }
        },
        {
          "@type": "Thing",
          "@id": "[Wikidata or Wikipedia URI]",
          "name": "[Entity]",
          "description": "[Relevance to this city]",
          "sameAs": ["[Wikipedia]", "[Wikidata]", "[Grokipedia]"]
        }
      ]
    },
    {
      "@type": "ItemList",
      "@id": "[Canonical URL]#service-catalog",
      "name": "Tree Services in [City], [State abbr]",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "item": { "@id": "[Site URL]/[service-slug]#service" }
        }
      ]
    }
  ]
}
```

**WebPage node — omit unless visible on page:** duplicated `LocalBusiness` fields, `aggregateRating`, `knowsAbout`, pricing. **Do not use `hasPart` for `ItemList`** — use `mentions` + sibling `ItemList` node in `@graph`.

## BreadcrumbList

> **Simple Silo:** **DO NOT use** — all pages are top-level; no multi-level URL directories.
> **Complex Silo:** Use when path has `parent/child` depth and visible breadcrumbs match.

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "[Homepage URL]" },
    { "@type": "ListItem", "position": 2, "name": "[Category]", "item": "[Category URL]" },
    { "@type": "ListItem", "position": 3, "name": "[Current Page]", "item": "[Page URL]" }
  ]
}
```

## Other Types Matrix

| Type | Required starter fields | Notes |
|------|-------------------------|-------|
| VideoObject | name, description, thumbnailUrl, uploadDate, duration, embedUrl | Use visible video metadata |
| PodcastEpisode | name, description, url, datePublished, partOfSeries | Align with RSS/episode source-of-truth |
| Event | name, description, startDate, status, attendance mode, location, organizer | Keep status current |
| Course | name, description, provider, course instance | Use CourseInstance for mode/workload |
| Recipe | name, image, author, description, times, yield, ingredients, instructions | Optional review extension only when visible |
| SoftwareApplication | name, operatingSystem, applicationCategory, offers, version, downloadUrl | Price can be `[price or 0]` only when visible |

## Combined Array

Place multiple complete objects inside one array in a single `<script type="application/ld+json">` block when the page needs more than one schema type.

## Preflight Checklist

- Validate with `validator.schema.org` and Google Rich Results Test.
- Use truthful review data only; if unsure, omit review properties.
- Keep URLs canonical and accessible.
- Remove trailing commas and placeholder text before publishing.
