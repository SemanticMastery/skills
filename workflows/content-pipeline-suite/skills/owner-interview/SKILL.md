---
name: owner-interview
description: >-
  Campaign-level owner interviews: resolve the approved service-page list,
  draft every missing pack in one pass, mint one voice link per page, and
  compile answers through product-documentation refresh. Triggers on
  /owner-interview or "owner interview". Requires an explicit campaign
  directory.   (v1.2.4)
disable-model-invocation: true
metadata:
  version: "1.2.4"
---

# Owner Interview

Human-triggered skill for **one campaign**. Default path is campaign-level: one plan, one pack table, then every interview link. Turns Unknown / Unverified / Conflict fields into interview packs, writes an intake record (call notes or hosted voice), and prepares a refresh diff for `product-documentation`. Does not write visitor-facing copy. Does not host a self-serve form. Voice hosting is a separate Cloudflare Worker you deploy yourself (`voice-host/` in this package), not part of this skill folder.

| Rule | Detail |
|------|--------|
| **Campaign pin** | User must specify `campaign_dir`. Confirm the absolute path before writes. |
| **Canonical PD** | Reads `{campaign_dir}/01-intake/1.1-docs/Product-Documentation.md`. Compile writes only through `product-documentation` refresh. |
| **HITL** | One campaign-level pack table before links. After capture, operator confirms the PD refresh. Notes-to-question mapping is confirmed in chat before `--add-answer`. |
| **Records** | `{Company-Slug}-owner-interview-{scope}-{YYYY-MM-DD}.{json,md}` in `01-intake/1.1-docs/interviews/owner/`. JSON is authoritative. Legacy flat files in `1.1-docs/` still resolve. |
| **Planning files** | `{campaign_dir}/04-archives/planning/` only. |
| **Home** | This folder (next to `SKILL.md`). Voice host is `voice-host/` in the suite package. |
| **Who sends** | The IDE user / agency contact sends the list. This skill never messages the owner. |

Out of scope: self-serve hosted form, industry seeds beyond the bundled example, a second PD writer, customer research, business-dossier research, visitor copy. Creating or editing the live Retell agent, regenerating a live pack, or sending an owner link requires an explicit operator ask.

## When to use

- User says **`/owner-interview`** or **"owner interview"**
- User names a **campaign directory** that already has Product-Documentation
- After `pipeline-pages-init` `setup_complete` (approved include list) — or from the PD catalog if that manifest is missing
- Before `content-pipeline-pages` produce when PD still needs owner truth

## References

1. [references/question-taxonomy.md](references/question-taxonomy.md) — Describe / Verify / Publish?, answer shapes, who-may-answer, Publish? triggers
2. [references/schemas.md](references/schemas.md) — frozen pack and record schemas
3. [references/coverage-map.json](references/coverage-map.json) — grid-row ↔ PD-field map (copy of the `content-pipeline-pages` owner)
4. [references/industry-seeds/tree-care.md](references/industry-seeds/tree-care.md) — ask, never assert
5. Installed `product-documentation` skill folder — `SKILL.md` (refresh owner; precedence including Owner-interview tier 1b)
6. Installed `product-documentation` skill folder — `references/canonical-artifact.md` (source type, internal marker, asked-on, Evidence Notes phrases, framing-only lint)
7. Installed `content-pipeline-init` skill folder — `scripts/sync-resources.mjs` (re-sync owner after a confirmed refresh)
8. Installed `content-pipeline-pages` skill folder — `SKILL.md` (produce evidence-threshold gate, Step 0b)
9. Installed `pipeline-pages-init` skill folder — approved include list in `pipeline-pages-manifest.json`

Do not restate those skills' rules here.

## Scripts

Skill root = this folder (next to `SKILL.md`). **Node.js 20+**.


| Script | Purpose |
|--------|---------|
| `scripts/interview-gaps.mjs` | Gap extraction from PD, briefs, crawl, pasted claims |
| `scripts/interview-pack.mjs` | Validate, cap, order, render pack `.json` + `.md` |
| `scripts/interview-record.mjs` | Create record, add answers, set state / source id |
| `scripts/interview-compile-plan.mjs` | Tagged refresh diff for `product-documentation` |
| `scripts/interview-voice.mjs` | Create the host link, show status, pull a finished session |
| `scripts/interview-links.mjs` | `--plan` inventory, then mint one voice link per seated scope |

