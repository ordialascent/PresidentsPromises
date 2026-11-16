# Corpus — speeches & promises

The raw, sourced record the product rests on: each term's source documents,
verbatim, and the **promises** extracted from them. A promise always cites the
exact lines it came from, the same way every data point carries its provenance.

How promises are extracted, cut, described and rated is defined in
[PROTOCOL.md](PROTOCOL.md). This file covers the layout and the source format.

## Layout

```
corpus/
  README.md                       ← this file (the conventions)
  <term-years> <name>/            ← one directory per presidential term
    <year>-acceptance.md              ← source document, verbatim + numbered
    <year>-inaugural.md               ← another source document (same term)
    <year>-debate.md                  ← the term's final general-election debate
    <year>-<kind>.screening.yaml      ← screening ledger: a decision per candidate sentence
    promises.yaml                     ← ALL of the term's promises, from every source
    verdicts.yaml                     ← kept/partly/broken verdicts with evidence (PROTOCOL.md §6)
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
- **Debates** add `speaker_label`: the exact label (after `¶n —`) of the
  president's turns. Only those turns are screened for promises.
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

Written under [PROTOCOL.md](PROTOCOL.md) and declares `protocol: 1`. The record
shape (kind, sources, type, theme, deadline, verifiability, uncertainty, links)
is defined in the protocol's [Records](PROTOCOL.md#records) section. A
commitment made in more than one source is **one promise** with several
`sources` occurrences (`in:` names the source kind), not two entries. Keep
promise ids prefixed with the **term's election year** (`obama-2008-…` for the
whole 2009–2013 term, whatever source a promise came from) so they stay unique.

## Debate source (`<year>-debate.md`) — winner only

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
4. **The corpus is the record.** The app is generated from it
   (`npm run build:corpus`); promises are never re-authored in the app.
