# Greenfield stub (product-documentation)

Constrained continue-without for campaigns that have **no business dossier** and **no on-page crawl**, and that need an interview-ready canonical `Product-Documentation.md`.

This is a skill path, not a CLI. `/product-documentation --stub` or “greenfield stub” is an invocation phrase only.

## When this path applies

Use it only when:

1. Step 3 reports a missing **required** resource (dossier and/or crawl), and
2. The operator explicitly chooses **Draft greenfield stub** (or says `--stub` / “greenfield stub”), and
3. The operator has confirmed the offering list (display names that kebab to the intended interview slugs).

Do **not** enter this path from silence, from a leftover SiteSwarm CSV, or from “at least one optional file exists.”

Generic **continue-without** remains the path when other real intake documents should be synthesized under normal authority rules. Stub is the greenfield path: catalog names plus optional intake NAP only.

## Hard gates that stay in force

- Never invent a product, service, price, credential, guarantee, process, geography, or proof point.
- Do not invent a dossier or run a crawl from this path.
- Do not copy SiteSwarm, theme, or `services-export.csv` hero / process / benefits / why-choose / SEO prose into any PD field as fact, Unverified claim, or Inference.
- Do not label the stub **Approved**. Save **Draft** / **Pending** only. A later `/campaign-init` plus full product-documentation refresh or rebuild replaces this file.
- Step 2 still applies: never overwrite an existing canonical PD without explicit operator confirmation.

## Allowed sources

| Source | Use |
|---|---|
| Operator-confirmed offering list | Catalog names only. The display name must kebab to the intended `/owner-interview` scope (`Tree Removal` → `tree-removal`). |
| Intake NAP from a named campaign file or Wayfront order | Company name, address, phone, planned website. Label `Unverified company claim`. Not a dossier. |
| Optional names/slugs file | Cite only if the operator used it to propose the list. Record in the ledger that marketing columns were excluded. |

## Forbidden sources (do not ingest as product truth)

- SiteSwarm dataset records, theme copy, staging page copy
- CSV / export columns other than title and slug
- Industry-seed methods, typical prices, credential assumptions
- GBP or website claims when those surfaces are not live and not crawled

## Draft recipe

Follow [canonical-artifact.md](canonical-artifact.md) headings exactly. Do not split `Pricing, Packaging, and CTA` or omit a profile `####` field.

### Header

```markdown
**Status:** Draft
**Approval:** Pending
**Source coverage:** Stub — no dossier, no on-page crawl. [Operator offering list; intake NAP if used.]
```

`Source coverage` must include the exact phrase `Stub — no dossier, no on-page crawl`.

### Purpose and Authority

State that this document owns stable product/service facts only, that this revision is a greenfield stub, and that audience / offer-lock / campaign messaging / `sources.json` remain out of scope.

### Company Offering Summary

- Unverified intake name (and only other NAP facts the intake supports), each cited.
- `Unknown` for portfolio narrative beyond the confirmed catalog names.
- Do not write a marketing summary.

### Offering Catalog

One row per confirmed offering. Evidence status **must** be `Unverified` (the catalog enum has no `Unknown`).

| Column | Stub value |
|---|---|
| Offering | Operator-confirmed display name (kebab-safe) |
| Type | `Unknown` |
| Primary outcome | `Unknown` |
| Geography / eligibility | `Unknown`, unless a named intake source supports an Unverified NAP/geo fragment |
| Evidence status | `Unverified` |

### Product and Service Profiles

One `###` heading per catalog name (exact string match). Every required `####` field is present and the body is `Unknown` (Evidence Notes may add `Unknown — greenfield stub…` plus the offering-list source ID). Do not fill Type, process, benefits, or related-offering links from industry knowledge.

### Company H2 sections (required for `/owner-interview` company gaps)

Keep every required H2. Use `Unknown` where there is no intake fact. Use `Unverified company claim` only for named intake NAP/geo.

| Section | Stub content |
|---|---|
| Cross-Offering Capabilities | `Unknown` |
| Credentials, Standards, and Risk Controls | Table or prose containing `Unknown` |
| Service Geography and Eligibility | Unverified intake NAP if present; `Unknown` for service area, radius, property types |
| Proof and Documented Claims | Table or prose containing `Unknown` |
| Conflicts and Verification Needs | Numbered items for stub limits (planned site, pending GBP) — not invented product conflicts |
| Open Questions | Numbered items below |

### Open Questions (required items)

1. `Waived required resource: Business Dossier (greenfield stub)`
2. `Waived required resource: Onpage Crawl Report (greenfield stub)`
3. `Stub: replace this Product Documentation on /campaign-init + full product-documentation refresh when dossier and crawl exist`
4. `EntityMap absent` when no EntityMap file exists
5. Any other material Unknown the operator should resolve (offerings, credentials, proof) — do not invent the answers

### Source Ledger

Typical stub IDs:

| Source ID | Type | Limitations |
|---|---|---|
| `PD-SRC-001` | Operator offering list | Names/slugs only. Not process, price, or proof. |
| `PD-SRC-002` | Campaign intake (Wayfront order and/or `CAMPAIGN-CONTEXT.md`) | NAP Unverified. Not a dossier. Website may be planned / not live. |

Cite a names/slugs CSV only when the operator used it, and state that marketing columns were excluded.

## After save

Tell the operator that `/owner-interview --plan` can now resolve scopes from this catalog. Do not mint interview links, message the owner, publish a site, or compose a dossier from this path.
