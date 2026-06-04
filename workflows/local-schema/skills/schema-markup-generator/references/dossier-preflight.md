# Business dossier preflight (Step 0)

Run **before** silo detection, page-role mapping, or any `LocalBusiness` / `Corporation` / contractor homepage `@graph` work. Aligns with `business-dossier` glob/skip rules and Semantic Links client folder convention.

## When Step 0 applies

| Scenario | Step 0 |
|----------|--------|
| Local business / contractor site (`LocalBusiness`, `Corporation`, `HomeAndConstructionBusiness`, service pages with `provider` → `#localbusiness`) | **Required** |
| Generic content-only schema (FAQ, Article, Product on non-local pages) with no NAP/GBP entity | Optional — skip if user supplies page facts |
| User explicitly says dossier is wrong / requests refresh | Re-run dossier path after confirmed NAPW + GBP URL |

## Resolve `project_dir`

- Client project folder **root** (cwd when auditing, or user-provided absolute path).
- Dossier files live at project root — **not** under `audit/`.

## Check for existing dossier (glob / skip)

1. Glob `*Dossier.md` in `project_dir` (e.g. `Woodlawn Tree Service Dossier.md`).
2. **If found** and user did **not** ask to refresh:
   - **Skip** dossier generation.
   - Load fields via `ctx_execute` / `ctx_search` on that file — do not dump full markdown into chat.
   - Proceed to schema skill **Step 0b** (`sameAs` intake), then Steps 1–5.
3. **If found** but user asked to **refresh** dossier:
   - Treat as missing for generation purposes; collect NAPW + GBP URL (below) before invoking `business-dossier`.
4. **If multiple** `*Dossier.md` files match:
   - Stop and ask which file is authoritative for this run.

## Missing dossier — stop and ask (mandatory)

**Do not** auto-run `business-dossier`, SerpAPI GBP extraction, or Grok synthesis when no current dossier exists. Wrong GBP URLs are a common source of NAP/entity errors in schema.

Ask **once** with this prompt (same fields as `business-dossier`):

> Please provide the Company Name, Address, Phone Number, Website, and Google Maps / GBP share URL for the location this schema should represent. I will run the business dossier skill first so NAP, owner, services, and socials are verified before generating JSON-LD.

| Input | Required |
|-------|----------|
| `name` | Yes |
| `address` | Yes |
| `phone` | Yes |
| `website` | Yes |
| `gbp_url` | Yes |
| `project_dir` | Yes (resolved folder root) |

**After** Bradley confirms NAPW + GBP URL:

1. Invoke **`business-dossier`** explicitly (`../business-dossier/SKILL.md`). That skill has `disable-model-invocation: true` — passive routing will not run it.
2. Wait until `{Business Name} Dossier.md` exists at project root and compose stdout shows `section_validation.ok: true` (exit 0). Do not treat exit 2 / incomplete sections as done.
3. Re-run Step 0 glob — confirm single authoritative `*Dossier.md`.
4. Continue schema generation (Steps 1–5 in main SKILL).

**Forbidden without user-supplied GBP URL:** inferring place from brand name alone, picking the first SerpAPI result, or using a competitor/old Maps link from crawl.

## Field mapping (dossier → schema)

Use verified dossier sections as the primary source for entity nodes. Prefer dossier over live WebFetch when they conflict; flag discrepancies for Bradley.

| Dossier section | Schema use |
|-----------------|------------|
| `[II] FIRMOGRAPHICS` | Legal name, `PostalAddress`, telephone, `url`, founding date |
| `[III] SCOPE OF OPERATIONS` | `areaServed` cities, core / specialized services |
| `[IV] LEADERSHIP & CREDENTIALS` | `founder` / `employee`, credentials on `Person` or `Organization` |
| `[V] DIGITAL ECOSYSTEM` | Baseline for `sameAs` after **Step 0b** user confirmation (see [sameas-intake.md](sameas-intake.md)); **ID page URL** → canonical `LocalBusiness` `@id` when present (see [dedicated-id-uri.md](dedicated-id-uri.md)) |
| `[VI] PUBLIC SENTIMENT` | Optional `aggregateRating` only when values are verified and policy-safe |
| `[VII] BUSINESS DESCRIPTION` | `description` on `LocalBusiness` / GBP-aligned copy |

## Integration

| Skill | Relationship |
|-------|----------------|
| **`business-dossier`** | Upstream — produces `{Name} Dossier.md` + `.docx` at project root |
| **`knowsabout-entity-research`** | **Step 2b** — schema-markup-generator invokes when `resources/schema/knowsabout/{slug}-knowsabout.csv` missing; see [entity-csv-preflight.md](entity-csv-preflight.md) |
| **`seo-audit-pipeline`** | Step 1 dossier skip-if-current; schema runs outside numbered audit steps unless orchestrated |

## Quick decision flow

```text
project_dir resolved?
  → glob *Dossier.md
      → found + no refresh → extract [II]–[VII] → Step 0b sameAs ask → Steps 1–2
      → missing or refresh → STOP → ask NAPW + GBP URL
          → user confirms → business-dossier → validate → Step 0b sameAs ask → Steps 1–2
Steps 1–2 (silo + page role) → Step 2b entity CSV glob
  → all *-knowsabout.csv present → Steps 3–5
  → any missing → knowsabout-entity-research → re-glob → Steps 3–5
```

## Related gate

**Step 0b — `sameAs` intake:** [sameas-intake.md](sameas-intake.md). Runs after dossier is current; do not skip for local homepage or site-wide `LocalBusiness` work.
