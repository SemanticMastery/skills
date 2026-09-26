# Owner-interview agent regression

Human-run after prompt edits. Do not date this file until a run happens.

Worker URL:  
Retell agent ID:  
Date run:

## Script

1. Open a fresh `/s/:session` link. Confirm the notice names agency, owner, and company. Confirm nothing connects before Start.
2. Press Start. Allow the microphone. Confirm "Connecting…" then the permission card.
3. Say "yes" to recording. Confirm the first pack question is asked, not an invented one.
4. Answer the parent of a Publish? question. Tap `internal` before the Publish? is spoken. Confirm the agent does not fight the tap.
5. On a Verify question, confirm the claim. Confirm `verify: "true"` is reported.
6. Mid-call, say you want to stop being recorded. Confirm the session ends withdrawn and a later pull without `--accept-withdrawn` writes nothing.
7. Repeat Start on a dropped session after ack. Confirm it resumes remaining questions.
8. Refuse consent on a new session. Confirm the call is deleted from Retell.

## Result

Pass / fail notes:
