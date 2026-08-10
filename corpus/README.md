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
    <year>-inaugural.md               ← another source document (same term)
    <year>-debate.md                  ← the term's final general-election debate
    promises.yaml                     ← ALL of the term's promises, from every source
```

Directories are named `<start>-<end> <name>`, e.g. `2009-2013 Obama`,
`2021-2025 Biden`. A president who serves non-consecutive terms gets one
directory per term (e.g. `2017-2021 Trump` and `2025-2029 Trump`).

**A term can hold more than one source document** — each a `<year>-<kind>.md`
file (`<kind>` is `acceptance`, `inaugural`, `debate`, …), numbered the same way. But there
is **one `promises.yaml` per term** that aggregates every promise the term made,
across all of its sources. The promise is the unit (the *commitment*); each
promise lists where it was said (see [the promise file](#promise-file-promisesyaml)).
The app reads each occurrence's context — speaker / event / date / medium — from
the front-matter of the document that carries it, so adding a source kind is a
data addition, not a schema change.

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

A promise is scored on four dimensions (`metric` / `threshold` / `deadline` /
`instrument`, each `present:` + details) that decide `measurable: full | partial
| no`. **Single-source** promise — top-level `ref` + `quote`, which default to
the term's acceptance speech:

```yaml
  - id: obama-2008-oil-mideast         # stable slug, prefixed with the term's election year
    ref: "¶44.1"                       # paragraph.sentence span into the acceptance speech
    theme: energy
    quote: >                           # verbatim, from exactly those sentences
      ...
    restatement: End US dependence on Middle East oil within ten years.
    metric:     { present: true, quantity: ..., record: ... }
    threshold:  { present: true, stated: to zero }
    deadline:   { present: true, stated: in ten years }
    instrument: { present: true, stated: ... }
    measurable: "full"
    notes: >
      ...
```

## Sources beyond the acceptance speech

The promise is the **unit** — the commitment — and it lists every occurrence:
where and when it was said. A commitment made in more than one source (say the
acceptance speech *and* the inaugural) is **one promise** with a `sources:` list,
not two entries. Replace the top-level `ref`/`quote` with the list; `in:` names
the source kind (`acceptance`, `inaugural`, …), which the generator resolves to
the term's `<year>-<kind>.md` for that occurrence's context:

```yaml
  - id: obama-2008-oil-mideast
    theme: energy
    restatement: End US dependence on Middle East oil within ten years.
    sources:
      - in: acceptance
        ref: "¶44.1"
        quote: >
          ...
      - in: inaugural
        ref: "¶9.2"
        quote: >
          ...
    metric: { ... }
    # ... same four-dimension scoring + measurable + notes
```

The four-dimension scoring stays at the promise level (it's a property of the
commitment; if two phrasings differ materially, note it). The occurrence count is
the recurrence signal (how often the thing was promised). Adding a source kind is
just: drop in the numbered `<year>-<kind>.md`, then either add its promises to
`promises.yaml` or attach an `in: <kind>` occurrence to an existing promise. Keep
promise ids prefixed with the **term's election year** (`obama-2008-…` for the
whole 2009–2013 term, whatever source a promise came from) so they stay unique.

### Debate source (`<year>-debate.md`) — winner only

The third source per term is the **final general-election debate** of the cycle
(the last time the two nominees face each other before the vote — arguably where
promises count the most). Its front-matter uses `type: debate`, and `name` is the
**eventual president** — the one nominee whose promises this corpus tracks.

A debate is a two-person transcript, so we deviate from "verbatim whole
document" in one controlled way: **paste the full transcript and number it** (so
refs match the source), but **extract promises only from the eventual
president's turns** — the winner-only convention. We do not score the opponent's
commitments; this corpus follows presidents through their term, and the loser
never gets one. Cite refs into the numbered debate exactly like any other source
(`in: debate`).

## Rules

1. **Verbatim only.** Speech bodies are transcribed from an authoritative
   source recorded in the front-matter; never typed from memory or paraphrased.
2. **Attribute the transcript.** `source_url` + `source_publisher` are required.
3. **Don't renumber cited lines** (see above).
4. **Measurable promises feed the app**, they don't get re-authored there:
   `src/content` consumes the curated subset; this corpus stays the record.
