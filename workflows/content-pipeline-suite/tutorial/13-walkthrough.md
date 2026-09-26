# 13 — End-to-end walkthrough

One campaign, both tracks, every stop — including the three sibling interviews when they apply. The example business is fictional; the sequence and the messages are exactly what you will see.

## The example campaign

| | |
|---|---|
| Business | Ridgeline Tree Care |
| Market | Greater Denver |
| Site | `ridgelinetreecare.example` |
| Phone | (555) 010-4477 |
| Campaign folder | `C:\work\clients\Ridgeline-Tree-Care` |
| Seed keywords | tree removal, stump grinding, emergency tree service |
| PAA location | `Denver,Colorado,United States` |

Ten offerings in the catalog. Eight live service pages. Chat model: Grok 4.6.

## Part 1 — Foundation

### Invoke

```text
/content-pipeline-init on C:\work\clients\Ridgeline-Tree-Care
```

The agent confirms the absolute path, then scaffolds:

```bash
node scripts/scaffold-icm.mjs --campaign-dir "C:\work\clients\Ridgeline-Tree-Care" \
  --template "C:\work\templates\Content-Pipeline-ICM"
node scripts/inventory-resources.mjs --campaign-dir "C:\work\clients\Ridgeline-Tree-Care" --write-manifest
```

### First stop — the keyword gate

Inventory finds the dossier and nothing else:

```json
{
  "status": "init_partial",
  "present": ["dossier"],
  "missing": ["onpage", "matrix", "personas", "paa", "fanout", "product_doc", "icp"]
}
```

Four of those are keyword-backed, so it stops:

> Matrix, personas, PAA, and fanout are missing. Supply seed keywords, plus a location for PAA. I will not infer keywords from the campaign docs.

You answer: `tree removal, stump grinding, emergency tree service` — location `Denver,Colorado,United States`.

### Second stop — paid API approval

> The DataForSEO on-page crawl is a paid call against `ridgelinetreecare.example`. Approve?

You say yes. Wave 2 launches the crawl, Matrix, personas, PAA, and fanout in parallel. Wave 3 then runs product documentation and customer research, because `product-documentation` needs the dossier and the crawl on disk first.

### Third stop — horizon

```bash
node scripts/sync-resources.mjs --campaign-dir "C:\work\clients\Ridgeline-Tree-Care"
```

All eight classes land in `01-resources/`. Then:

> 13-week roadmap (39 posts) or 26-week (78)?

First campaign, so: **13**.

The agent reads `02-plan/CONTEXT.md`, executes its Agent prompt, and writes a 39-row table to `02-plan/editorial-roadmap.md`.

### Taxonomy

```bash
node scripts/extract-roadmap-clusters.mjs --campaign-dir "C:\work\clients\Ridgeline-Tree-Care"
```

Eleven clusters map down to eight topic tags plus two counties:

`Emergencies`, `Tree Care`, `Tree Pruning`, `Tree Removal`, `Tree Diseases`, `Land Clearing`, `Seasonal Prep`, `Tree Pests`, `Summit County`, `Valley County`.

Written to `02-plan/siteswarm-tag-taxonomy.md`.

```json
{ "status": "init_complete" }
```

Foundation done. Now the tracks diverge, and **you can run them in either order or in parallel.** We will do pages first, because that is the recommendation for a new client.

## Part 2 — Service pages

### Setup

```text
/pipeline-pages-init on C:\work\clients\Ridgeline-Tree-Care
```

```bash
node scripts/scaffold-pages.mjs --campaign-dir "C:\work\clients\Ridgeline-Tree-Care"
node scripts/extract-pages.mjs  --campaign-dir "C:\work\clients\Ridgeline-Tree-Care" --write
```

### Stop — reconcile

| Bucket | Count | Pages |
|--------|------:|-------|
| both | 7 | tree-removal, stump-grinding, tree-trimming, emergency-service, arborist-services, deep-root-fertilization, oak-wilt-treatment |
| crawl-only | 1 | `mimosa-removal` |
| catalog-only | 2 | Land clearing, Storm damage cleanup |

The agent shows the table and waits. The three leftovers are the client conversation:

