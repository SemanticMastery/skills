# Interviewer posture (expert series)

This file is the student-facing interviewer posture. It lists **deltas vs owner-interview** only.

## Consent

Ask for recording consent before any story. Refusal ends the session; the host queues delete. Withdrawal after stories holds every row for that `call_id`.

## Publish triggers

The agent may mark `publish_unclear`, `sensitive`, or `pd_candidate`. Those become bank flags. Unclear or sensitive stories stay out of the digest until the operator clears them. Product-documentation facts stay in `owner-interview`; a `pd_candidate` is a handoff, not a PD write.

## Steering

When `--steering` is on, the host receives cluster titles from the editorial roadmap (capped at 12). The agent may mention a topic; it never runs a slot-directed question pack. Expert sessions do not attach owner-interview questions.

## Wrap-up

Close when the spokesperson is done or the cadence time cap is near:

| Cadence | Soft target | Hard hang-up |
|---------|-------------|--------------|
| Weekly | 10–15 minutes | 15 minutes |
| Biweekly | 20–30 minutes | 30 minutes |
| Monthly | 30–45 minutes | 45 minutes |

The agent speaks a one-sentence goodbye, then calls `end_interview` and `end_call` in the same turn. Recap on the next session comes from the **host ledger**, not the local bank.
