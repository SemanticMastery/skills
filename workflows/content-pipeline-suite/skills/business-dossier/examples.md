# Business Dossier — Examples

## Invocation (chat)

```
/business-dossier

Name: Arbor Max Tree Service
Address: 1206 Carbon St Suite 200, Reading, PA 19601
Phone: (484) 878-8947
Website: https://www.arbormaxpa.com/
GBP: https://maps.app.goo.gl/...
Project folder: campaign root (dossier → 01-intake/1.1-docs/)
```

```
Compose a business dossier before we start the SEO audit.
GBP URL is https://share.google/...
```

```
Dry run the business dossier script — check keys and output paths only.
```

## CLI (production)

From the skill's `scripts/` folder (after `npm install`):

```bash
node compose-business-dossier.mjs \
  --name "Example Tree Care" \
  --address "123 Main St, Denver, CO 80014" \
  --phone "(555) 555-0100" \
  --website "https://example.com/" \
  --gbp-url "https://maps.app.goo.gl/EXAMPLE" \
  --project-dir "/absolute/path/to/project"
```

## Expected deliverables

```text
your-campaign/
  01-intake/
    1.1-docs/
      Example-Tree-Care-Dossier.md
      Example-Tree-Care-Dossier.docx
```

Pre-gather scratch and run metadata stay in temp / stdout JSON only (not in the project folder).

## Section preview

```markdown
[I] EXECUTIVE SUMMARY:
Example Tree Care LLC is a local tree service company based in Denver, CO...

[II] FIRMOGRAPHICS:
- **Name**: Example Tree Care
- **Address:** 123 Main St, Denver, CO 80014
- **Latitude:** 00.0000
- **Longitude:** 00.0000
- **Geocode source:** OpenStreetMap Nominatim
- **Geocoded address:** 123 Main Street, Denver, Valley County, Colorado, 80014, United States
...
```

## Downstream usage

After a dossier exists in `01-intake/1.1-docs/`:

- Reference `*Dossier.md` for schema / entity skills
- Postal + brand from [II] for brand SERP work
- **GBP URL** / **GBP CID** / **Place ID** from `[II]` (and Google Maps row in `[V]`) — CID URL `https://www.google.com/maps?cid={CID}` for schema `hasMap` / Maps `sameAs`. **Place ID** (`ChIJ…`) is the Local Search Grid `target_place_id`. The CID URL does not contain it.
- **Latitude** / **Longitude** from `[II]` for schema `geo` / local pack bias