- `mimosa-removal` is a live page for a species-specific job nobody sells as its own service any more. **Skip.**
- Land clearing appears in the catalog with no page. They actively sell it. **Include.**
- Storm damage cleanup overlaps `emergency-service` and the owner wants to think about it. **Defer.**

```bash
node scripts/pages-manifest.mjs --campaign-dir "…" --decide mimosa-removal skip
node scripts/pages-manifest.mjs --campaign-dir "…" --decide land-clearing include
node scripts/pages-manifest.mjs --campaign-dir "…" --decide storm-damage-cleanup defer
node scripts/pages-manifest.mjs --campaign-dir "…" --approve-list --write-projection
```

Eight approved pages.

### Stop — seeds

```bash
node scripts/pages-manifest.mjs --campaign-dir "…" --apply-seeds --write-projection
```

| Slug | Seed |
|------|------|
| tree-removal | tree removal service |
| stump-grinding | stump grinding service |
| tree-trimming | tree trimming service |
| emergency-service | emergency service |
| arborist-services | arborist services |
| deep-root-fertilization | deep root fertilization service |
| oak-wilt-treatment | oak wilt treatment |
| land-clearing | land clearing service |

Note the three that did **not** get ` service` appended: `emergency service` already ends in it, `arborist services` ends in `services`, `oak wilt treatment` ends in `treatment`.

Status: `awaiting_seed_confirm`. You approve.

### Matrix loop

Eight runs, one page at a time:

```bash
node scripts/pages-manifest.mjs --campaign-dir "…" --next-matrix
```

```powershell
cd $env:CONTENT_MAXIMA_SKILL_ROOT
npx --yes tsx Tools/Matrix.ts "tree removal service" `
  --output "C:\work\clients\Ridgeline-Tree-Care\06-content-pipeline\pages\matrix\tree-removal"
```

```bash
node scripts/pages-manifest.mjs --campaign-dir "…" --record-matrix tree-removal \
  --matrix-path "…\tree-removal\tree_removal_service_matrix.xlsx" --matrix-status recorded
```

You get through five, then stop for the day. Next session, `--next-matrix` returns page six — the three finished ones are skipped because their matrix folders are populated.

```bash
node scripts/pages-manifest.mjs --campaign-dir "…" --setup-complete --write-projection
```

### Producing the first page

```text
/content-pipeline-pages on C:\work\clients\Ridgeline-Tree-Care slug tree-removal, gate_mode review
```

```bash
node scripts/check-pages-ready.mjs --campaign-dir "…" --slug tree-removal   # exit 0
node scripts/pd-coverage.mjs      --campaign-dir "…" --slug tree-removal
```

```json
{ "slug": "tree-removal", "result": "warn", "known": 9, "unknown": 3 }
```

`warn` continues, with the gaps flagged in the brief.

```bash
node scripts/advance-page.mjs --campaign-dir "…" --init --slug tree-removal \
  --gate-mode review --copywriting-model inherit
