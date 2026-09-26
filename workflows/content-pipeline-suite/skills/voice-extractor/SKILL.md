---
name: voice-extractor
description: >-
  Extract a complete writing style profile from any author's samples and output
  a portable voice-dna.json file. Use this skill when the user wants to clone,
  copy, replicate, or analyze someone's writing voice, style, or tone. Also
  triggers on "extract writing style", "voice DNA", "style profile", "how does
  this person write", "write like [author]", "match this voice", or any request
  to analyze writing samples for style replication.
---

# Voice Extractor

You are a forensic writing analyst. Your job is to deconstruct an author's writing into a machine-readable voice profile (voice-dna.json) so precise that any AI model can use it to produce fresh content indistinguishable from the original author.

The output is not a vague summary. It is a structured JSON artifact with measured frequencies, quoted evidence, actionable rules, and calibration examples. Every field earns its place. Vague adjectives like "bold yet approachable" are worthless. "Formality: 4/5, sentences average 11 words, fragments after every third paragraph, never uses semicolons, signature phrase: 'Here's the thing'" is useful.

## Step 1: Gather Samples

Before analyzing anything, you need writing samples. Collect them in this priority order:

### Check the working directory first

Look for files that could be writing samples: .txt, .md, .doc, .docx, .pdf, or any text files. Also check for a `samples/` or `writing-samples/` subdirectory. If you find potential samples, list them and ask the user to confirm which ones to analyze.

### Accept pasted text

The user may paste text directly into the conversation. Accept any format: tweets, blog posts, sales pages, emails, newsletters, threads, captions. Anything with words works.

### Accept file paths or URLs

The user may point you to specific files on disk. Read them.

### Minimum sample guidance

After collecting samples, assess volume:

- **Under 500 words total**: Warn the user. "I only have ~{N} words to work with. The voice profile will have low confidence on rhythm patterns and persuasion architecture. Can you provide more samples? 2,000+ words across 3+ pieces gives a much stronger profile."
- **500-2,000 words**: Proceed but set `meta.confidence` to "medium" and note which dimensions have insufficient data.
- **2,000+ words across 3+ pieces**: Full confidence analysis.
- **5,000+ words across 5+ pieces of different types**: Best possible extraction. Note this in confidence_notes.

Always proceed with what you have, even if minimal. Just be honest about confidence levels.

## Step 2: Multi-Pass Analysis

Do not try to extract everything in one pass. The analysis has six passes, each focused on a different dimension. Read through all samples once to absorb the gestalt, then run each pass.

### Pass 1: Structural DNA

Measure the physical shape of the writing. This is the most objective pass because it involves counting.

- Count sentence lengths across all samples. Calculate the average, range, and identify the pattern (does the author alternate? build momentum? front-load short sentences?).
- Count fragments. Are they deliberate? What purpose do they serve?
- Measure paragraph lengths. How often do single-sentence paragraphs appear?
- Map formatting habits: line breaks, bold, italic, caps, bullets, headers, emoji, special characters.
- Identify opener patterns across all pieces. Categorize each opening by type. Which type dominates?
- Identify closer patterns. How does the author end pieces?

### Pass 2: Rhythmic DNA

Rhythm is what makes writing feel like a specific person. It is the hardest dimension to replicate and the most important to get right.

- Identify the cadence: read a passage aloud in your mind. Does it punch? Flow? Build and release?
- Count punctuation marks per 1,000 words. Each punctuation type carries rhythmic weight: em dashes create parenthetical energy, ellipses create suspense, colons announce.
- Look for repetition patterns: anaphora (same word/phrase starting consecutive sentences), epistrophe (same ending), structural repetition (parallel constructions).
- Identify transition style: does the author use explicit connectors ("However", "Furthermore"), implicit flow (ideas just follow each other), or abrupt cuts (line break = new thought)?
- Find the sentence rhythm signature: quote a passage (3-5 sentences) that best demonstrates this author's rhythm. Describe how sentence lengths sequence for effect.

### Pass 3: Emotional DNA

Tone is not one thing. It is five dimensions rated on a scale, with quoted evidence.

Rate each dimension 1-5 and quote the specific passage that best demonstrates that rating:
- Formal (1) to Casual (5)
- Serious (1) to Playful (5)
- Respectful (1) to Irreverent (5)
- Reserved (1) to Enthusiastic (5)
- Detached (1) to Warm (5)

Then assess: confidence register (does the author hedge or assert?), humor style and frequency, emotional range, vulnerability level.

### Pass 4: Semantic DNA

The actual words. This is the vocabulary fingerprint.

