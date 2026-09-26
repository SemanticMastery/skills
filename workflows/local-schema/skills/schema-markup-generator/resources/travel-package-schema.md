# Travel-package schema (recall only)

This is **not** a yacht-charter or tour JSON-LD template. Use it when a page sells a trip, charter, or packaged itinerary instead of a contractor service.

## Pattern

| Node | Role |
|------|------|
| `WebPage` | Page wrapper — `mainEntity` points at the trip |
| `BoatTrip` or `TouristTrip` | The offer itself (`@type` from the product: boat charter vs land/multi-modal tour) |
| `TravelAction` | **`potentialAction` only** — do not use `TravelAction` as `mainEntity` or as a stand-in for the trip |

Keep `areaServed` / location `WebPage.about` rules from the contractor pattern when the same site also has city pages. Landmarks stay on `about`, not `areaServed`.

## Do not

- Invent a full itinerary graph, `OfferCatalog`, or booking widget schema from this note.
- Put `TravelAction` on `WebPage.about`.
- Substitute this pattern for contractor `Service` pages.

When the user asks for a full tour/charter graph, stop and draft against live page copy — do not expand this recall into a template.