node scripts/pd-coverage.mjs --campaign-dir "…" --slug tree-removal --write
```

### Stop — Matrix terms

```bash
node scripts/extract-matrix-terms.mjs --campaign-dir "…" --slug tree-removal
```

> 47 terms at Count 40 or above. Provide the specific algorithm trigger words for this page, or authorize the default high-impact list?

You pick nine terms that describe what they actually do. Recorded with `source: operator`.

> Generate an FAQ block for this page from live People Also Ask?

Yes. PAA runs on `tree removal service`, location `Denver,Colorado,United States`. Six questions survive the keep rules; two get dropped as legal-advice traps.

### The four stages

`review` mode, so it pauses after each one.

**p.1 brief** → `pages/p.1-brief/page-tree-removal-brief.md`

Evidence grid, outline, the nine Matrix terms, six FAQ questions with answer directions, internal links that already exist in the crawl. Title planned as `Tree Removal | Ridgeline Tree Care`. H1 planned as **Tree and Limb Removal Services in Greater Denver** — a restatement, not the title with a city bolted on.

You approve.

**p.2 draft** → `page-tree-removal-draft.md`

No Voice DNA file yet, so draft uses default professional (the 0-file case). Copy at 7th–8th grade. The three Unknown grid rows — crane capacity, same-day availability, price range — stay out of the copy entirely. The spoken-source file is minted later, before post 7.

**p.3 edit** → `page-tree-removal-edit.md`

AI-isms removed. One FAQ answer opened with the phone number, so it is rewritten to answer first.

**p.4 polish** → `p.4-polish/page-tree-removal-polish/page-tree-removal-polish.md`

Technical suite, then top-of-page zone in Markdown and `<article>` HTML, then bottom-of-page FAQ zone in both formats. No images. No CMS push.

Page one done. Paste-ready.

## Part 3 — When the gate blocks

Next slug: `deep-root-fertilization`.

```bash
node scripts/pd-coverage.mjs --campaign-dir "…" --slug deep-root-fertilization
```

```json
{
  "slug": "deep-root-fertilization",
  "result": "block",
  "known": 2,
  "unknown": 8,
  "message": "Thin first-party evidence. Run owner-interview for scope deep-root-fertilization."
}
```

Exit 1. **No run row was created.** Product documentation knows they offer it and nothing else — not the mix, not the schedule, not whether they soil test, not whether shrubs are included.

You could waive this. A page written on two known facts would be generic filler that ranks for nothing and converts worse. So:

### The interview

```text
/owner-interview on C:\work\clients\Ridgeline-Tree-Care for deep-root-fertilization
```

```bash
node scripts/interview-gaps.mjs --campaign-dir "…" --scope deep-root-fertilization
```

Eight typed gaps. The agent drafts questions from those gaps plus the tree-care industry seed, and the script validates and renders the pack:

```bash
node scripts/interview-pack.mjs --campaign-dir "…" --scope deep-root-fertilization --draft draft.json
```

Eleven questions, capped and ordered delivery → scope → expectation → timeline → pricing → verify:

| # | Type | Question |
|---|------|----------|
| 1 | Describe | Walk me through what you actually do on a deep root fertilization visit. |
| 2 | Describe | Do you use a house mix, a named product, or does it vary per tree? |
| 3 | Publish? | May we publish that as you said it? |
| 4 | Describe | Organic, synthetic, or both — and is there an NPK you would publish? |
| 5 | Describe | Do you soil test first, and who reads the result? |
| 6 | Describe | Trees only, or shrubs too? |
| 7 | Describe | How often, and is there a local seasonal window? |
| 8 | Describe | What aftercare or watering instructions do you actually give? |
| 9 | Describe | What does a homeowner see or feel afterward, and how soon? |
| 10 | Verify | Your site says "we feed your trees what they need." Is that accurate as written? |
| 11 | Publish? | May we publish the correction from question 10? |

Questions 2 and 4 could produce a brand or a product name, so both carry a `publish_link`. The pack script would have rejected them otherwise.

### Capture

You call the owner. Twenty minutes. Then the agent proposes the mapping:

| Question | Your note |
|----------|-----------|
| q-1 | "Injection probes around the drip line, 8 to 12 inches down, not a surface spread" |
| q-2 | "House mix. Adjusts it if the tree is stressed." |
| q-3 | framing-only — does not want the recipe public |
| q-5 | "Soil test on anything that looks off. He reads it himself." |
| q-6 | "Trees. Shrubs only if they are already there for something else." |
| q-7 | "Spring and fall. Once a year is plenty for a healthy tree." |
| — | "his brother-in-law does the equipment maintenance" → **unmapped** |

You confirm. The brother-in-law note lands under `## Unmapped notes` and is never compiled — correctly, because it is not a service fact.

Question 4 got "it depends on the tree." The scripted hedge follow-up asked what it depends on, and the answer was species and soil condition. That is recorded as the real answer. Nobody invented an NPK.

```bash
node scripts/interview-record.mjs --campaign-dir "…" --scope deep-root-fertilization --add-answer '<json>'
```

State: `captured`.

### Compile and re-sync

```bash
node scripts/interview-compile-plan.mjs --campaign-dir "…" --scope deep-root-fertilization
```

The skill stops and hands the tagged diff to `product-documentation`. You review it and confirm the overwrite. It assigns `PD-SRC-004`.

```bash
node scripts/interview-record.mjs --campaign-dir "…" --set-source-id PD-SRC-004
```

