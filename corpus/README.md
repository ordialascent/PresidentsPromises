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
  <term-years> <name>/          ← one directory per presidential term
    <election-year>-acceptance.md   ← the speech, verbatim + numbered
    promises.yaml                   ← promises extracted from that speech
```

Directories are named `<start>-<end> <name>`, e.g. `2009-2013 Obama`,
`2021-2025 Biden`. A president who serves non-consecutive terms gets one
directory per term (e.g. `2017-2021 Trump` and `2025-2029 Trump`), each holding
the acceptance speech that opened it.

Example: `corpus/2009-2013 Obama/2008-acceptance.md`, `corpus/2009-2013 Obama/promises.yaml`.

## Speech file

Markdown with a YAML front-matter header, then the speech body **1-to-1
verbatim** — no edits, no paraphrase — with paragraphs and sentences numbered
so any span can be referenced.

```markdown
---
name: Barack Obama
title: 'Address Accepting the Presidential Nomination at the Democratic National Convention in Denver: "The American Promise"'
type: speech
date_published: 2008-08-28
date_pulled: 2026-07-25
source_url: https://www.presidency.ucsb.edu/documents/address-accepting-the-presidential-nomination-the-democratic-national-convention-denver
source_publisher: Gerhard Peters and John T. Woolley, The American Presidency Project
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
- **Quote any front-matter value containing a colon** (like `title` above); an
  unquoted `key: text: more` is read as a nested mapping and breaks YAML.

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

## Sources beyond the acceptance speech

Today every promise in a term directory comes from that term's nomination
acceptance speech, so no promise names its source explicitly — it is implied by
the directory. As other sources are added (debates, official statements, other
speeches), a promise names its own with an optional single-line `source:` field,
and the source document lives alongside the acceptance speech in the same term
directory (numbered the same way). The app is already source-aware: the overview
chart carries a `source` per promise (defaulting to the acceptance speech) and
only surfaces it once a term actually draws on more than one.

```yaml
  - id: obama-2012-example
    ref: "12.1"
    source: 2012 town hall, Denver   # optional; omit for the acceptance speech
    ...
```

## Rules

1. **Verbatim only.** Speech bodies are transcribed from an authoritative
   source recorded in the front-matter; never typed from memory or paraphrased.
2. **Attribute the transcript.** `source_url` + `source_publisher` are required.
3. **Don't renumber cited lines** (see above).
4. **Measurable promises feed the app**, they don't get re-authored there:
   `src/content` consumes the curated subset; this corpus stays the record.
