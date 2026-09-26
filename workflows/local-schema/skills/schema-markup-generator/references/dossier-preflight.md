# Business dossier preflight (Step 0)

Run **before** silo detection, page-role mapping, or any `LocalBusiness` / `Corporation` / contractor homepage `@graph` work. Aligns with `business-dossier` glob/skip rules and Semantic Links Golden Image ICM convention.

## When Step 0 applies

| Scenario | Step 0 |
|----------|--------|
| Local business / contractor site (`LocalBusiness`, `Corporation`, `HomeAndConstructionBusiness`, service pages with `provider` → `#localbusiness`) | **Required** |
| Generic content-only schema (FAQ, Article, Product on non-local pages) with no NAP/GBP entity | Optional — skip if user supplies page facts |
| User explicitly says dossier is wrong / requests refresh | Re-run dossier path after confirmed NAPW + GBP URL |

## Resolve `project_dir`

- **Campaign folder root** (cwd when auditing, or user-provided absolute path).
- On Semantic Links Ops / Golden Image ICM campaigns, intake prerequisites live under **`01-intake/1.1-docs/`** — not campaign root, not `audit/`, not `02-deliverables/`.

## Ops / Golden Image ICM — hard gate (always)

When `project_dir` is a Semantic Links Ops campaign or Golden Image ICM tree (markers: `01-intake/`, `02-deliverables/`, `CAMPAIGN-CONTEXT.md`, or path under `1-Clients/` / SharePoint Provisioning):

1. **Always open the intake docs folder first** — resolve the absolute path `{project_dir}/01-intake/1.1-docs/` and **list that directory** (PowerShell `Get-ChildItem` / equivalent). Do **not** decide “no dossier” from a campaign-root recursive glob alone.
2. **Canonical dossier match** in that folder: `*Dossier.md` (prefer hyphenated `{Business-Name}-Dossier.md`).
3. **Related intake prerequisites** (read when present; do not invent if missing):

| File pattern in `01-intake/1.1-docs/` | Role for schema |
|-------------------------------------|-----------------|
| `*Dossier.md` | **Required** for local/contractor `LocalBusiness` / `Corporation` — NAP, services, `sameAs` baseline, ID URI hints |
| `*EntityMap.md` / `*entitymap.json` | Optional entity / page map cross-check |
| `Product-Documentation.md` | Optional service naming / offer language |
| `*-ICP-Companion.md` | Optional audience language — not a substitute for dossier |

4. **False-negative guard:** If a recursive `*Dossier.md` search from campaign root returns empty, **retry by listing `01-intake/1.1-docs/` directly**. SharePoint / Files On-Demand can make root recursive filters miss hydrated files; a direct folder listing is authoritative.
5. **Only after** a successful listing of `1.1-docs/` with zero `*Dossier.md` matches may you treat the dossier as missing and ask for NAPW + GBP URL.
6. Campaign-root `*Dossier.md` remains a **legacy fallback** after the `1.1-docs/` listing confirms absence — never the primary probe on Ops ICM campaigns.

## Check for existing dossier (glob / skip)

1. **List** `{project_dir}/01-intake/1.1-docs/` and match `*Dossier.md` (canonical — hyphenated filenames going forward, e.g. `Example-Tree-Care-Dossier.md`).
2. **If not found there**, glob `*Dossier.md` at `{project_dir}` campaign root (legacy — may use spaces, e.g. `Example Tree Care Dossier.md`).
3. **If found** and user did **not** ask to refresh:
   - **Skip** dossier generation.
   - Load fields via `ctx_execute` / `ctx_search` on that file — do not dump full markdown into chat.
   - Proceed to schema skill **Step 0b** (`sameAs` intake), then Step 0c, then Steps 1–5.
4. **If found** but user asked to **refresh** dossier:
   - Treat as missing for generation purposes; collect NAPW + GBP URL (below) before invoking `business-dossier`.
5. **If multiple** `*Dossier.md` files match across canonical + legacy paths:
   - Prefer the file under `01-intake/1.1-docs/`. If still ambiguous, stop and ask which file is authoritative.

## Missing dossier — stop and ask (mandatory)

**Do not** auto-run `business-dossier`, SerpAPI GBP extraction, or Grok synthesis when no current dossier exists. Wrong GBP URLs are a common source of NAP/entity errors in schema.

Ask **once** with this prompt (same fields as `business-dossier`):

> Please provide the Company Name, Address, Phone Number, Website, and Google Maps / GBP URL (share, maps.app, or `https://www.google.com/maps?cid=…`) for the location this schema should represent. I will run the business dossier skill first so NAP, owner, services, and socials are verified before generating JSON-LD.

| Input | Required |
|-------|----------|
| `name` | Yes |
| `address` | Yes |
| `phone` | Yes |
| `website` | Yes |
| `gbp_url` | Yes |
| `project_dir` | Yes (campaign folder root) |

**After** Bradley confirms NAPW + GBP URL:

