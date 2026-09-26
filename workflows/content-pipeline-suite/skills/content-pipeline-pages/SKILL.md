---
name: content-pipeline-pages
description: >-
  Produce one approved campaign service page through brief → draft → edit →
  polish. Requires pipeline-pages-init setup_complete and that page's Matrix.
  Session-only copy in v1. Anthropic/Claude is prohibited, including inherit
  on a Claude chat. Stops after sectioned polish. No images, no CMS push.
  Triggers on /content-pipeline-pages or "content pipeline pages". Requires
  campaign_dir and slug.   Before the brief, stop and ask for Matrix
  terms (or authorize Count 40+ defaults). Use those terms in
  headings and, when they fit, in body copy. Write body copy at
  a 7th-8th grade reading level. Polish emits two builder
  zones (main + FAQs) in Markdown and HTML. SEO title is
  [Service] | [Company]. H1 restates, does not repeat,
  that service (Ads headline; service area allowed).
  FAQ answers answer the question first. (v1.2.2)
disable-model-invocation: true
metadata:
  version: "1.2.2"
---

# Content Pipeline Pages

Human-triggered produce for **one approved service page**. Sibling of `content-pipeline-run`. Not a fork or `content_kind` mode.

| Rule | Detail |
|------|--------|
| **Campaign pin** | Require `campaign_dir` + `slug`. Confirm the absolute path before writes. |
| **Init gate** | `pipeline-pages-manifest.json` `setup.status = setup_complete` and that slug’s Matrix. Else hard-stop → run `pipeline-pages-init`. |
| **Gate mode** | Ask once: `review` or `auto`. Owner: the installed `content-pipeline-run` skill folder, `references/gate-modes.md`. |
| **Copywriting model** | Session only in v1 (`copywriting_via = session`). `inherit` or a pinned non-Anthropic id. **Anthropic/Claude is refused**, including `inherit` on a Claude chat. Owner: the installed `content-pipeline-run` skill folder, `references/copywriting-model.md`. Cursor-session suggestion: Grok 4.6 or ChatGPT-5.6 Terra (`cursor-grok-4.6-high-fast` / `gpt-5.6-terra-medium`). |
| **Voice DNA** | 0 / 1 / 2+ rule. Owner: the installed `content-pipeline-run` skill folder, `references/voice-dna.md`. |
| **ai-isms** | Read `01-resources/ai-isms.md` when present. |
| **One page / one invoke** | Write only that slug’s stage artifact under `pages/`. |
| **Stop after polish** | No image generation, no `04-publish/`, no CMS push, no `[IMAGE:` in the body. |
| **Matrix terms** | Before the brief: stop and ask for specific Algorithm Trigger Words, or authorization to use the default high-impact list (`Count >= 40`). Do not write the brief until `runs[slug].matrix_terms` is set. Use selected terms in headings/subheadings and sprinkle them through body copy when they fit. Owner: [references/matrix-terms.md](references/matrix-terms.md). |
| **FAQs** | Optional. Ask whether to generate an FAQ block. If yes, use DataForSEO PAA first (`dataforseo-paa-queries`). Answers must answer the question first, then name the campaign. Owner: [references/faqs.md](references/faqs.md). |
| **Reading level** | Visitor-facing copy (draft, edit, polish, FAQs, H1, meta) reads at a **7th–8th grade** level for a general market. SEO title follows title-h1, not grade-level prose. Owner: [references/reading-level.md](references/reading-level.md). |
| **SEO title / H1** | Title is `[Service Name] \| [Company Name]` only (no location). H1 restates (does not repeat) that service as a close variant. Service area allowed. Word it like a Google Ads headline: relevant and compelling. Do not reuse the title’s service string with only a location or tiny add-on. Owner: [references/title-h1.md](references/title-h1.md). |
| **Polish output** | Two builder zones: top of page (main copy) and bottom of page (FAQs). Each zone in Markdown and in `<article>` HTML (no full page). Owner: [references/polish-output.md](references/polish-output.md). |

Do not copy the blog reference files into this skill. Cite them.

## When to use

- User says **`/content-pipeline-pages`** or **"content pipeline pages"**
- Setup is complete and they name one approved slug

## Companion skills (install separately)