```bash
node scripts/interview-links.mjs --campaign-dir "/abs/path/to/campaign" --plan
node scripts/interview-gaps.mjs --campaign-dir "/abs/path/to/campaign" --scope deep-root-fertilization
node scripts/interview-pack.mjs --campaign-dir "/abs/path/to/campaign" --scope deep-root-fertilization --draft "/abs/path/to/draft.json"
node scripts/interview-links.mjs --campaign-dir "/abs/path/to/campaign"
node scripts/interview-links.mjs --campaign-dir "/abs/path/to/campaign" --scopes oak-wilt-treatment,deep-root-fertilization --exclude land-clearing --no-company --expires 2026-09-20
node scripts/interview-voice.mjs --campaign-dir "/abs/path/to/campaign" --scope oak-wilt-treatment --create-link
node scripts/interview-voice.mjs --campaign-dir "/abs/path/to/campaign" --scope oak-wilt-treatment --status
node scripts/interview-voice.mjs --campaign-dir "/abs/path/to/campaign" --scope oak-wilt-treatment --pull
node scripts/interview-voice.mjs --campaign-dir "/abs/path/to/campaign" --scope oak-wilt-treatment --pull --from-file export.json
node scripts/interview-record.mjs --campaign-dir "/abs/path/to/campaign" --create --scope deep-root-fertilization
node scripts/interview-record.mjs --campaign-dir "/abs/path/to/campaign" --scope oak-wilt-treatment --list-flagged
node scripts/interview-compile-plan.mjs --campaign-dir "/abs/path/to/campaign" --scope deep-root-fertilization
```

`--campaign-dir` must be absolute. JSON to stdout. Refusal: exit 1 with `{ "error": "..." }`.


---

## Step 0 — Resolve and confirm

1. Require explicit `campaign_dir` (absolute).
2. Confirm `01-intake/1.1-docs/Product-Documentation.md` exists.
3. Confirm the absolute path in chat before writes.

Default scopes = `pipeline-pages-manifest.json` `setup.pages[]` where `decision` is `include`, plus `company`. If that manifest is missing or has no includes, fall back to the PD Offering Catalog plus `company`. Use `--no-company` only when the operator says so.

## Step 1 — Plan (campaign default)

```bash
node scripts/interview-links.mjs --campaign-dir "<abs>" --plan
```

`--plan` writes nothing to the host. It prints `ready[]` (pack exists), `needs_pack[]` (draft these), and `skipped[]` (compiled / superseded).

## Step 2 — Draft every missing pack in one pass

For each `needs_pack` slug, in the same turn (not a chat round per page):

```bash
node scripts/interview-gaps.mjs --campaign-dir "<abs>" --scope <offering-or-company>
```

Draft questions from that gap list and the industry seed (`references/industry-seeds/`). The agent owns wording. Write each draft as JSON (`questions[]`) to a temp file, then:

```bash
node scripts/interview-pack.mjs --campaign-dir "<abs>" --scope <offering-or-company> --draft "<draft.json>"
```

Use `--delta` when a prior record exists for the scope. Caps and order are enforced by the script. Do not overwrite an existing interview record on the same stem (`record_exists`). Do not invent a question-template generator. Reuse existing packs (do not regenerate company / oak-wilt / already-seated packs unless the operator asks).

## Step 3 — One pack table (stop)

Show one table for every planned scope:

| scope | service title | questions | est. minutes | pack | record |
|-------|---------------|-----------|--------------|------|--------|
| … | … | N | ~M | new or existing | will-create or exists |

**Stop.** Wait for an explicit operator yes before minting links.

## Step 4 — Mint links

```bash
node scripts/interview-links.mjs --campaign-dir "<abs>"
```

In batch mode only, `interview-links.mjs` opens a record when a pack exists; single-scope `--create-link` never auto-creates a record. One resumable link per scope — not one mega-session.

