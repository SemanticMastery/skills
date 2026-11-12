# 07-claims-audit — Context

## Job

Hold the claims ledger, Content Gaps report, and page snapshots that `claims-audit` writes for this campaign. Not a blog stage and not a service-page stage.

## Inputs

- The skill reads the dossier, the on-page crawl, and canonical Product-Documentation from the campaign. It does not expect those files copied here.
- On-page crawl files stay in `01-intake/1.2-audit`.

## Process

1. Run `claims-audit` with an explicit campaign directory.
2. The skill writes only under this folder.
3. Service-page copy stays in `06-pages/`. Blog produce stays in `03-write/`.

## Outputs

- Claims ledger
- Content Gaps report
- Page snapshots and run records

## Notes

- The template ships this folder empty aside from this router.
- Each campaign duplicate keeps its own audit outputs.