State: `compiled`. Then re-sync, because the produce copy is still stale:

```bash
node ../content-pipeline-init/scripts/sync-resources.mjs --campaign-dir "…" --dry-run
node ../content-pipeline-init/scripts/sync-resources.mjs --campaign-dir "…"
```

```json
{ "copied": [{ "class_id": "product_doc", "dest": "…/01-resources/Product-Documentation.md" }] }
```

That `copied[]` entry is the success signal. Not the exit code.

### Back to the page

```bash
node scripts/pd-coverage.mjs --campaign-dir "…" --slug deep-root-fertilization
```

```json
{ "result": "pass", "known": 9, "unknown": 1 }
```

The page writes. And now it contains things no competitor's page contains: injection probes at the drip line, spring and fall, once a year for a healthy tree, soil testing when something looks off. The framing-only answer shapes the copy without publishing the recipe.

That is the whole argument for the suite in one page.

## Part 4 — Blog track

Same foundation, different consumption.

### Photo library

```text
/content-pipeline-photo-library on C:\work\clients\Ridgeline-Tree-Care
```

The taxonomy exists, so the gate passes. First ingest copies `templates/classify.mjs` into the campaign, and you edit it:

```javascript
const KEEP = ["crew removing or pruning a tree", "stump grinding in progress",
              "storm damage cleanup", "equipment on a residential job",
              "before and after of a treated tree"];
const OFF_TOPIC = ["youth sports sponsorship", "holiday party", "fundraiser graphic",
                   "wrecked vehicle as the subject", "donate or payment overlays"];
const CLASSIFIER_READY = true;
```

```bash
node scripts/gbp-serpapi-owner.mjs --campaign-dir "…" --q "Ridgeline Tree Care"
node scripts/ingest.mjs --campaign-dir "…" --payloads payloads.json
node scripts/classify.mjs --campaign-dir "…"
```

142 photos in. Classify sorts them: 39 reach `review/`, 103 are filtered out — a sponsored little-league banner, a Christmas party, four fundraiser graphics with donate overlays, and a lot of reposted stock.

That filtering is not approval. You still review all 39:

```bash
node scripts/apply-review.mjs --campaign-dir "…" --approve fb_8842
node scripts/apply-review.mjs --campaign-dir "…" --retag ig_2201 --tags "Tree Removal, Summit County"
node scripts/apply-review.mjs --campaign-dir "…" --reject gbp_contrib_9f
```

31 approved, renamed `{topic-slug}_{stem}.ext`:

```text
tree-removal_facebook_122120562308149608.jpg
tree-pruning_gbp_contrib_AH1DqX-qRzy4Lprf.jpg
storm-damage_instagram_3199204471.jpg
```

```bash
node scripts/check-helpers.mjs --campaign-dir "…"
```

```json
{ "matcher": "…/scripts/match-library.mjs", "fal": "…/scripts/fal-generate.mjs", "approved": 31 }
```

The campaign is ready for writers.

### Optional: start the expert series

Facts for the blocked page came from owner-interview. Stories for the blog come from a monthly call. Same Worker, second Retell agent — see [09-retell-voice-setup.md](09-retell-voice-setup.md). Do not invent a second host.

```text
/expert-interview on C:\work\clients\Ridgeline-Tree-Care
```

```bash
node scripts/series.mjs --campaign-dir "…" --create \
  --speaker "Jordan Hale" --email "jordan@example.com" \
  --timezone America/Denver --cadence monthly --byday 1MO
```

Jordan opens `https://<your-origin>/e/example-agency/{token}`. After a real call:

```bash
node scripts/bank.mjs --campaign-dir "…" --refresh
```

That writes `01-resources/Ridgeline-Tree-Care-story-bank.md`. `check-ready` / `--set-slot` will refresh it again. If there is no digest yet, the brief skips the story-bank line — it does not invent a story.

Calendar invite (ask first): `{Agency}/agency-settings.json`, then `calendar.mjs --preview`, then `--create`. Title: `Ridgeline Tree Care Expert Interview Call for Example-Agency`.

### Optional: mint a Voice DNA

How Jordan sounds is a third capture, not a fact and not a story. Same Worker, third Retell agent (`retell/voice`). Links are `/v/{agency}/{session}`.

