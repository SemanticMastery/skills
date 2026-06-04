# Business Dossier — Examples

## Invocation (chat)

```
/business-dossier

Name: Arbor Max Tree Service
Address: 1206 Carbon St Suite 200, Reading, PA 19601
Phone: (484) 878-8947
Website: https://www.arbormaxpa.com/
GBP: https://maps.app.goo.gl/...
Project folder: current directory
```

```
Compose a Glen Patel business dossier before we start the SEO audit.
GBP URL is https://share.google/...
```

```
Dry run the business dossier script — check keys and output paths only.
```

## ctx_batch_execute (production)

```json
{
  "commands": [{
    "label": "box-tree-care-dossier",
    "command": "node \"{{BUNDLE_ROOT}}/scripts/seo/compose-business-dossier.mjs\" --name \"Box Tree Care\" --address \"1833 Baranco Way, Leander, TX 78641\" --phone \"(737) 777-8022\" --website \"https://boxtreecare.com/\" --gbp-url \"https://maps.app.goo.gl/EXAMPLE\" --project-dir \"{{PROJECT_DIR}}\""
  }],
  "queries": ["ok", "markdown", "docx", "section_validation", "EXECUTIVE SUMMARY"],
  "timeout": 600000,
  "concurrency": 1
}
```

## Expected deliverables

```
box-tree-care/
  Box Tree Care Dossier.md
  Box Tree Care Dossier.docx
  (no .json/.log in project folder — validation is stdout JSON only)
```

## Section preview (from production dossier)

```markdown
[I] EXECUTIVE SUMMARY:
Box Tree Care LLC is a very new tree service company based in Leander, TX...

[II] FIRMOGRAPHICS:
- **Name**: Box Tree Care (legal: BOX TREE CARE LLC)
...
```

## Downstream usage

After dossier exists:

- `@Box Tree Care Dossier.md` for schema markup skill
- Postal + brand from [II] for `serpapi-brand-serp-audit`
- GBP URL + project_dir for `gbp-category-entity-breakdown` → `audit/` artifacts
