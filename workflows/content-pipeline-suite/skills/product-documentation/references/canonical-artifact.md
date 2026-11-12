# Canonical Product Documentation Artifact

The only canonical filename is `Product-Documentation.md`.

The one canonical file is `{campaign-root}/01-intake/1.1-docs/Product-Documentation.md`. `{campaign-root}/06-content-pipeline/01-resources/Product-Documentation.md` is a mirror that `content-pipeline-init` sync refreshes from it; never write the mirror.

## Required document structure

```markdown
# Product Documentation — [Company]

**Status:** Draft | Approved
**Approval:** Pending | Approved - Product Documentation
**Last updated:** YYYY-MM-DD
**Company:** [Name]
**Source coverage:** [Dossier, on-page crawl, entity map if present, and other inputs. Greenfield stub must include: Stub — no dossier, no on-page crawl]

## Purpose and Authority

## Company Offering Summary

## Offering Catalog

| Offering | Type | Primary outcome | Geography / eligibility | Evidence status |
|---|---|---|---|---|

## Product and Service Profiles

### [Offering name]

#### Category and Type
#### Description
#### Customer Problem
#### Outcomes and Benefits
#### Scope and Inclusions
#### Delivery Process
#### Differentiators
#### Credentials and Proof
#### Geography and Eligibility
#### Pricing, Packaging, and CTA
#### Constraints and Exclusions
#### Related Offerings
#### Evidence Notes

## Cross-Offering Capabilities

## Credentials, Standards, and Risk Controls

## Service Geography and Eligibility

## Proof and Documented Claims

## Conflicts and Verification Needs

## Open Questions

## Source Ledger

| Source ID | File | Type | Section | Upstream URL | Date | Authority | Limitations |
|---|---|---|---|---|---|---|---|
```

## Section rules

### Purpose and Authority

State that this document owns stable product/service facts only. Explicitly defer audience facts to approved ICP, campaign offer choices to approved `offer-lock.json`, campaign messaging to approved campaign `product-marketing.md`, and public-claim evidence to campaign `sources.json`.

### Company Offering Summary

Summarize the offering portfolio without collapsing distinct products or services. Cite every factual sentence.

### Offering Catalog

Include every offering supported by an input source. Use the source's natural business terminology. Evidence status must be one of:

- `Supported`
- `Partially supported`
- `Unverified`
- `Conflict`

### Product and Service Profiles

Create exactly one profile per catalog row. Keep every listed subheading, using `Unknown` where source material does not support an answer.

- **Category and Type:** Product, managed service, professional service, assessment, maintenance, emergency service, seasonal service, or another supported type.
- **Description:** What the offering is and does.
- **Customer Problem:** The operational or practical problem addressed. Do not import an ICP-specific pain unless an intake source states it as general offering context.
- **Outcomes and Benefits:** Documented outcomes, separated from unsupported promises.
- **Scope and Inclusions:** Components, tasks, deliverables, equipment, or service boundaries.
- **Delivery Process:** Supported sequence, prerequisites, and handoffs.
- **Differentiators:** Only documented differences; do not create competitive claims.
- **Credentials and Proof:** Licenses, standards, reviews, metrics, or examples, with verification state.
- **Geography and Eligibility:** Locations, customer types, property types, minimums, and exclusions when documented.
- **Pricing, Packaging, and CTA:** Exact pricing only when documented. Otherwise state `Unknown` and preserve the documented conversion action.
- **Constraints and Exclusions:** Safety limits, dependencies, caveats, and not-a-fit conditions.
- **Related Offerings:** Supported dependencies, bundles, prerequisites, or follow-on work.
- **Evidence Notes:** Source citations plus any inference, conflict, or verification warning.

### Cross-document controls

- Cite each fact with one source id: `[PD-SRC-001]`. Do not write a multi-id token such as `[PD-SRC-001; PD-SRC-002]`. Split the sentence so each fact has its own token.
- Label an inference as `Inference — ...`; cite the supporting facts.
- Label an unresolved discrepancy as `Conflict — operator review required`.
- Label an unsupported company assertion as `Unverified company claim`.
- Use `Unknown` rather than filling gaps with general industry knowledge.

### Owner-interview conventions

These labels are additions beside the existing field labels. They do not replace the 13 profile subheadings or the Source Ledger shape.

- Source type: `Owner interview`.
- Field marker (internal answers): `Internal — not for publication [PD-SRC-00N]`. The marker names the interview source and carries no vendor, price, or method detail.
- Open Questions: one entry per field; when a question was asked and left unanswered, append `asked on {date}` (further dates append to the same entry).
- Evidence Notes phrases: `refuted by owner interview [PD-SRC-00N]` and `revised {date}`.
- Framing-only / internal lint: after stripping `[PD-SRC-00N]` citation tokens, the PD field text contains no digit, currency symbol, `%`, or industry-seed brand token. The compile plan owns the lint; refresh refuses a hunk that fails it.

### Greenfield stub conventions

These apply only when the operator chose the stub path in [greenfield-stub.md](greenfield-stub.md). They do not replace the required headings or Source Ledger shape.

- `**Status:** Draft` and `**Approval:** Pending`. Do not set Approved on a stub.
- `**Source coverage:**` must include the exact phrase `Stub — no dossier, no on-page crawl`.
- Offering Catalog **Evidence status** for stub rows is `Unverified` (this column has no `Unknown` value). Type, primary outcome, and geography stay `Unknown` unless a named intake source supports an Unverified NAP/geo fragment.
- Every profile `####` field is present and `Unknown`. Do not copy SiteSwarm/CSV/theme marketing prose into a field.
- Company H2 sections stay present. Use `Unverified company claim` only for named intake NAP. Use `Unknown` everywhere else.
- Open Questions must list waived dossier, waived crawl, and replace-on-`/campaign-init` + full refresh.

### Source Ledger

Use local source filenames as the primary provenance record. Preserve URLs quoted in source material but do not imply that they were independently fetched or validated.

`Type` is one of these values, spelled this way:

- `Owner interview`
- `On-page crawl`
- `Entity map`
- `Business dossier`
- `Operator`

Source IDs are append-only during refresh. Retain an existing ID when the same source remains in use.

## Approval rule

An approved document must contain both:

```markdown
**Status:** Approved
**Approval:** Approved - Product Documentation
```

No other wording satisfies the downstream campaign approval preflight.
