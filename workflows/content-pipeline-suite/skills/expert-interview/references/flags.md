# Story bank flags

Entries land without approval. Flags carry review.

| Flag | Source | Digest | Operator action |
|------|--------|--------|-----------------|
| `publish_unclear` | Agent | Hidden | `--clear-flag --entry` or `--set-publish` |
| `sensitive` | Agent (price, customer name, medical, legal) | Hidden | `--clear-flag` after review, or keep |
| `pd_candidate` | Agent | Hidden | `--clear-flag --pd dismissed` or `--pd handoff` |

`--list-flags` prints open flags. `--list-held` prints withdrawn-call rows.

`--clear-flag --entry <id> --pd handoff` records `pd_handoff` on the entry and drops the `pd_candidate` flag. `--pd dismissed` drops the flag without a handoff.

`--set-publish --entry <id> --decision public|framing-only|internal` sets `publish_decision` only.

`--reclassify --input` JSON may set `status: superseded` (retires with reason) or override `theme`.

`--accept-call <call_id>` releases host ledger holds after a withdrawal review.
