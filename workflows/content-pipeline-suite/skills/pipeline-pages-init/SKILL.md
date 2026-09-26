---
name: pipeline-pages-init
description: >-
  Inventory campaign service pages from the on-page crawl and product
  documentation, reconcile leftovers with the operator, confirm commercial-
  intent seeds, then run one Content Maxima Matrix per approved page. Writes
  06-content-pipeline/pages/ and pipeline-pages-manifest.json. Does not write
  blog copy. Triggers on /pipeline-pages-init or "pipeline pages init".
  Requires an explicit campaign directory. (v1.0.0)
disable-model-invocation: true
metadata:
  version: "1.0.0"
---

# Pipeline Pages Init

Human-triggered setup for **one campaign**. Sibling of `content-pipeline-init`. Not a mode of `content-pipeline-run`.

| Rule | Detail |
|------|--------|
| **Campaign pin** | User must specify `campaign_dir`. Confirm the absolute path before writes. |
| **Resources first** | Requires `06-content-pipeline/01-resources/` on-page crawl + `Product-Documentation.md` (from `content-pipeline-init`). |
| **HITL** | Stop for leftover decisions, then again for the seed table. Do not start Matrix until both are confirmed. |
| **Matrix** | One approved page at a time via the `contentmaxima` tooling. Official `Tools/Matrix.ts` (`npx --yes tsx` on Windows). Report Playwright/login blocks; no manual substitute. |
| **Copy-if-missing** | Scaffold never overwrites an existing campaign `CONTEXT.md`. |
| **Manifest SoT** | `{campaign_dir}/06-content-pipeline/pipeline-pages-manifest.json` |
| **Planning files** | `{campaign_dir}/04-archives/planning/` only. |

Out of scope: blog produce, image generation, CMS push, location pages.

## When to use

- User says **`/pipeline-pages-init`** or **"pipeline pages init"**
- User names a **campaign directory** that already has a `content-pipeline-init` resource pack

## Companion skills (install separately)

| Role | Companion skill |
|------|-----------------|
| Prerequisite | `content-pipeline-init` (fills `01-resources/`) |
| Matrix execution | `contentmaxima` (or your own Content Maxima Matrix export) |
| Next (produce) | `content-pipeline-pages` (one approved slug through polish) |
| Evidence repair | `owner-interview` (when the produce evidence gate blocks a slug) |

The page stage prompts ship in this skill's `templates/pages/`. You do not need the blog ICM template for the pages track.

## References

1. [references/manifest-schema.md](references/manifest-schema.md)
2. [references/seed-rules.md](references/seed-rules.md)
3. The installed `content-pipeline-run` skill folder — `references/gate-modes.md`, `references/copywriting-model.md`, `references/voice-dna.md` are cited by the produce sibling, not copied here

## Scripts

Skill root = this folder (next to `SKILL.md`). **Node.js 20+**. Pass absolute `--campaign-dir`.

| Script | Purpose |
|--------|---------|
| `scripts/scaffold-pages.mjs` | Copy-if-missing `pages/` + starter manifest |
| `scripts/extract-pages.mjs` | Crawl vs catalog table; `--write` updates manifest |
| `scripts/pages-manifest.mjs` | `--decide`, `--approve-list`, `--apply-seeds`, `--set-seed`, `--record-matrix`, `--setup-complete`, `--next-matrix`, `--write-projection` |

```bash
node scripts/scaffold-pages.mjs --campaign-dir "/abs/path/to/campaign"
node scripts/extract-pages.mjs --campaign-dir "/abs/path/to/campaign" --write
node scripts/pages-manifest.mjs --campaign-dir "/abs/path/to/campaign" --approve-list --apply-seeds --write-projection
```

---

## Step 0 — Resolve and confirm

1. Require explicit `campaign_dir`.
2. Confirm `06-content-pipeline/01-resources/` has an `onpage-crawl-*.csv` and `Product-Documentation.md`.
3. Confirm the absolute path in chat before writes.

## Step 1 — Scaffold

```bash
node scripts/scaffold-pages.mjs --campaign-dir "<abs>"
```

Creates `pages/` (copy-if-missing) and `pipeline-pages-manifest.json` if missing.

## Step 2 — Extract

```bash
node scripts/extract-pages.mjs --campaign-dir "<abs>" --write
```

The table sorts every page into three buckets. A typical first run on a ten-offering site looks like **7 both / 1 crawl-only / 2 catalog-only**:

| Bucket | Meaning | Default |
|--------|---------|---------|
| both | Live URL in the crawl **and** an offering in product documentation | include |
| crawl-only | A live page with no offering behind it (retired service, stray URL) | operator decides |
| catalog-only | An offering with no live page yet (new service to launch) | operator decides |

Stops before any Matrix.

## Step 3 — Reconcile HITL (stop)

Show the reconciled page table. The `both` intersection is the default include set. Leftovers stay flagged until the operator chooses include / skip / defer.

```bash
node scripts/pages-manifest.mjs --campaign-dir "<abs>" --decide retired-service skip
node scripts/pages-manifest.mjs --campaign-dir "<abs>" --decide land-clearing defer
node scripts/pages-manifest.mjs --campaign-dir "<abs>" --approve-list --write-projection
```

Do not continue until the operator OKs the table.

## Step 4 — Seed HITL (stop)

```bash
node scripts/pages-manifest.mjs --campaign-dir "<abs>" --apply-seeds --write-projection
```

Show the seed table. Confirm before any Matrix. Status must be `awaiting_seed_confirm`.

## Step 5 — Matrix loop

For each approved page without a `*_matrix*` file:

1. `node scripts/pages-manifest.mjs --campaign-dir "<abs>" --next-matrix`
2. From the Content Maxima tooling root (Windows):

```powershell
cd $env:CONTENT_MAXIMA_SKILL_ROOT
npx --yes tsx Tools/Matrix.ts "<seed>" --output "<campaign>/06-content-pipeline/pages/matrix/<slug>"
```

3. Record:

```bash
node scripts/pages-manifest.mjs --campaign-dir "<abs>" --record-matrix <slug> --matrix-path "<xlsx>" --matrix-status recorded
```

Resume skips a slug whose `matrix/{slug}/` folder already holds `*_matrix*`. If Playwright/login is blocked, report it and stop. Degraded/reverse-engineered path only after the operator accepts.

## Step 6 — Setup complete + optional router row

```bash
node scripts/pages-manifest.mjs --campaign-dir "<abs>" --setup-complete --write-projection
```

Propose one task routing row on `06-content-pipeline/CONTEXT.md`:

`Service page copy → pages/CONTEXT.md`

Append only after operator OK.

Then hand off to `content-pipeline-pages` for one approved slug. That skill stops before the brief and asks for Algorithm Trigger Words (or authorization to use Count 40+ defaults).
