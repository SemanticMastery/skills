# JSON-LD script wrapper (mandatory for client deliverables)

All `*.jsonld` files written to disk for Semantic Links client handoff must be **CMS copy-paste ready** — wrapped in a single HTML script tag. Default for every contractor/local campaign unless the user explicitly requests raw JSON only.

## On-disk format (required)

Every deliverable under `02-deliverables/2.4-schema/` — `homepage.jsonld`, `aboutpage.jsonld`, `contactpage.jsonld`, `services/service-*.jsonld`, `locations/location-*.jsonld` — must use this structure:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    
  ]
}
</script>
```

| Rule | Requirement |
|------|-------------|
| Opening tag | `<script type="application/ld+json">` on its own line |
| JSON body | Valid JSON-LD only — no HTML comments inside the block |
| Closing tag | `</script>` on its own line after the closing `}` or `]` |
| One block per file | One `<script>` wrapper per `.jsonld` file |
| Indentation | 2-space indent inside the script tag (readable paste for clients) |

**Do not** write bare JSON objects to `.jsonld` files for client deliverables.

## When to skip the wrapper

| Scenario | Wrapper |
|----------|---------|
| Client / contractor deliverable (`*.jsonld` on disk) | **Required** |
| User says "raw JSON only" or "validator-ready JSON" | Omit wrapper for that run |
| Chat preview / diff in conversation | May show JSON only for readability |
| Paste into Schema.org Validator | Strip `<script>` tags; paste JSON body only |

## Validation handoff

Document in the paired implementation file (`aboutpage-implementation.md`, `contactpage-implementation.md`, etc.) or `homepage-implementation.md`:

- **CMS deploy:** paste the full file (including `<script>` tags) into the page HTML or custom-code block.
- **Schema.org Validator / Rich Results Test:** copy only the JSON between the script tags.

## Applies to

- Homepage, service, location, about, contact, and franchisor page types
- All page patterns in [silo-and-page-patterns.md](silo-and-page-patterns.md) and [franchisor-page-patterns.md](franchisor-page-patterns.md)
- Regenerated files when refreshing an existing slug — re-wrap on write

## Legacy files

Older projects may have bare JSON in `resources/schema/` or early `2.4-schema/` runs. On **refresh or new write**, apply the wrapper. Read legacy bare JSON as fallback; do not strip wrappers from files that already have them.
