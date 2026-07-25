# Corpus — speeches & promises

The raw, sourced record the product rests on: candidates' **nomination
acceptance speeches**, verbatim, and the **promises** extracted from them. A
promise always cites the exact lines it came from, the same way every data
point carries its provenance.

Extraction (filling in the promises) is **step two**. This directory defines
the structure and holds the speeches.

## Layout

```
corpus/
  README.md                     ← this file (the conventions)
  <president>/                  ← one directory per president (slug: lowercase surname)
    <election-year>-acceptance.md   ← the speech, verbatim + numbered
    promises.yaml                   ← promises extracted from that president's speech(es)
```

Example: `corpus/obama/2008-acceptance.md`, `corpus/obama/promises.yaml`.

## Speech file

Markdown with a YAML front-matter header, then the speech body **1-to-1
verbatim** — no edits, no paraphrase — with paragraphs and sentences numbered
so any span can be referenced.

```markdown
---
president: Barack Obama
party: Democratic
office_sought: President
election_year: 2008
event: Democratic National Convention — nomination acceptance
date: 2008-08-28
venue: Invesco Field at Mile High, Denver, Colorado
source_url: https://www.presidency.ucsb.edu/...
source_publisher: The American Presidency Project (UC Santa Barbara)
retrieved_at: 2026-07-25
transcript_note: Verbatim. Paragraph/sentence numbering added for reference; wording unchanged.
---

## ¶1
1. First sentence of the first paragraph, verbatim.
2. Second sentence, verbatim.

## ¶2
1. First sentence of the second paragraph.
2. Second sentence.
3. Third sentence.
```

- **Paragraphs** are numbered `¶1, ¶2, …` in speech order.
- **Sentences** are the ordered list items under each paragraph.
- Wording is untouched. The only thing added is the numbering.

## Reference convention

`<paragraph>.<sentence>`, with ranges:

- `2.3` — paragraph 2, sentence 3
- `2.3-2.5` — sentences 3 through 5 of paragraph 2
- `2.5-3.1` — spans a paragraph boundary (¶2 s5 through ¶3 s1)

**Once a sentence has been cited by a promise, do not renumber it.** The
numbering is an identifier; renumbering silently breaks every reference to it
(same spirit as the append-only data rule). If a transcript must be corrected,
prefer adding, and update citing promises deliberately.

## Promise file (`promises.yaml`)

Human-curated. Each promise records what was said, where it was said, and
whether/how it can be measured. The `measurability` block mirrors the chart's
model (`src/content`), so a *measurable* promise maps straight onto a topic +
`PromiseSpec` with no reshaping.

```yaml
# Promises extracted from <president>'s nomination acceptance speech(es).
promises:
  - id: obama-2008-deficit             # stable slug
    speech: 2008-acceptance            # which speech file in this directory
    ref: "2.3-2.5"                     # paragraph.sentence span into that speech
    quote: >                           # verbatim, from exactly those sentences
      ...
    promise: >                         # concise restatement
      ...
    topic: deficit                     # links to a measurable topic (or null)
    measurability:
      status: measurable               # measurable | unmeasurable | unclear (TBD in step two)
      metric: FYFSD                    # data series id, if measurable
      comparator: lte                  # lte | gte
      target_rule: { kind: halve }     # halve | reduceByPercent | reduceToAbsolute
      baselines: []                    # candidate baselines (value/year), TBD
      deadlines: []                    # candidate deadlines (year), TBD
      notes: >
        ...
```

## Rules

1. **Verbatim only.** Speech bodies are transcribed from an authoritative
   source recorded in the front-matter; never typed from memory or paraphrased.
2. **Attribute the transcript.** `source_url` + `source_publisher` are required.
3. **Don't renumber cited lines** (see above).
4. **Measurable promises feed the app**, they don't get re-authored there:
   `src/content` consumes the curated subset; this corpus stays the record.
