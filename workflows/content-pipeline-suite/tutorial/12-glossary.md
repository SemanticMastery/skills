# 12 — Glossary

Terms as this suite uses them. Some have a general industry meaning that is broader than what these skills do with them.

## Structure

**Campaign directory (`campaign_dir`)** — The client folder you name at invoke. Every skill requires it explicitly and confirms the absolute path before writing.

**Pipeline directory (`pipeline_dir`)** — `{campaign_dir}/06-content-pipeline/`. Where everything in this suite lives.

**ICM tree** — The `Content-Pipeline-ICM` template folder structure: `01-resources/`, `02-plan/`, `03-write/`, `04-publish/`, `05-archives/`, each with a `CONTEXT.md`. Init scaffolds it copy-if-missing.

**`CONTEXT.md`** — A prose instruction file inside a stage folder. The Agent prompt section is executed verbatim. It never records progress.

**Manifest** — The JSON file that records progress and decisions. The source of truth. Read it before you read the transcript.

**Copy-if-missing** — Scaffolding that never overwrites an existing file. Your campaign edits survive a re-scaffold.

## Roles

**Setup operator** — Whoever runs init, the photo library, and pages-init. Owns the research, the taxonomy, photo HITL, and the page reconciliation.

**Writing team** — Whoever runs `content-pipeline-run` and `content-pipeline-pages`. Consumes the pack. Does not build the library or the plan.

**HITL** — Human in the loop. A decision the agent must never make for you: photo approvals, page reconciliation, seed confirmation, term selection, note mapping, PD overwrite, evidence waivers, sending links.

## Foundation

**Resource class** — One of the eight required research inputs: `dossier`, `onpage`, `matrix`, `personas`, `paa`, `fanout`, `product_doc`, `icp`. `init_complete` requires all eight.

**Wave** — A dependency group init dispatches together. Wave 1 dossier; wave 2 crawl, Matrix, personas, PAA, fanout; wave 3 product documentation and ICP.

**Keyword gate** — Init's hard stop when a keyword-backed class is missing. You supply seed keywords, plus a location for PAA. It may not infer them from campaign docs.

**Horizon** — 13 weeks (39 posts) or 26 weeks (78) for the first roadmap. Stored as `plan.horizon_weeks`.

**Editorial roadmap** — `02-plan/editorial-roadmap.md`. A markdown table: Week, Post, Cluster, Working Title, Trigger Word, PAA/QFO Linkage, Target Persona, User Intent. The blog track's work list.

**Cluster** — A topic grouping in the roadmap. Also the input to the tag taxonomy.

**Trigger word** — A per-post term from the roadmap row that the brief and draft must carry. Distinct from Matrix Algorithm Trigger Words on the pages side.

**SiteSwarm tag taxonomy** — `02-plan/siteswarm-tag-taxonomy.md`. The tag allowlist derived from roadmap clusters. Required for `init_complete`, and required before the photo classifier can run.

**`ai-isms.md`** — The campaign's banned-phrase list. Read at draft, edit, and polish. Survives any Voice DNA selection.

## Blog track

**Slot** — One roadmap row, identified by post number. One slot per invoke.

**`3.1` through `3.5`** — Brief, draft, edit, polish, images.

**Photo library** — `01-resources/image-library/` with `inbox/`, `review/`, `approved/`, plus the campaign-owned `classify.mjs` and `library-manifest.json`.

**Campaign classifier** — `01-resources/image-library/classify.mjs`. Copied from the template and edited with this business's KEEP and OFF_TOPIC lists, with `CLASSIFIER_READY = true`. Never shared between campaigns.

**Evergreen** — A photo that stays usable: real work by this business, no dated campaign text, no in-frame promo overlay. Defined per campaign in the classifier.

**Fal miss** — Stage 3.5 found no approved photo for a placeholder, so it generated one. Normal. Not a hard stop.

**Voice DNA** — An optional author or brand voice file in `01-resources/`. Zero means default professional; one is used silently; two or more always asks. `content-pipeline-run` consumes it; `voice-interview` produces a spoken-source `{author}-voice-dna.json`.

## Pages track

**Slug** — The page identifier, for example `emergency-service`. One slug per invoke.

**Crawl-only** — A live URL with no offering behind it. Usually a retired service. You decide.

**Catalog-only** — An offering with no live page. New revenue, or a service they stopped selling. You decide.

**both** — A live URL and a catalog offering. The default include set.

**Seed** — The commercial-intent phrase driving the Matrix for one page. Derived from the slug or offering name, plus ` service` unless the last token is already `service`, `services`, `treatment`, `response`, `plan`, or `plans`.

**Matrix** — A Content Maxima export per page at `pages/matrix/{slug}/*_matrix.xlsx`.

**Algorithm Trigger Words** — The Matrix sheet with `Term` and `Count`. Either you select terms per page, or you authorize the default high-impact set (`Count >= 40`).

