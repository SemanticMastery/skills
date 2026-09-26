# 11 — Troubleshooting

## Start here, always

Three moves solve most of it:

1. **Read the manifest, not the chat history.** Progress lives in JSON in the campaign folder. The transcript only remembers it.
2. **Run the status script.** `check-ready.mjs`, `status-run.mjs`, `status-page.mjs`, `check-pages-ready.mjs`, `check-helpers.mjs` — each prints JSON that names the actual problem.
3. **Confirm the campaign path.** A surprising share of "the skill is broken" is a skill working correctly on a different folder.

## A stop is not a bug

Before you debug, decide which of these you are looking at:

| It is | Looks like | Do |
|-------|-----------|-----|
| A gate | A clear message naming a missing file or decision | Supply the thing |
| A refusal | "Anthropic is prohibited", "do not invent tags" | Change your setup, not the skill |
| A real error | A stack trace, a non-JSON crash, a hang | Debug it |

## Cross-skill

| Symptom | Cause | Fix |
|---------|-------|-----|
| Skill does not appear in your host | Wrong skills directory, or `SKILL.md` is not at the folder root | Check the install matrix in `START-HERE.md` |
| "Requires an explicit campaign directory" | No path given | Name the absolute path |
| Writes landed in the wrong campaign | Two campaigns, one chat | One campaign per chat. Confirm the path before writes. |
| Refuses to write copy | Chat is Claude, or the stored pin is Anthropic | Switch to Grok 4.6 or ChatGPT-5.6 Terra |
| A cited reference will not resolve | A companion skill is not installed | Install all eight; pages cites run's contracts |
| Agent forgot everything after `/clear` | Expected | Ask for status; the manifest has it |
| Agent wants to skip a gate to be helpful | It should not | Say no. Use the explicit waiver if the gate is genuinely wrong. |

## content-pipeline-init

| Symptom | Cause | Fix |
|---------|-------|-----|
| "template not found" | No `--template`, no `CONTENT_PIPELINE_ICM_TEMPLATE`, nothing discoverable | Pass `--template` with the absolute path |
| A class shows missing though the file exists | Basename does not match the expected pattern | See `references/resource-patterns.md`, rename |
| ICP never detected | Filename has no `icp` in it | Rename so the basename contains `icp` |
| Hard stop asking for keywords | `matrix` / `personas` / `paa` / `fanout` missing | Supply seed keywords and a PAA location. It will not infer them. |
| Stuck at `awaiting_horizon` | No horizon chosen | Answer 13 or 26 |
| Stuck at `awaiting_taxonomy` | Roadmap exists, taxonomy missing | Step 7 |
| Roadmap rebuilt unasked | Rebuild requested, or the cluster set changed | Reuse is the default; only rebuild deliberately |
| `init_complete` but run still hard-stops | Legacy manifest with no roadmap or taxonomy | Finish steps 6–7 |
| Dossier `.docx` copied into resources | Should not happen | Only the `.md` belongs in the agent pack |

## content-pipeline-photo-library

| Symptom | Cause | Fix |
|---------|-------|-----|
| classify hard-stops | Campaign `classify.mjs` missing, or `CLASSIFIER_READY = false` | Copy `templates/classify.mjs`, edit KEEP/OFF_TOPIC, flip the flag |
| classify hard-stops with that file present | No `siteswarm-tag-taxonomy.md` | Init steps 6–7 |
| ingest hard-stops | No `sources.md` | Write it with the GBP / Facebook / Instagram targets |
| GBP returns junk | Generic Maps scrape | Use `gbp-serpapi-owner.mjs`, category By owner |
| A source returns nothing | Login wall | That source stops. Never ask a client for a password. |
| `.bin` files in the library | Non-image payload persisted | Should not happen in 1.8.0; check magic-byte validation |
| Party and sponsorship photos in review | `OFF_TOPIC` list too thin | Add them to the campaign classifier |
| Right subject, wrong tags | Model proposal, not gospel | `--retag` with allowlist tags |
| Pending ids lost after `/clear` | Queue markdown gone | `--rewrite-queue`; the manifest still has them |
| Requeued a purged photo, bytes did not come back | Requeue forgets the hold, it does not restore deleted bytes | Next ingest may refetch |
| Writers cannot find the matcher | Campaign `scripts/` not seeded | `node scripts/seed-helpers.mjs --campaign-dir "…"` |
| Two campaigns share a classify prompt | Someone edited shared skill code | Business prompts live in the campaign folder only |

