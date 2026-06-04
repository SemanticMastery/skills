# WebPage — `significantLink` (mandatory on contractor pages)

Apply on **every** `WebPage` node where JSON-LD is the primary page schema (service pages, location pages, and any other deliverable whose `@graph` includes `WebPage`).

## Rule

| Property | Value |
|----------|--------|
| `significantLink` | **Canonical URL of the page hosting this JSON-LD** — same string as `WebPage.url` |

```json
{
  "@type": "WebPage",
  "@id": "https://example.com/tree-removal#webpage",
  "url": "https://example.com/tree-removal",
  "significantLink": "https://example.com/tree-removal",
  ...
}
```

## Scope

| Page type | `WebPage` in `@graph`? | Add `significantLink`? |
|-----------|------------------------|-------------------------|
| Service (Simple Silo) | Yes | **Yes** |
| Location / city (Simple Silo, single GBP) | Yes | **Yes** |
| Homepage (`Corporation` + `LocalBusiness` only) | No `WebPage` node | N/A |
| FAQ / Article / other | When output includes `WebPage` | **Yes** |

## Rationale

- Schema.org defines `significantLink` on `WebPage` as a significant URL for that page ([WebPage](https://schema.org/WebPage), [significantLink](https://schema.org/significantLink)).
- Semantic Links uses the **self-referential canonical URL** so the entity graph explicitly ties the markup block to the live document URI (alongside `url` and `@id`).
- Do **not** point `significantLink` at `#service`, `#webpage`, or fragment IDs — use the bare canonical HTTPS URL.

## Validation

- [ ] `significantLink` present on every `WebPage` node in service/location JSON-LD
- [ ] `significantLink` === `url` (exact string match)
- [ ] Absolute `https://` URL; no trailing-slash mismatch vs canonical

## Anti-patterns

| Wrong | Right |
|-------|--------|
| Omit on service/location `WebPage` | Always set when `WebPage` exists |
| `significantLink`: `"…#webpage"` | Host page URL only |
| Different URL than `url` | Must match canonical |
