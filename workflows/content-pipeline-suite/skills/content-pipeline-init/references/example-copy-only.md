# Example: copy-only path

When all eight resource classes already exist under the campaign (intake or outputs):

1. User supplies `campaign_dir`.
2. Scaffold `06-content-pipeline/` from Content-Pipeline-ICM (no-op if complete).
3. Inventory → 8/8 present → **no** companion waves, **no** keyword gate.
4. Sync copies into `06-content-pipeline/01-resources/` (dossier `.md` only).
5. Write or reuse `02-plan/editorial-roadmap.md` (ask 13 vs 26 if missing).
6. Write `02-plan/siteswarm-tag-taxonomy.md` from roadmap clusters.
7. Manifest `status: init_complete` only when resources **and** both plan artifacts exist.

## Keyword-gate behavior (gaps)

If matrix / personas / paa / fanout are missing:

- Hard-stop with `manifest.status = awaiting_keywords`
- Ask the operator for keywords and (if PAA missing) location
- Do **not** infer seeds from campaign context or dossier