**Stop.** Present the `paste_block` (also written to `{Company}-interview-links-{YYYY-MM-DD}.md`). The agency contact / IDE user sends that list. Do not message the owner.

Env for voice (User vars, never files): `RETELL_API_KEY`, `OWNER_INTERVIEW_HOST_TOKEN`, `OWNER_INTERVIEW_HOST_URL`. The page names the **agency folder** as interviewer (hyphens unwrapped; CamelCase split so `ExampleAgency` → `Example Agency`) and the **campaign folder** as the company. The `company` scope title is **Company Details**, never "Company-wide" (`Example Agency` is interviewing the owner about **Company Details** at `Ridgeline Tree Care`).

New owner links use `/i/{agency}/{session}` with the **agency folder slug** (`example-agency`, not a display-name slug). Already-sent `/s/{id}` links stay valid and must not be rewritten. Voice DNA links stay `/v/{agency}/{session}`. Expert series stay `/e/{agency}/{token}`.

Host catalog path: `voice-host/` in the suite package.

## Step 5 — After the owner finishes

Per scope (or as they complete): `--status` then `--pull`. Review `[REVIEW:]` flags with `--list-flagged`. Do not `--review --clear`, `--edit --clear`, `--accept-withdrawn`, or `--accept-pack-hash` without a per-fact or per-call instruction. Voice ends at `captured`.

```bash
node scripts/interview-voice.mjs --campaign-dir "<abs>" --scope <offering-or-company> --status
node scripts/interview-voice.mjs --campaign-dir "<abs>" --scope <offering-or-company> --pull
node scripts/interview-record.mjs --campaign-dir "<abs>" --scope <offering-or-company> --list-flagged
```

## Repair — single-scope voice

For one slug only (resume, replace a bad link). If there is no active record, run `--create` first. Never auto-create a record from `--create-link`. **Stop** and wait for an explicit operator yes before `--create-link`.

```bash
node scripts/interview-voice.mjs --campaign-dir "<abs>" --scope <offering-or-company> --create-link
```

## Notes path (optional)

Operator conducts a call, filled pack, or chat. Ask in pack order. Do not invent numbers, brands, or methods. Do not paraphrase toward specificity.

Propose a question-ID ↔ note mapping table in chat. Wait for operator confirmation. Then `--add-answer`. Unmapped notes go under `## Unmapped notes` and are never compiled. There is no `--from-notes` parser.

```bash
node scripts/interview-record.mjs --campaign-dir "<abs>" --create --scope <offering-or-company>
node scripts/interview-record.mjs --campaign-dir "<abs>" --scope <offering-or-company> --add-answer '<json>'
node scripts/interview-record.mjs --campaign-dir "<abs>" --scope <offering-or-company> --mark-unanswered --question-id <id>
```

State machine: `open → captured → compiled → superseded`. Illegal transitions exit 1.

## Step 6 — Compile plan → product-documentation

```bash
node scripts/interview-compile-plan.mjs --campaign-dir "<abs>" --scope <offering-or-company>
```

**Stop.** Hand the tagged refresh file to `product-documentation` refresh mode. Confirm with the operator before overwrite. After a confirmed refresh, write the assigned `PD-SRC-00N` back:

```bash
node scripts/interview-record.mjs --campaign-dir "<abs>" --set-source-id PD-SRC-00N
```

If refresh is declined, leave the record `captured` and save the diff under `{campaign}/04-archives/planning/owner-interview/`.

## Step 7 — Re-sync

`content-pipeline-init` `scripts/sync-resources.mjs` owns re-sync. Diff the `01-resources` Product-Documentation copy against canonical before refresh and warn when they differ. After refresh: dry-run, then the real run. Success is a `copied[]` entry, or a `skipped[]` entry with `reason: identical_dest`, for `class_id: product_doc` — not the exit code.

## Step 8 — Stop

Report pack paths, the paste-ready list path, record states, compile outcome, and re-sync result. Do not start produce. The evidence-threshold gate is owned by `content-pipeline-pages` Step 0b.
