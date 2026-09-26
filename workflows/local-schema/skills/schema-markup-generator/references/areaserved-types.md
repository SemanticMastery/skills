# areaServed types (validator-critical)

`areaServed` on `Organization`, `LocalBusiness` subtypes, `Service`, and `ContactPoint` may only use types in the [Schema.org `areaServed` range](https://schema.org/areaServed).

**Incident (2026-08-25):** `@type: "Neighborhood"` invalidated the graph. [`schema.org/Neighborhood`](https://schema.org/Neighborhood) is **not a Schema.org type** (HTTP 404). Do not invent place subtypes.

## Allowed `@type` (allowlist)

| Type | When |
|------|------|
| `City` | Incorporated city / `addressLocality` |
| `State` | **Only** as `containedInPlace` under a city or place — not as a fake city |
| `AdministrativeArea` | County, metro, or other admin unit that is not a city |
| `Place` | Districts, planning sections, neighborhoods, unincorporated areas |
| `GeoShape` / `GeoCircle` | Radius / polygon service areas only |
| `Text` | Last resort when no structured place is available |

**Before handoff:** every `areaServed` object `@type` must be in this table. If it is not, change it — do not ship.

## Forbidden

| Type / pattern | Why |
|----------------|-----|
| `Neighborhood` | Not a Schema.org type; [validator.schema.org](https://validator.schema.org/) rejects it |
| `Town`, `Village`, `Borough`, `District`, `Community` | Not in the `areaServed` range (use `Place` or `City`) |
| Any other invented `@type` | Validators check the property range, not “it sounds like a place” |
| `addressCountry` on nested `areaServed` places | Keep country only on business `PostalAddress` |
| Stadium, zoo, museum, park, theater, airport, university, river, venue, or other POI | Not a service area. Put those on location `WebPage.about` as `Place` / a more specific type after URL resolution ([contentmaxima-location-preflight.md](contentmaxima-location-preflight.md)) |

## Cities

```json
{
  "@type": "City",
  "name": "[City]",
  "sameAs": "https://en.wikipedia.org/wiki/[City_article]",
  "containedInPlace": {
    "@type": "State",
    "name": "[State]"
  }
}
```

Add `sameAs` when a Wikipedia (or Wikidata) URL is known. Do not invent URLs.

## Districts / neighborhoods / planning sections

Use **`Place`**, not `Neighborhood`. Set **`name`** to the official area name and **`sameAs`** to the Wikipedia article (or Wikidata). Example:

```json
{
  "@type": "Place",
  "name": "Center City",
  "sameAs": "https://en.wikipedia.org/wiki/Center_City,_Philadelphia",
  "containedInPlace": {
    "@type": "City",
    "name": "Philadelphia",
    "containedInPlace": {
      "@type": "State",
      "name": "Pennsylvania"
    }
  }
}
```

Resolve names and URLs from a verified list (Wikipedia area list, GBP service area, or user-supplied official names). Do not use slang (“South Philly”) when an official article title exists (“South Philadelphia”) unless the user requires the slang as the `name` **and** still provides the official `sameAs`.

## Pre-ship checklist

- [ ] No `Neighborhood` (or other non-range type) anywhere in `areaServed`
- [ ] Every structured place has `name`
- [ ] Districts/neighborhoods have Wikipedia/Wikidata `sameAs` when the article exists
- [ ] `addressCountry` only on `address`
- [ ] Nested `State` / `City` in `containedInPlace` have `@type` + `name` only (plus `sameAs` on the city when known)
- [ ] No POI / landmark (stadium, zoo, museum, airport, …) in `areaServed` — those belong on location `WebPage.about`
