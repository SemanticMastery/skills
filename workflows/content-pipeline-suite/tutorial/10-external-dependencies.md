# 10 — External dependencies

Every account, key, and cost gate in the suite, and whether you actually need it.

## Required to run anything

| Requirement | Notes |
|-------------|-------|
| **Node.js 20+** | Every skill ships deterministic `.mjs` scripts. LTS recommended. |
| An Agent Skills host | Cursor, Claude Code, Claude Desktop, Codex, OpenCode — anything that reads `SKILL.md` |
| A non-Anthropic model for copy stages | Grok 4.6 or ChatGPT-5.6 Terra recommended |

That is it. You can complete a full campaign with no third-party API at all if you supply the research files by hand.

## Per-track requirements

| Track | Genuinely required | Optional |
|-------|-------------------|----------|
| Research foundation | Something that produces each of the eight resource classes | Companion skills to automate them |
| Blog | Nothing beyond init | Photo library scraping, Gemini, Fal, SiteSwarm |
| Service pages | Content Maxima Matrix per page | DataForSEO PAA for FAQs |
| Owner interview | Nothing | Retell AI + Cloudflare for voice |

## The services, one at a time

### Content Maxima — required for the pages track

The only genuinely non-optional third-party dependency, and only if you produce service pages. Each approved page needs one Matrix, and `content-pipeline-pages` reads the **Algorithm Trigger Words** sheet from it.

The automation ships with this suite as `skills/contentmaxima-v<version>.zip`. The subscription does not — that account is yours, and nothing about it is shared.

- Install it separately from the other skills: unzip it into a `contentmaxima/` folder, and its `INSTALL.md` walks through Bun, Playwright Chromium, and credentials. Then set `CONTENT_MAXIMA_SKILL_ROOT`.
- Credentials load from the skill's `.env`, `~/.env`, `~/.contentmaxima/.env`, or your shell — first match wins. Put them in `~/.env` if you use the skill outside this suite too.
- Runs through Playwright, so a browser session is involved. On Windows drive `Tools/*.ts` with `npx --yes tsx`, not `bun` — Bun plus Playwright hangs at browser launch.
- On Windows: `npx --yes tsx Tools/Matrix.ts "<seed>" --output "<path>"`
- Also produces Personas, one of init's eight resource classes.

The skill also carries a `ReverseEngineering/` pipeline that reproduces matrix semantics through your own OpenAI key, without a Content Maxima login. **It is for your own client work only** — do not redistribute it, resell it, publish the prompts, or build a product on it. Prefer the official `Tools/` export whenever you have a subscription.

**If Playwright or the login blocks, report it and stop.** A hand-built substitute Matrix is worse than none, because the pages skill treats it as real keyword data.

### DataForSEO — optional but high value

| Job | Skill |
|-----|-------|
| On-page crawl | `dataforseo-onpage-crawl` |
| People Also Ask | `dataforseo-paa-queries` |
| Fanout / long tail | `dataforseo-fanout-queries` |

Credentials are REST basic auth (`DATAFORSEO_USERNAME` / `DATAFORSEO_PASSWORD`). Costs are per task and small individually.

**The crawl is a paid API and needs explicit approval in-session.** Init will not run it silently.

The crawl output is load-bearing for both tracks — it is how `pipeline-pages-init` knows what pages actually exist. If you skip it, you must supply an `onpage-crawl-*.csv` yourself.

### Gemini — optional, blog track only

Photo classification. `GEMINI_API_KEY`, default model `gemini-2.5-flash`, override with `PHOTO_LIBRARY_GEMINI_MODEL`. Cheap at library scale.

No key means no automated classification, which means no photo library, which means stage 3.5 always generates. That is a working configuration, just a less distinctive one.

### SerpAPI — optional, blog track only

The Google Business Profile photo path: `google_maps_photos`, category **By owner**. This is a dedicated path for a reason — a generic Maps image scrape returns interface chrome, one thumbnail, or photos of the wrong subject.

### Fal.ai — optional, blog track only

Image generation on a library miss. `FAL_AI_API_KEY` or `FAL_KEY`, default model `fal-ai/flux-2-pro`. Per-image cost.

Fal images are **outcome and feeling stills**, not mid-job process shots.

Do not substitute your host's built-in image generation. The skill expects Fal's output shape and file naming.

### Retell AI + Cloudflare — optional, voice interviews only

