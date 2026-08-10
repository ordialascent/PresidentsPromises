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
  README.md                       ← this file (the conventions)
  <term-years> <name>/            ← one directory per presidential term
    <year>-acceptance.md              ← source document, verbatim + numbered
    promises.yaml                     ← promises from the acceptance speech
    <year>-inaugural.md               ← another source document (same term)
    <year>-inaugural.promises.yaml    ← promises from the inaugural address
```

Directories are named `<start>-<end> <name>`, e.g. `2009-2013 Obama`,
`2021-2025 Biden`. A president who serves non-consecutive terms gets one
directory per term (e.g. `2017-2021 Trump` and `2025-2029 Trump`).

**A term can hold more than one source document.** Each is a
`<year>-<kind>.md` file (`<kind>` is `acceptance`, `inaugural`, …), numbered the
same way, and each pairs with its own promises file — so a promise's `¶ref` is
never ambiguous about which document it points into:

- `<year>-<kind>.md`  ↔  `<year>-<kind>.promises.yaml`
- the acceptance speech keeps the legacy flat name `promises.yaml`.

Example: `corpus/2009-2013 Obama/2008-acceptance.md` + `promises.yaml`, and
`corpus/2009-2013 Obama/2009-inaugural.md` + `2009-inaugural.promises.yaml`. The
app reads each promise's context (speaker / event / date / medium) from the
front-matter of the document that carries it, so adding a source kind is a data
addition, not a schema change.

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

A term can carry several source documents (see [Layout](#layout)). Each
`<year>-<kind>.md` source pairs with its own `<year>-<kind>.promises.yaml`, so a
promise's source is simply **the file it lives in** — no per-promise `source:`
tag, and its `¶ref` unambiguously points into that one document. The acceptance
speech keeps the flat `promises.yaml` for back-compat.

Adding a source kind (e.g. the inaugural address) is therefore just: drop in the
numbered `<year>-<kind>.md`, add a sibling `<year>-<kind>.promises.yaml`, and
extract. The app reads each promise's context — speaker, event, date, medium —
from the front-matter of the document that carries it, and the overview chart
surfaces a per-promise source tag automatically once a term draws on more than
one source. Give inaugural-address promise ids a term-year prefix
(`obama-2009-…`) so they never collide with the acceptance ids (`obama-2008-…`).

## Rules

1. **Verbatim only.** Speech bodies are transcribed from an authoritative
   source recorded in the front-matter; never typed from memory or paraphrased.
2. **Attribute the transcript.** `source_url` + `source_publisher` are required.
3. **Don't renumber cited lines** (see above).
4. **Measurable promises feed the app**, they don't get re-authored there:
   `src/content` consumes the curated subset; this corpus stays the record.