1. Invoke **`business-dossier`** explicitly (`business-dossier/SKILL.md`). That skill has `disable-model-invocation: true` — passive routing will not run it.
2. Wait until `{Business-Name}-Dossier.md` exists in `01-intake/1.1-docs/` and compose stdout shows `section_validation.ok: true` (exit 0). Do not treat exit 2 / incomplete sections as done.
3. Re-list `01-intake/1.1-docs/` — confirm single authoritative `*Dossier.md` (or note legacy root location if not yet migrated).
4. Continue schema generation (Step 0b → 0c → Steps 1–5 in main SKILL). A newly landed dossier does **not** skip Step 0c — re-run 0c or confirm the prior qualifying answer (paste / **"extract from GBP/site"** / **"omit media and geo"**). “Proceed” / “generate schema” / “dossier is ready” do **not** skip 0c.
5. **Maps CID preflight:** Before writing `hasMap` or Maps `sameAs`, `[II]` / `[V]` GBP identity must be `https://www.google.com/maps?cid={CID}`. Run `scripts/resolve-maps-cid.mjs --url "…"`. If CID cannot be resolved, **stop and ask** — do not ship `maps.app.goo.gl` or `share.google`.

**Forbidden without user-supplied GBP URL:** inferring place from brand name alone, picking the first SerpAPI result, or using a competitor/old Maps link from crawl.

## Field mapping (dossier → schema)

Use verified dossier sections as the primary source for entity nodes. Prefer dossier over live WebFetch when they conflict; flag discrepancies for Bradley.

| Dossier section | Schema use |
|-----------------|------------|
| `[II] FIRMOGRAPHICS` | Legal name, `PostalAddress`, telephone, `url`, founding date; **GBP URL:** must be `https://www.google.com/maps?cid={CID}`; **GBP CID:** is first-class (raw Company ID) |
| `[III] SCOPE OF OPERATIONS` | `areaServed` cities, core / specialized services |
| `[IV] LEADERSHIP & CREDENTIALS` | `founder` / `employee`, credentials on `Person` or `Organization` |
| `[V] DIGITAL ECOSYSTEM` | Baseline for `sameAs` after **Step 0b** user confirmation (see [sameas-intake.md](sameas-intake.md)); **Google Maps (GBP)** row must be the CID URL (same as `[II]` **GBP URL:**) → schema `hasMap` and Maps `sameAs`. If `[V]` is only a share / maps.app URL, run `scripts/resolve-maps-cid.mjs` and rewrite **before** JSON-LD. **ID page URL** → canonical `LocalBusiness` `@id` when present (see [dedicated-id-uri.md](dedicated-id-uri.md)) |
| `[VI] PUBLIC SENTIMENT` | Optional `aggregateRating` only when values are verified and policy-safe |
| `[VII] BUSINESS DESCRIPTION` | `description` on `LocalBusiness` / GBP-aligned copy |

## Integration

| Skill | Relationship |
|-------|----------------|
| **`business-dossier`** | Upstream — produces `{Business-Name}-Dossier.md` + `.docx` in `01-intake/1.1-docs/` |
| **`knowsabout-entity-research`** | **Step 2b** — schema-markup-generator invokes when `02-deliverables/2.4-schema/knowsabout/{slug}-knowsabout.csv` missing; see [entity-csv-preflight.md](entity-csv-preflight.md) |
| **`seo-audit-pipeline`** | Step 1 dossier skip-if-current; schema runs outside numbered audit steps unless orchestrated |

## Quick decision flow

```text
project_dir resolved (campaign root)?
  → LIST 01-intake/1.1-docs/ (absolute path; Ops ICM hard gate)
      → *Dossier.md present + no refresh → extract [II]–[VII] → Step 0b → Step 0c → Steps 1–2
      → folder empty of *Dossier.md → glob campaign-root *Dossier.md (legacy)
      → still missing or refresh → STOP → ask NAPW + GBP URL
          → user confirms → business-dossier → write to 1.1-docs → re-list → Step 0b → Step 0c → Steps 1–2
Steps 1–2 (silo + page role) → Step 2c (location pages: ContentMaxima soft stop) → Step 2b entity CSV glob
  → all *-knowsabout.csv present (new geo-trigger names merged) → Steps 3–5
  → any missing → knowsabout-entity-research → re-glob → Steps 3–5
```

## Related gates

**Step 0b — `sameAs` intake:** [sameas-intake.md](sameas-intake.md). Runs after dossier is current; dossier alone does **not** skip the ask for local homepage or site-wide `LocalBusiness` work.

**Step 0c — logo / image / geo intake:** [media-geo-intake.md](media-geo-intake.md). Runs after Step 0b; stop until user pastes values, says **"extract from GBP/site"**, or **"omit media and geo"**. “Proceed” / “generate schema” / “dossier is ready” do **not** skip. After a dossier lands mid-thread, re-run 0c or confirm the prior qualifying answer.

**Maps CID preflight:** `hasMap` and Maps `sameAs` must be `https://www.google.com/maps?cid={CID}`. Resolve share / maps.app / place URLs with `scripts/resolve-maps-cid.mjs` (or `business-dossier/scripts/resolve-maps-cid.mjs`). Stop if unresolved.

**Step 2c — ContentMaxima location preflight:** [contentmaxima-location-preflight.md](contentmaxima-location-preflight.md). After page role, before entity CSV. Soft stop on dedicated location pages unless a matrix / `{slug}-geo-triggers.csv` is already on disk.