```text
/voice-interview on C:\work\clients\Ridgeline-Tree-Care
```

```bash
node scripts/voice-record.mjs --campaign-dir "…" --create --speaker "Jordan Hale"
node scripts/voice-session.mjs --campaign-dir "…" --speaker "Jordan Hale" --create-link
```

Jordan opens `https://<your-origin>/v/example-agency/{session}`. After the call (ask before `--pull`, `--land`, and `--speaker-verified`):

```bash
node scripts/voice-session.mjs --campaign-dir "…" --speaker "Jordan Hale" --pull
node scripts/voice-extract.mjs --campaign-dir "…" --speaker "Jordan Hale" --prepare
```

Run companion `voice-extractor` on the printed transcript. Then:

```bash
node scripts/voice-extract.mjs --campaign-dir "…" --speaker "Jordan Hale" \
  --land "/abs/path/to/jordan-hale-voice-dna.json" --speaker-verified
```

That writes `01-resources/jordan-hale-voice-dna.json`. Draft's 0 / 1 / 2+ rule now sees **one** file and uses it without asking. If you skip this step, post 7 still writes — default professional.

### Producing post 7

```text
content pipeline run — campaign C:\work\clients\Ridgeline-Tree-Care — gate_mode review
```

```bash
node scripts/check-ready.mjs --campaign-dir "…"     # all green
node scripts/advance-run.mjs --campaign-dir "…" --set-slot --post 7 --week 3 \
  --title "What To Do When A Tree Falls On Your Roof" --trigger "emergency tree removal"
```

| Stage | Output |
|-------|--------|
| 3.1 brief | `3.1-brief/post-07-brief.md` |
| 3.2 draft | `3.2-draft/post-07-draft.md` — same Voice DNA file, used silently |
| 3.3 edit | `3.3-edit/post-07-edit.md` |
| 3.4 polish | `3.4-polish/post-07-polish/post-07-polish.md`, slug `tree-fell-on-roof` |
| 3.5 images | Two placeholders: one matched `storm-damage` from the library, one Fal-generated |

```json
{ "images": [
  { "placeholder": 1, "engine": "library", "src": "storm-damage_instagram_3199204471.jpg" },
  { "placeholder": 2, "engine": "fal", "model": "fal-ai/flux-2-pro" }
] }
```

```bash
node scripts/advance-run.mjs --campaign-dir "…" --produce-complete
```

Post 7 done. Post 8 is another invoke.

## Where things stood at the end

```text
C:\work\clients\Ridgeline-Tree-Care\06-content-pipeline\
  01-resources\          8 classes + ai-isms.md + image-library (31 approved)
  02-plan\               editorial-roadmap.md (39 rows), siteswarm-tag-taxonomy.md
  03-write\              post-07 through 3.5-images
  pages\
    matrix\              8 slugs
    p.1-brief\ … p.4-polish\    tree-removal, deep-root-fertilization
  content-pipeline-init-manifest.json      init_complete
  content-pipeline-run-manifest.json       post 7 produce_complete
  pipeline-pages-manifest.json             setup_complete, 2 pages polished
```

Plus, in `01-intake/1.1-docs/`: `Product-Documentation.md` that now cites `PD-SRC-004` for deep root fertilization. Interview packs and the compiled owner record live under `1.1-docs/interviews/owner/`; the expert series JSON under `interviews/expert/`; the voice-interview record under `interviews/voice/`. `01-resources/` also has `Ridgeline-Tree-Care-story-bank.md` and `jordan-hale-voice-dna.json` if those optional steps ran.

## The five stops that did the real work

Everything the suite is for happened at a stop, not in a generation step.

1. **The keyword gate** kept a 39-post roadmap from being built on terms the client does not sell.
2. **Page reconciliation** found a page to retire and two services with no page at all — the client conversation that justified the engagement.
3. **Photo HITL** kept a little-league banner and four fundraiser graphics out of blog posts.
4. **The evidence block** stopped a generic fertilization page and turned it into the most specific page on the site.
5. **The mapping confirmation** kept "his brother-in-law does the equipment maintenance" out of published copy.

An agent that never stopped would have produced all of it, faster, and worse.
