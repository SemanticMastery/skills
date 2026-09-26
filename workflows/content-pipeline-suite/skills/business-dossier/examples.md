# Business Dossier — Examples

## Invocation (chat)

```
/business-dossier

Name: Arbor Max Tree Service
Address: 1206 Carbon St Suite 200, Reading, PA 19601
Phone: (484) 878-8947
Website: https://www.arbormaxpa.com/
GBP: https://maps.app.goo.gl/...
Project folder: your project root (dossier → outputs/business-dossier/)
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
  --address "123 Main St, Austin, TX 78701" \
  --phone "(512) 555-0100" \
  --website "https://example.com/" \
  --gbp-url "https://maps.app.goo.gl/EXAMPLE" \
  --project-dir "/absolute/path/to/project"
```

Compose resolves share / maps.app / place URLs to `https://www.google.com/maps?cid={CID}` before writing `[II]` / `[V]`. If CID cannot be resolved, it stops.

## Expected deliverables

```text
your-project/
  outputs/
    business-dossier/
      Example-Tree-Care-Dossier.md
      Example-Tree-Care-Dossier.docx
```

Pre-gather scratch and run metadata stay in temp / stdout JSON only (not in the project folder).

## Section preview

```markdown
[I] EXECUTIVE SUMMARY:
Example Tree Care LLC is a local tree service company based in Austin, TX...

[II] FIRMOGRAPHICS:
- **Name:** Example Tree Care
- **Address:** 123 Main St, Austin, TX 78701
- **Latitude:** 30.2672
- **Longitude:** -97.7431
- **Geocode source:** OpenStreetMap Nominatim
- **Geocoded address:** 123 Main Street, Austin, Travis County, Texas, 78701, United States
...
```

## Downstream usage

After a dossier exists in `outputs/business-dossier/`:

- Reference `*Dossier.md` for schema / entity skills
- Postal + brand from `[II]` for brand SERP work
- **GBP URL** / **GBP CID** from `[II]` (and Google Maps row in `[V]`) — CID URL `https://www.google.com/maps?cid={CID}` for schema `hasMap` / Maps `sameAs`
- **Latitude** / **Longitude** from `[II]` for schema `geo` / local pack bias