## content-pipeline-run

| Symptom | Cause | Fix |
|---------|-------|-----|
| Hard stop on invoke | `check-ready` failed | Read its JSON; it names the missing class |
| `blocked:need_init_plan` | Roadmap or taxonomy missing | Init steps 6–7 |
| Stuck at `await_approval:{stage}` | `review` mode | Say OK, or switch to `auto` |
| Stuck at `await_external:write` | Handed off, polish not back | Finish it in the external host, then `--ingest-external-write` |
| Wants to write a second post | Should not | One slot per invoke |
| Images look like process shots | Fal prompt drifted from outcome stills | Re-read the 3.5 CONTEXT prompt |
| No photos matched | No approved photo carries the post's primary topic tag | Expected. Fal handles it. |
| Overwrote approved images | Overwrite protection ignored | Never silently replace `post-NN-img-*.png` |
| Agent starts photo ingest mid-post | Contract misread | Empty `approved/` is a Fal miss, not a hard stop |
| Pinned model not dispatchable | Bad pin | It stops on purpose. Re-pin; never substitute. |
| Slug has a city and service tail | Convention ignored | Three to five essence-first words |
| Asked which voice file to use in `auto` mode | Correct behavior | Two or more Voice DNA files always asks |

## pipeline-pages-init

| Symptom | Cause | Fix |
|---------|-------|-----|
| Refuses to start | No crawl or no `Product-Documentation.md` in `01-resources/` | Finish init, or re-sync |
| Everything lands in crawl-only | Product documentation has no offering catalog | Fix the PD first |
| Everything lands in catalog-only | Crawl is empty or was the wrong domain | Re-run the crawl |
| Seed reads wrong | Slug words are not how anyone says it | `--set-seed`, confirm before Matrix |
| Stuck at `awaiting_seed_confirm` | Working as designed | Approve the seed table |
| Matrix step hangs | Playwright or Content Maxima login | Report and stop. Do not fake a Matrix. |
| Matrix loop restarts finished pages | Should not | Resume skips a slug with `*_matrix*` present |
| Pages skill still hard-stops | `--setup-complete` never ran | Run it |

## content-pipeline-pages

| Symptom | Cause | Fix |
|---------|-------|-----|
| Exit 1 on invoke | Setup incomplete, or no Matrix for this slug | `pipeline-pages-init` |
| `block` from `pd-coverage` | Thin first-party evidence | `owner-interview`, or waive on the record |
| Waived but the block came back | Waiver never persisted | Re-run `pd-coverage --write --waive --waived-by <name>` after `--init` |
| No brief appears | `matrix_terms` not recorded | Set terms or authorize the Count 40+ default |
| Every page used the 40+ default | Nobody asked per page | Ask per slug until told otherwise |
| H1 fails review | Repeats the title with a city appended | Apply the restate test |
| Title has a location | Title rule ignored | `[Service] \| [Company]` only |
| Copy reads at grade 12 | Reading-level contract ignored | 7th–8th grade for all visitor copy |
| FAQ answers open with the phone number | Answer-first rule ignored | Rewrite; phone last |
| Polish emitted a full HTML document | Contract ignored | `<article>` body only |
| Polish included image placeholders | Out of scope | No `[IMAGE:` in a page |
| A trigger word became a service promise | Terms beat evidence | The grid governs. Terms are phrasing candidates. |

## owner-interview

