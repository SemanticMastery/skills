# Optional Brainrot Shorts test (local)

Not a produce stage. `content-pipeline-run` still hard-stops after `3.6-schema`. Use this only when the operator asks to test a vertical short from an already-written slot.

## Key

- REST CLI: Windows User `BRAINROT_API_KEY`
- Docs: [REST](https://www.brainrotshorts.com/api-docs) · routing `.cursor/docs/brainrot-shorts.md`

## REST path

From the Operations workspace root, after `3.4-polish` exists:

```bash
node ".cursor/scripts/brainrot/cli.mjs" voiceover --title "Post NN shorts test" --from-md "{campaign_dir}/06-content-pipeline/03-write/3.4-polish/post-NN-polish/post-NN-polish.md"
```

That creates a **draft** project only. To spend credits:

```bash
node ".cursor/scripts/brainrot/cli.mjs" render --project-id proj_xxx --approve
node ".cursor/scripts/brainrot/cli.mjs" poll --project-id proj_xxx
```

Do not write the MP4 into `04-publish/` or invent a `3.6-video` folder unless the operator explicitly approves that structural change.
