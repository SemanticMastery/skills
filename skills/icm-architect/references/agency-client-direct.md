# Agency Client — Direct mode (`Client -> Campaign`)

White-label `Client -> Agency -> Campaign` is **out of scope**. This skill only scaffolds **Direct**.

## Always create

Under `{Client-Name}/{Campaign-Name}/`:

```text
01-intake/
02-deliverables/
03-decisions/
04-archives/
CAMPAIGN-CONTEXT.md
PROJECT-RULES.mdc
HOW-TO-WORK-THIS-PROJECT.md
```

Under `{Client-Name}/`:

```text
CLIENT-CONTEXT.md
```

Plus harness thin entrypoints at campaign root per `harness-map.md`.

## Optional nested modules (catalog only)

Propose from interview services. User may deselect at confirm. **Do not invent** folders outside this catalog — if unmapped, propose none for that service and ask.

### Intake (`01-intake/`)

| Module | When to propose |
|--------|-----------------|
| `1.1-docs` | Contracts, briefs, SOWs, onboarding docs |
| `1.2-audit` | SEO/site/local audits |
| `1.3-logo` | Brand marks / logo assets |
| `1.4-photos` | Photo / media intake |

### Deliverables (`02-deliverables/`)

| Module | When to propose |
|--------|-----------------|
| `2.1-links` | Link building / placements |
| `2.2-press-releases` | PR / press |
| `2.3-reports` | Recurring or one-shot reports |
| `2.4-schema` | Schema / structured data |
| `2.5-articles` | Article / blog content |
| `2.6-gb-posts` | Google Business Profile posts |

### Decisions (`03-decisions/`)

| Module | When to propose |
|--------|-----------------|
| `3.1-communications` | Client comms log / email threads worth keeping |
| `3.2-traces` | Decision traces / why-we-chose-X notes |

### Archives (`04-archives/`)

| Module | When to propose |
|--------|-----------------|
| `troubleshooting/` | Debug notes, failed experiments, incident notes |

## Explicitly excluded

- Campaign workbook `.xlsx`
- `One-Off-Orders/`
- Agency layer folders
- Freeform module names not in the catalog

## Client-level defaults

- Default: client folder + `CLIENT-CONTEXT.md` as **campaign index only**
- `archived-campaigns/` only if interview opted in (not recommended default)

## Display names vs folder slugs

Collect **both** for client and campaign:

| Placeholder | Use for |
|-------------|---------|
| `{{CLIENT_NAME}}` / `{{CAMPAIGN_NAME}}` | Titles, prose, handoff |
| `{{CLIENT_FOLDER}}` / `{{CAMPAIGN_FOLDER}}` | Real directory names and Path columns |

**Slug rules:** no spaces; prefer `Title-Case-With-Hyphens` or `lowercase-with-hyphens`; strip characters unsafe for folders. Proposal trees must show the folder path, not only the display name.

## Service → module heuristic (minimum)

| If user mentions… | Propose |
|-------------------|---------|
| docs, contract, brief, SOW, onboarding packet | `1.1-docs` |
| audit, technical SEO, site audit, local audit | `1.2-audit` |
| logo, brand mark | `1.3-logo` |
| photos, images, media kit | `1.4-photos` |
| links, link building, placements | `2.1-links` |
| press, PR, press release | `2.2-press-releases` |
| report, monthly report, ranking report | `2.3-reports` |
| schema, JSON-LD, structured data | `2.4-schema` |
| articles, blog, content writing | `2.5-articles` |
| GBP, Google Business, GMB posts | `2.6-gb-posts` |
| client emails, Slack with client, comms log | `3.1-communications` |
| decisions, decision log, traces | `3.2-traces` |
| troubleshooting, debug, incidents | `troubleshooting/` |

Unmapped services → ask; do not invent folder names.

## Templates

| File | Template |
|------|----------|
| `CLIENT-CONTEXT.md` | `templates/agency/CLIENT-CONTEXT.md` |
| `CAMPAIGN-CONTEXT.md` | `templates/agency/CAMPAIGN-CONTEXT.md` |
| `PROJECT-RULES.mdc` | `templates/agency/PROJECT-RULES.mdc` |
| `HOW-TO-WORK-THIS-PROJECT.md` | `templates/agency/HOW-TO-WORK-THIS-PROJECT.md` |

Placeholders: `{{CLIENT_NAME}}`, `{{CAMPAIGN_NAME}}`, `{{CLIENT_FOLDER}}`, `{{CAMPAIGN_FOLDER}}`, `{{GOAL}}`, `{{OUTCOME}}`, `{{TOOLS_SERVICES}}`, `{{MODULE_LIST}}`, `{{TASK_ROUTING_TABLE}}`, `{{WHY_STAGES_BLURB}}`, `{{HARNESS_NOTE}}`.

Fill `{{WHY_STAGES_BLURB}}` with a short, interview-specific rationale (why these stages/modules for this goal) — same substance as go-deeper, compressed for the handoff.

After write: verify no leftover `{{` in created files.