Retell bills per voice minute; Cloudflare Workers starts free. Full setup in [09-retell-voice-setup.md](09-retell-voice-setup.md).

A 30-minute owner interview is a real charge. Test on yourself first.

### SiteSwarm — optional, and never automatic

The taxonomy in `02-plan/siteswarm-tag-taxonomy.md` is written for SiteSwarm's `create_post.tag_list`, and polish output is shaped for its two content zones. But:

- A missing SiteSwarm site is not a hard stop. Write the taxonomy file anyway and record `site_id: none yet`.
- No skill in the suite pushes a post. Tags go live on your first real `create_post`.
- Never seed dummy posts to create tags.

The two-zone polish output pastes into any builder with a top and bottom content area.

## Companion skills for the eight resource classes

| Class | Companion skill |
|-------|-----------------|
| dossier | `business-dossier` |
| onpage | `dataforseo-onpage-crawl` |
| matrix | Content Maxima (Matrix workflow) |
| personas | Content Maxima (Personas workflow) |
| paa | `dataforseo-paa-queries` |
| fanout | `dataforseo-fanout-queries` |
| product_doc | `product-documentation` |
| icp | `customer-research` |

These are separate installs. Init dispatches whichever are missing, and only checks that a real, non-empty file landed in the right place — so a hand-written `Product-Documentation.md` counts.

`product-documentation` is the one you should not hand-wave. `owner-interview` compiles **through** it, and its evidence grid is what `pd-coverage.mjs` scores. Everything downstream that keeps the agent honest depends on that file being real.

`voice-extractor` is the same kind of companion for `voice-interview`: install it next to the suite skills if you want a spoken-source Voice DNA. It is not in the suite ZIP. `--prepare` prints the sibling schema path; the extractor writes the JSON you then `--land`.

## Environment variables

Set these as **user environment variables**, not files in a synced folder.

| Variable | Used by | Required? |
|----------|---------|-----------|
| `DATAFORSEO_USERNAME` / `DATAFORSEO_PASSWORD` | crawl, PAA, fanout | Only for those |
| `GEMINI_API_KEY` | photo classify | Blog track, if classifying |
| `PHOTO_LIBRARY_GEMINI_MODEL` | photo classify | No, has a default |
| `SERPAPI_API_KEY` | GBP owner photos | Blog track, if scraping GBP |
| `FAL_AI_API_KEY` or `FAL_KEY` | stage 3.5 | Blog track, if generating |
| `CONTENT_MAXIMA_SKILL_ROOT` | Matrix loop | Pages track |
| `CONTENT_MAXIMA_EMAIL` / `CONTENT_MAXIMA_PASSWORD` | Matrix, Personas | Pages track |
| `CONTENT_PIPELINE_ICM_TEMPLATE` | init scaffold | No, `--template` also works |
| `RETELL_API_KEY` | voice | Voice only |
| `OWNER_INTERVIEW_HOST_TOKEN` | voice | Voice only |
| `OWNER_INTERVIEW_HOST_URL` | voice | Voice only |
| `EXPERT_INTERVIEW_HOST_URL` | expert voice | No; falls back to `OWNER_INTERVIEW_HOST_URL` |
| `GOOGLE_WORKSPACE_CLI_CLIENT_ID` / `_SECRET` | expert calendar | Only if you send invites |

On Windows: **System Properties → Environment Variables → User variables.** Restart your agent host afterward.

`content-pipeline-run` also ships a `.env.example` you can copy to `.env` next to the skill for Fal. Never commit a `.env`.

## Cost gates

Three things in this suite spend money without you noticing, so all three are gated:

| Action | Gate |
|--------|------|
| Grok dossier compose | Explicit approval after a dry run |
| DataForSEO on-page crawl | Explicit approval; needs the dossier domain |
| DataForSEO PAA / fanout | Keywords required; a location required for PAA |

Content Maxima costs time and a login rather than metered spend, which is why the seed table is confirmed before the Matrix loop starts.

Fal and Gemini are per-call and small, but a careless loop is still a bill. One post, one invoke.

## The minimum viable setup

To run the pages track end to end on one client:

1. Node.js 20+ and an Agent Skills host
2. A non-Anthropic chat model
3. A Content Maxima account, with the `contentmaxima` skill installed per its `INSTALL.md`
4. A real `Product-Documentation.md` and an `onpage-crawl-*.csv` in `01-resources/`

Everything else is acceleration.

## Next

[11-troubleshooting.md](11-troubleshooting.md).