| Role | Companion skill |
|------|-----------------|
| Prerequisite | `pipeline-pages-init` (`setup_complete` + that slug's Matrix) |
| Shared contracts | `content-pipeline-run` (gate modes, copywriting model, Voice DNA) |
| Evidence repair | `owner-interview` (run it when Step 0b blocks the slug) |
| Optional FAQs | `dataforseo-paa-queries` |

Install `content-pipeline-run` alongside this skill even if you never produce blog posts — it owns the three shared contract files cited below.

## References

1. [references/artifact-naming.md](references/artifact-naming.md)
2. [references/matrix-terms.md](references/matrix-terms.md)
3. [references/faqs.md](references/faqs.md)
4. [references/reading-level.md](references/reading-level.md)
5. [references/title-h1.md](references/title-h1.md)
6. [references/polish-output.md](references/polish-output.md)
7. Installed `content-pipeline-run` skill folder — `references/gate-modes.md`
8. Installed `content-pipeline-run` skill folder — `references/copywriting-model.md`
9. Installed `content-pipeline-run` skill folder — `references/voice-dna.md`
10. Installed `pipeline-pages-init` skill folder — `references/manifest-schema.md`

## Scripts

Skill root = this folder (next to `SKILL.md`). **Node.js 20+**. Pass absolute `--campaign-dir`.

| Script | Purpose |
|--------|---------|
| `scripts/check-pages-ready.mjs` | Exit 1 with `run pipeline-pages-init` before setup; exit 0 after `setup_complete` for an approved slug |
| `scripts/pd-coverage.mjs` | Evidence-threshold gate: block / warn / pass / waived from the produce PD copy |
| `scripts/status-page.mjs` | Manifest + artifact paths for one slug |
| `scripts/advance-page.mjs` | Init run row; set Matrix terms; mark stages complete |
| `scripts/extract-matrix-terms.mjs` | List Algorithm Trigger Words with Count; default high-impact is Count 40+ |

```bash
node scripts/check-pages-ready.mjs --campaign-dir "/abs/campaign" --slug emergency-service
node scripts/pd-coverage.mjs --campaign-dir "/abs/campaign" --slug emergency-service
node scripts/advance-page.mjs --campaign-dir "/abs/campaign" --init --slug emergency-service --gate-mode review --copywriting-model inherit
node scripts/pd-coverage.mjs --campaign-dir "/abs/campaign" --slug emergency-service --write
```

---

## Step 0 — Resolve and confirm

1. Require `campaign_dir` and `slug`.
2. Run `check-pages-ready.mjs`. If it exits 1, stop and tell them to run `pipeline-pages-init`.
3. Ask `gate_mode` once if missing.
4. Ask `copywriting_model` if missing. If this chat is Claude/Anthropic: **stop** — do not inherit, do not write copy. Ask them to switch to Grok 4.6 or ChatGPT-5.6 Terra.

## Step 0b — Evidence gate

Run `pd-coverage.mjs` after `check-pages-ready` and **before** `advance-page --init`. The gate reads `setup.product_doc_source` (the produce copy).

```bash
node scripts/pd-coverage.mjs --campaign-dir "<abs>" --slug "<slug>"
```

- `block` (exit 1) and no chat waiver: **stop**. Do not `--init`. No run row. The message names `owner-interview` and the scope slug.
- `pass` or `warn`: continue to Step 1.
- Chat waiver: continue to Step 1 and persist the waiver on `--write` (below).

## Step 1 — Init run row

```bash
node scripts/advance-page.mjs --campaign-dir "<abs>" --init --slug "<slug>" --gate-mode review --copywriting-model inherit
node scripts/pd-coverage.mjs --campaign-dir "<abs>" --slug "<slug>" --write
```

After `--init`, run `pd-coverage.mjs --write`. When the operator waived, add `--waive --waived-by <name>`.

## Step 1b — Matrix terms (hard stop before brief)

1. Run `extract-matrix-terms.mjs` so you can show the high-impact default (`Count >= 40`).
2. **Stop and ask:** provide specific terms for this page, or authorize the default high-impact list?
3. If they list terms: `--set-terms-file` or repeated `--set-term`.
4. If they authorize the default and do not provide a list: `--authorize-default-terms`.
5. Do not write the brief until `runs[slug].matrix_terms.terms` is non-empty.

Use those terms in headings/subheadings, and sprinkle them through body copy when they fit. They do not override the evidence grid.

## Step 1c — FAQs (optional)

Ask whether to generate FAQs. If yes, follow [references/faqs.md](references/faqs.md): DataForSEO PAA on the page seed, then put selected questions + answer directions in the brief. Draft/edit/polish must answer each question first; the phone is last. If no, FAQs stay Omit.

## Step 2 — Brief → draft → edit → polish

For each stage, read `{pages}/{p.N-stage}/CONTEXT.md` and execute the Agent prompt verbatim. Write only that stage’s artifact (see [artifact-naming.md](references/artifact-naming.md)). Draft, edit, and polish honor [reading-level.md](references/reading-level.md) and [title-h1.md](references/title-h1.md). Polish follows [polish-output.md](references/polish-output.md).

In `review` mode, wait for operator OK before the next stage. In `auto`, continue.

```bash
node scripts/advance-page.mjs --campaign-dir "<abs>" --slug "<slug>" --mark-complete brief --artifact "<path>"
```

## Step 3 — Stop

After polish: no images. Do not call SiteSwarm or any CMS unless the operator asks. Show the polish path (two-zone Markdown + HTML, ready to paste).
