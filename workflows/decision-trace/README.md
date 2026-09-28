# Decision trace

Install `dtc-video`, `cognee-decision-trace-capture`, and `video-feedback` together. `/dtc-video` is the entry point for a Cap recording. `/capture-trace` runs the governor directly.

| Skill | What it does |
|---|---|
| `dtc-video` | Reads a Cap and hands the evidence to the governor |
| `cognee-decision-trace-capture` | Resolves IDs, confirms, stores the decision, and writes the local JSON mirror |
| `video-feedback` | Optional. Pulls on-screen evidence when the transcript is not enough |

See `INSTALL.md`. The public copy uses `client_id`, `order_id`, `company`, and `service`. A private overlay is not included.

**License:** Semantic Mastery Member License. See LICENSE-MEMBERS.md at the repository root.