| Symptom | Cause | Fix |
|---------|-------|-----|
| `offering_not_found` | Scope slug not in the catalog | Check product documentation |
| `record_exists` | A record exists on that stem | Use it, or `--delta` for a new pack |
| `publish_link_required` | A price/brand/credential question has no Publish? link | Add the linked Publish? question |
| Illegal state transition | Compiling an `open` record | Add answers first |
| Facts the owner never said | Mapping confirmation skipped | Discard, re-map, re-record |
| Notes did not compile | They were unmapped | Unmapped notes are never compiled, by design |
| Wanted a notes parser | There is none | Five minutes of mapping is why the page is defensible |
| Re-sync "succeeded", produce still blocks | You read the exit code | Read `copied[]` / `skipped: identical_dest` for `product_doc` |
| PD refreshed, page still blocks | `01-resources/` never re-synced | `sync-resources.mjs` |
| Seed asserted a fact | Seed misused | Seeds ask; they never assert |

## expert-interview

| Symptom | Cause | Fix |
|---------|-------|-----|
| Page still blocked after an expert call | You captured stories, not delivery facts | `owner-interview` for that slug |
| Digest empty | Refresh not run, or every row flagged | `bank.mjs --refresh`, then `--list-flags` |
| Writer used an internal story | They did not read the digest | Digest omits flagged / internal rows |
| `config_dir_synced` | Calendar config dir is OneDrive / SharePoint | `%LOCALAPPDATA%\\gws\\{agency-slug}` |
| Recap is stale or empty | Host ledger was wiped | Recap comes from the host, not the local bank |
| Thought you needed a second Worker | Misread the host chapter | Same `voice-host/`; `--template retell/expert` |

## voice-interview

| Symptom | Cause | Fix |
|---------|-------|-----|
| URL is `/s/` or `/i/` | Owner agent wired to the voice var, or wrong skill minted the link | `RETELL_VOICE_AGENT_ID` + `voice-session.mjs --create-link` |
| `--land` refused | Missing `--speaker-verified` (or overwrite / under-floor) | That is the gate. Name the flag you mean |
| Draft still default professional | No `*voice-dna*` in `01-resources/` | Land the file, or accept default |
| Draft asks which file | Two or more matches | Expected. Pick one or `--retire` |
| `voice-extractor` schema missing | Companion not installed as a sibling folder | Install `voice-extractor` next to `voice-interview` |
| Thought you needed a third Worker | Misread the host chapter | Same `voice-host/`; `--template retell/voice` |

## Voice host

| Symptom | Cause | Fix |
|---------|-------|-----|
| `host_url_insecure` | `OWNER_INTERVIEW_HOST_URL` missing or not HTTPS | Set the full `https://` origin |
| `host_token_unset` (503) | Worker has no `OWNER_INTERVIEW_HOST_TOKEN` | `wrangler secret put`, redeploy |
| `host_auth_failed` (401) | Skill token and Worker token differ | Make them identical |
| `selftest_401` on `--verify` | Webhook key drift | Rotate `RETELL_WEBHOOK_KEY` on both sides |
| `data_storage_setting_drift` | Retention changed in the Retell dashboard | Re-run `--apply` |
| `worker_url_insecure` | Passed an `http://` URL | Use the `https://` origin |
| `RETELL_API_KEY missing` on `--apply` | Not in the shell env | Set it for that shell |
| Agent says "one moment" | Prompt edited | Restore the no-filler rule, re-`--apply` |
| No question after consent | Tool auth header mismatch | Re-`--apply` so the current token is attached |
| Session gone before you pulled it | Retention window closed | Pull before the shorter of your retention and Retell's |

## Escalating

Bring these four things and someone can help you in one message:

1. The skill name and version
2. The exact command or phrasing you used
3. The JSON the status or gate script printed
4. The relevant manifest `status` or `next_action`

Do not paste the whole transcript. The manifest and the failing script output are the diagnosis.

## Next

[12-glossary.md](12-glossary.md).
