# Sparse-site homepage — service & location entities on `LocalBusiness`

Use when a campaign has **few indexable pages** (no dedicated service or city URLs) and the user wants service offerings, topic entities, and service-area places expressed on the **homepage** `@graph` instead of separate `services/` or `locations/` JSON-LD files.

**Reference implementation:** Blue Wash Cleaning `02-deliverables/2.4-schema/homepage.jsonld` (2026-07-06).

---

## When this applies

| Signal | Action |
|--------|--------|
| Sitemap has homepage + about/contact/booking only — no `/house-cleaning` or `/valley-stream` slugs | Consolidate on homepage |
| User says "add service/area entities to homepage schema" | Use this pattern |
| Dedicated service/location URLs exist | **Do not** use this pattern — use normal `WebPage` + `Service` / `WebPage` + `ItemList` per [silo-and-page-patterns.md](silo-and-page-patterns.md) |

---

## Validator-critical — **`about` is NOT valid on `LocalBusiness` / `Organization`**

**`about`** is a **`CreativeWork`** property (`WebPage`, `Article`, `AboutPage`, etc.). It is **not** defined on `Organization`, `LocalBusiness`, or subtypes such as `HomeAndConstructionBusiness`.

[validator.schema.org](https://validator.schema.org/) warns:

> *The property about is not recognized by the schema (e.g. schema.org) for an object of type HomeAndConstructionBusiness.*

**Do not** copy the service-page pattern (`WebPage.about` array) onto the homepage `LocalBusiness` node — even when consolidating entities for a sparse site.

| Property | Valid on homepage `LocalBusiness`? | Valid on `WebPage` (service page)? |
|----------|-----------------------------------|-------------------------------------|
| `about` | **No** | **Yes** — topic `Thing` array |
| `knowsAbout` | **Yes** — `Organization` subtype | **No** |
| `areaServed` | **Yes** — places with `sameAs` | **Yes** on `Service` |
| `makesOffer` | **Yes** — link to sibling `Service` | N/A |

---

## Correct `@graph` (three nodes)

```text
Corporation (#corporation)
HomeAndConstructionBusiness (dedicated ID URI or #localbusiness)
Service (#house-cleaning-service or #[slug]-service)
```

### `HomeAndConstructionBusiness` holds

| Need | Property | Pattern |
|------|----------|---------|
| Primary offering | **`makesOffer`** | `Offer` with `url` (booking page if visible) and `itemOffered` → `{ "@id": "[domain]/#…-service" }` |
| Topic / trade entities | **`knowsAbout`** | Array of `Thing` objects — `name`, `description`, `@id` (Wikidata), `sameAs` (Wikipedia + Wikidata + Grokipedia when verified) |
| Service geography | **`areaServed`** | `City` / `AdministrativeArea` / `Place` with entity `sameAs`; **never `Neighborhood`**. Nest `containedInPlace` → `State` only (**no** `addressCountry` on nested places). See [areaserved-types.md](areaserved-types.md) |

### `Service` (sibling node in `@graph`)

- `"@id": "https://[domain]/#house-cleaning-service"` (fragment on marketing domain is OK when no dedicated service URL exists)
- `"provider": { "@id": "[LocalBusiness canonical @id]" }`
- `"areaServed"`: primary city — prefer full `City` object or `{ "@id": "https://www.wikidata.org/wiki/Q…" }`
- **Omit** `knowsAbout` and topic lists on `Service` — topics stay on `LocalBusiness.knowsAbout`

---

## Entity resolution (mandatory)

Sparse-site homepage work **still requires verified URLs** for every `Thing` / place in `knowsAbout` and `areaServed`:

1. Run **`resolve-entity-urls.mjs`** (`knowsabout-entity-research`) for each entity name — **do not** paste Wikipedia URLs from memory without Grokipedia probes.
2. Include **Grokipedia** in each entity `sameAs` when HEAD returns 200; omit only when all probes return 404 (document in `homepage-implementation.md`).
3. Optional: write a one-off CSV under `02-deliverables/2.4-schema/knowsabout/homepage-{slug}-knowsabout.csv` for audit trail — not required for Step 2b skip, but recommended when entity count ≥ 3.

Step 2b CSV preflight remains **skipped** for homepage-only runs unless the user requests a homepage topic CSV — but **Grokipedia verification is not waived**.

---

## Anti-patterns

| Wrong | Right |
|-------|--------|
| `"about": [ Service, City ]` on `HomeAndConstructionBusiness` | `makesOffer` + sibling `Service`; places in `areaServed` |
| Duplicate city in `about` and `areaServed` | **`areaServed` only** for geography |
| `knowsAbout` on `Service` or `WebPage` on sparse homepage without `WebPage` node | `knowsAbout` on `LocalBusiness` only |
| Wikipedia + Wikidata only, no Grokipedia probe | Run resolver; add Grokipedia URL when page exists |
| Inline `Service` inside `LocalBusiness` with no `@graph` node | Separate `Service` in `@graph` so `makesOffer.itemOffered` resolves |

---

## Minimal JSON-LD sketch

```json
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Corporation", "@id": "https://example.com/#corporation", "...": "..." },
    {
      "@type": "HomeAndConstructionBusiness",
      "@id": "https://…/id.html",
      "makesOffer": {
        "@type": "Offer",
        "url": "https://example.com/booking-page/",
        "itemOffered": { "@id": "https://example.com/#house-cleaning-service" }
      },
      "knowsAbout": [
        {
          "@type": "Thing",
          "@id": "https://www.wikidata.org/wiki/Q6735317",
          "name": "Maid service",
          "description": "…",
          "sameAs": [
            "https://en.wikipedia.org/wiki/Maid_service",
            "https://www.wikidata.org/wiki/Q6735317",
            "https://grokipedia.com/page/Maid_service"
          ]
        }
      ],
      "areaServed": [
        {
          "@type": "City",
          "@id": "https://www.wikidata.org/wiki/Q3476571",
          "name": "Valley Stream",
          "sameAs": [
            "https://en.wikipedia.org/wiki/Valley_Stream,_New_York",
            "https://www.wikidata.org/wiki/Q3476571",
            "https://grokipedia.com/page/Valley_Stream%2C_New_York"
          ],
          "containedInPlace": {
            "@type": "AdministrativeArea",
            "name": "Nassau County",
            "sameAs": [
              "https://en.wikipedia.org/wiki/Nassau_County,_New_York",
              "https://www.wikidata.org/wiki/Q54065",
              "https://grokipedia.com/page/Nassau_County%2C_New_York"
            ],
            "containedInPlace": { "@type": "State", "name": "New York" }
          }
        }
      ]
    },
    {
      "@type": "Service",
      "@id": "https://example.com/#house-cleaning-service",
      "name": "House cleaning service",
      "serviceType": "House cleaning",
      "url": "https://example.com/booking-page/",
      "provider": { "@id": "https://…/id.html" },
      "areaServed": { "@id": "https://www.wikidata.org/wiki/Q3476571" }
    }
  ]
}
```

Document sparse-site decisions in `homepage-implementation.md` (entity table, Grokipedia probe results, `@id` map).

---

## Integration

| Doc | Role |
|-----|------|
| [silo-and-page-patterns.md](silo-and-page-patterns.md) | Default homepage = 2 nodes; sparse = 3 nodes |
| [validation-guide.md](validation-guide.md) | Common validator warnings |
| [entity-csv-preflight.md](entity-csv-preflight.md) | Step 2b skip for homepage-only |
| `knowsabout-entity-research` | Grokipedia + Wikipedia resolution |
