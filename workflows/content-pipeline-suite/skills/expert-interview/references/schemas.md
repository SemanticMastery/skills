# Expert interview schemas

JSON is authoritative. Markdown is the human twin. Every series and entry carries `speaker` (R5).

## Filenames (KTD7)

| Artifact | Path |
|----------|------|
| Series record | `01-intake/1.1-docs/interviews/expert/{Company}-expert-interview-series.{json,md}` |
| Transcript pair | `01-intake/1.1-docs/interviews/expert/{Company}-expert-transcript-c{NN}-{YYYY-MM-DD}.{json,md}` |
| Story bank | `06-content-pipeline/01-resources/{Company}-story-bank.json` |
| Digest | `06-content-pipeline/01-resources/{Company}-story-bank.md` |
| Agency settings | `{Agency}/agency-settings.json` (one level above the campaign) |

These names must not match owner-interview, dossier, ICP, or product-documentation regexes.

## Series record

```json
{
  "series_id": "hex",
  "link": "https://<neutral>/e/{agency}/{token}",
  "link_token": "hex",
  "status": "active",
  "speaker": "Jordan Hale",
  "owner_name": "Jordan Hale",
  "spokesperson_email": "josh@example.com",
  "timezone": "America/New_York",
  "cadence": { "freq": "weekly", "interval": 2, "byday": "MO" },
  "calendar": { "state": "pending" },
  "agency_slug": "example-agency",
  "campaign": "Ridgeline-Tree-Care",
  "company_name": "Ridgeline Tree Care",
  "agency_name": "Example-Agency",
  "steering": false,
  "topics": []
}
```

`calendar.state`: `pending` | `created` | `needs_update` | `paused` | `cancelled`.

## Bank entry

```json
{
  "entry_id": "call-a-1",
  "call_id": "call-a",
  "cycle_no": 1,
  "session_id": "sess-c1",
  "speaker": "Jordan Hale",
  "story_key": "oak",
  "headline": "Oak wilt on Maple Street",
  "words": "We caught it early on a red oak.",
  "theme": "",
  "publish_decision": "public",
  "flags": [],
  "status": "fresh",
  "held": false,
  "used_at": null,
  "pd_handoff": null
}
```

`status`: `fresh` | `used` | `retired` | `held` | `superseded`.
`publish_decision`: `public` | `framing-only` | `internal`.
`flags`: `publish_unclear` | `sensitive` | `pd_candidate`.

Merge on refresh is by `entry_id`. Existing `status`, `publish_decision`, and `flags` are never overwritten.

## Transcript

Host cycle export written as `{ cycle_no, session_id, calls }` plus campaign `speaker`.

## Digest

Markdown grouped by `theme` (or `Untagged`). Newest session first. Omits retired, flagged, internal, and held. Framing-only lines end with `(framing only — no specifics)`. Footer lists counts.

## agency-settings.json

See [agency-settings.md](agency-settings.md).