**`p.1` through `p.4`** — Brief, draft, edit, polish. No image stage.

**Builder zone** — One of the two polish output areas: top of page (main copy) and bottom of page (FAQs). Each in Markdown and `<article>` HTML.

**Restate vs repeat** — The H1 rule. Restate is a close variant a visitor recognizes as the same job. Repeat is the SEO title with a location or a one-word tack-on.

## Evidence

**Evidence grid** — The per-offering table in product documentation marking each fact Known, Unknown, Unverified, or in Conflict. It governs every claim in the copy.

**`pd-coverage`** — The gate that scores how much of a page's grid is actually known. Returns `pass`, `warn`, or `block`.

**Block** — Too many Unknown / Unverified / Conflict rows. No run row is created. Run `owner-interview` or waive it.

**Waiver** — Your on-the-record decision to write a page on thin evidence. Persisted with your name.

**Coverage map** — `coverage-map.json`. Maps grid rows to product-documentation fields. Owned by `content-pipeline-pages`; `owner-interview` carries a copy.

**Describe / Verify / Publish?** — The three interview question types. Describe opens a topic, Verify tests a quoted claim, Publish? records whether a fact may be published.

**Publish decision** — `public` (may appear as said), `framing-only` (the idea may be used in general language, without specifics), `internal` (record only).

**Publish? trigger** — Price, brand, product name, credential, tenure date, vendor, crew size. A question that could produce one must link to a Publish? question.

**Interview pack** — The generated question set for one scope, as `.json` plus `.md`.

**Interview record** — The captured answers. JSON is authoritative. State machine: `open → captured → compiled → superseded`.

**Unmapped notes** — Interview notes you did not map to a question ID. Kept in the record, never compiled.

**`PD-SRC-00N`** — The source id product documentation assigns to a compiled interview, written back to the record so a claim stays traceable.

**Scope** — An offering slug, or `company` for the company-wide pack.

**Story bank** — `{Company}-story-bank.md` in `01-resources/`. Produced by `expert-interview` `bank.mjs --refresh`. Flagged and internal rows are omitted.

**Series record** — `{Company}-expert-interview-series.json` in `01-intake/1.1-docs/interviews/expert/`. One per campaign. JSON is authoritative.

**`/e/{agency}/{token}`** — Stable expert series link on the same voice host as owner interviews.

**Cadence cap** — Soft target / hard hang-up: weekly 10–15 / 15, biweekly 20–30 / 30, monthly 30–45 / 45.

**`pd_candidate`** — Story-bank flag that hands a fact-shaped line to owner-interview. Not a Product Documentation write.

**`/v/{agency}/{session}`** — Voice-interview link on the same Worker. Third Retell template (`retell/voice`). Not an owner pack and not an expert series.

**Voice record** — `{Company}-voice-interview-{speaker-slug}-{YYYY-MM-DD}.{json,md}` in `01-intake/1.1-docs/interviews/voice/`. JSON is authoritative. State: `open → captured → extracted → superseded`.

**`under_floor`** — Voice-interview flag: the transcript is shorter than the spoken-source floor. Not a state. `--land` needs `--accept-under-floor`.

**`voice-extractor`** — Companion skill (separate install). Transcript-mode extraction that writes the JSON `voice-interview` then `--land`s.

## Modes and settings

**`gate_mode`** — `review` pauses after every produce stage; `auto` chains them. Neither disables a hard gate or lets the agent self-approve.

**`copywriting_model`** — `inherit` or a pinned model id. Anthropic is refused.

**`copywriting_via`** — `session` (this chat) or `external` (another host writes brief through polish in one stay).

**`next_action`** — The manifest field that says what happens next: `select_slot`, `run:{stage}`, `await_approval:{stage}`, `await_external:write`, `blocked:need_init_plan`, `produce_complete`.

**One stay** — The external-host rule: finish brief through polish there, return once at images. Not a per-stage round trip.

## Voice host

**Host** — Your Cloudflare Worker. Holds the pack and serves one question at a time. You deploy it; nothing is hosted for you.

**Durable Object** — Cloudflare's per-object coordination primitive. This host uses three SQLite-backed classes: one per interview session, one index, one series ledger.

**Session link** — `https://<your-worker>/s/{session}` (owner). Expert series links are `/e/{agency}/{token}`.

**`START_CAP`** — Maximum call starts per link, so a shared link cannot be farmed.

**`[REVIEW:]` flag** — A marker on a captured fact the agent was unsure about. Clear them per fact, never in bulk.

**Two retention clocks** — Your host purges at link expiry plus `RETENTION_DAYS`; Retell keeps its own copy on its own schedule. Pull before the shorter one.

## Next

[13-walkthrough.md](13-walkthrough.md) — all of it, on one example campaign.