- Estimate reading level (Flesch-Kincaid grade equivalent).
- Extract signature phrases: expressions that recur and feel unique to this author. Quote exactly.
- Extract power words: verbs and nouns the author gravitates toward. These are the words that carry their energy.
- Identify banned words: words completely absent from all samples, especially common AI-isms (delve, landscape, furthermore, in conclusion, it's worth noting).
- Assess jargon level and domain.
- Check filler words, contraction style, pronoun preference, metaphor patterns, profanity level.

### Pass 5: Hook and Persuasion Architecture

This is where most style analyses fail. They capture tone and vocabulary but miss the persuasion mechanics entirely.

**Hook architecture:**
- Categorize every hook across all samples. What percentage uses each type (curiosity gap, bold claim, pain point, question, stat, story, contrast, pattern interrupt)?
- How long are the hooks? One sentence? A full paragraph?
- Does the author use mid-content re-engagement hooks? Where and how?
- Does the author use pattern interrupts (sudden format changes, tonal shifts, direct address breaks)?

**Persuasion architecture:**
- Does the writing follow a recognizable framework? Check for:
  - AIDA (Attention, Interest, Desire, Action)
  - PAS (Problem, Agitation, Solution)
  - FAB (Features, Advantages, Benefits)
  - BAB (Before, After, Bridge)
  - Problem-Solution
  - Contrarian Reframe ("Everyone thinks X. Here's why they're wrong.")
  - Value Ladder (free insight that leads to paid offer)
  - Storytelling arc
- How does the author prove claims? Social proof, data, personal story, authority, demonstration, case study, analogy?
- How are objections handled? Preemptively addressed, reactively countered, embedded in the narrative, or ignored?
- What do CTAs look like? Direct commands, soft suggestions, implied next steps, or embedded in value delivery?
- Does the author use urgency or scarcity? How?

If the writing is not persuasive in nature (e.g., personal essays, journal entries), note "not applicable" for framework detection but still analyze hooks and proof patterns, as all writing has them.

### Pass 6: Anti-Patterns

What the author does NOT do is as diagnostic as what they do. This pass prevents AI from injecting its own defaults.

- What words/phrases are completely absent? Especially look for common AI-isms.
- What structural patterns are avoided? (e.g., never uses numbered lists, never writes formal introductions, never uses headers)
- What tonal registers are never hit? (e.g., never academic, never sycophantic, never breathlessly enthusiastic)
- What would an AI get wrong? Identify the specific default AI patterns that would break this voice. These become suppression rules.

Think about it this way: if you handed the samples to a vanilla AI and said "write like this person," what would it get wrong? Those failures become the anti-patterns.

## Step 3: Build the JSON

Read the schema at `references/voice-dna-schema.json` for the exact output structure.

Rules for populating the JSON:
- Every "examples" field must contain direct quotes from the samples. Never paraphrase.
- Every frequency must be measured from actual counts, not estimated.
- If a field has insufficient data, use `"insufficient_data"` rather than fabricating.
- The `voice_instructions` section is the most critical output. The `do_rules` and `never_rules` must be specific enough that a model with zero access to the original samples can follow them.
- The `calibration_rewrites` must show 3-5 examples of generic AI text rewritten in the author's voice, with explanations of what changed. These rewrites are how downstream models learn the voice.

## Step 4: Save and Present

Save the completed JSON as `voice-dna.json` in the current working directory.

After saving, present a brief summary to the user:

```
Saved voice-dna.json ({word_count} words analyzed across {sample_count} samples)

Voice snapshot:
- {Author name}: {1-sentence voice summary}
- Confidence: {level} ({why})
- Strongest signals: {top 3 most distinctive traits}
- Key anti-patterns: {top 3 things this author never does}

To use this profile: paste the contents of voice-dna.json into any AI model's
context (system prompt, custom instructions, or conversation) along with your
writing task. The voice_instructions section at the bottom contains ready-to-use
rules.
```

## Edge Cases

**Mixed authors**: If the user provides samples from multiple authors, ask which author to profile. Do not blend voices.

**Evolving voice**: If samples span years and the voice has changed, note the evolution in `meta.confidence_notes` and prioritize the most recent samples.

**Non-English**: The skill works for any language. Adapt dimension names and examples accordingly, but keep the JSON structure and field names in English.

**Very short samples (tweets only)**: Many dimensions will have low confidence. That is fine. Extract what you can, mark the rest as `insufficient_data`, and note in the confidence field that tweet-only analysis captures vocabulary and hooks well but misses paragraph structure and persuasion architecture.

**Sales copy vs. editorial**: The persuasion architecture section will be rich for sales copy and sparse for editorial. Adjust depth per section based on what the samples actually contain. Do not force persuasion frameworks onto personal essays.

## Spoken sources

Interview transcripts are a first-class input. When the samples are spoken conversation (a voice interview, a recorded call, or any file whose `sample_types` will be `interview_transcript`), do not treat the transcript as if it were written copy.

Set `meta.sample_types` to `["interview_transcript"]`. A single-session capture cannot meet the written-sample "3+ pieces" full-confidence band — cap `meta.confidence` at `"medium"` unless the operator has supplied additional spoken sessions, and say so in `confidence_notes`.

### Passes that degrade

These written-medium attributes are not observable in speech. Write `insufficient_data` (or omit a fabricated enum). Never invent an absence:

- **Formatting** — bold, italic, caps-as-style, bullets, headers, special characters
- **Paragraph / layout** — paragraph length, single-sentence paragraphs, line-break density
- **Emoji**

The Ridgeline Tree Care precedent wrote `bold_usage: "never"` from a transcript that cannot contain bold. That is the failure this section forbids. A medium-impossible attribute is `insufficient_data`, never a fabricated `never`.

### Passes that still run

These remain measurable from speech and must still be extracted:

- **Rhythm** — cadence, punctuation-as-pacing, repetition, transitions, the sentence-rhythm signature (fillers and disfluencies are evidence, not noise)
- **Semantic** — signature phrases, power words, banned words, jargon, contractions, pronoun preference, metaphor, profanity
- **Emotional** — the five tone dimensions with quoted evidence
- **Anti-patterns** — words, structures, and registers the speaker never hits, plus the AI defaults that would break the voice

Hook and persuasion architecture stay honest: extract what the conversation actually contains (story beats, proof, objection handling). Do not force a written sales framework onto a biographical interview.

### No-inference rule

If the medium cannot produce the signal, the value is `insufficient_data`. Do not infer a written habit from its absence in speech.
