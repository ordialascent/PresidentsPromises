# Architecture

One repo, kept deliberately lean. The product is still being discovered, so the
guiding rule is: **do not cement a structure the product hasn't asked for yet.**
Two invariants are load-bearing and worth protecting; almost everything else is
meant to be cheap to change.

## Layout

```
src/
  chart/        an internal, domain-neutral charting primitive (a parametric
                target: series + reader-controlled target + derived reading).
                Self-contained, so it can be extracted to its own package later
                — but only once the product proves it needs to be.
  content/      the domain. types.ts (Topic, PromiseSpec, Term), one file per
                topic (deficit.ts), and index.ts as a plain registry.
  data/         snapshot.ts parses the committed append-only CSV.
  promises/     the front-page board: the settings bar (terms, kind, scale), the chart,
                and the searchable, filterable list of every promise. fuzzy.ts is a domain-neutral
                string matcher; search.ts is the policy that ranks promises
                with it.
  App.tsx       renders the promises board.
data/           the append-only snapshot + its provenance docs.
scripts/        the insert-only refresh job.
```

## Invariant 1 — the reading is derived, never supplied

`met` / `missed` / `indeterminate` is computed by `deriveVerdict(series,
baseline, deadline, targetRule, comparator)` in `src/chart/logic`, and nowhere
else. No prop, type, or code path lets a caller hand a reading in. The whole
product is the claim that "was it kept?" is underdetermined; the moment a result
can be passed in, that claim is a lie. `test/grid.test.ts` pins the engine on a
synthetic fixture and checks the indeterminate path.

Kept/broken verdicts on corpus promises (`corpus/*/verdicts.yaml`) are a
different thing: they are judged by a reader under `corpus/PROTOCOL.md` §6,
and every one cites its evidence. The invariant above is about the chart
engine: a reading drawn from a series is always computed from the series.
`scripts/build-corpus.mjs` attaches each verdict to its promise (`verdict`);
`verdictFor` turns it into what the list and detail show, and `trackRecords`
counts them per term for the board's track-record table. A verdict with a
`review` note is provisional: it shows as "under review" and stays out of the
kept share until the note is removed. The track record always counts the whole
corpus; clicking a section sets the list's term and verdict filters to that
cell.

## Invariant 2 — the data snapshot is append-only

`data/deficit_fyfsd.csv` is the audit trail. The refresh job
(`scripts/refresh.mjs`) **only ever inserts**:

- A revised figure lands as a **new row** for the same `period` with a later
  `retrieved_at`. The old row stays.
- Nothing is updated in place; nothing is deleted.
- "Current" is resolved at read time as the **latest `retrieved_at` per
  period** (`src/data/snapshot.ts`).
- **Provenance travels with each point** (`source_url`, `publisher`,
  `retrieved_at`, `retrieval_method` are columns, not facts about the file).
- The site reads the committed snapshot at build time; it does not fetch a
  verdict-bearing figure live at render time. Git history is the as-of log.

## Kind and tier

Every record is a `promise` (firm language) or an `ambition` (wishes and
obligations, see `corpus/PROTOCOL.md`). The board shows one kind at a time: the
kind setting swaps what sits in each term's `promises` slot (`termsOfKind`), and
every view below reads that slot unchanged. Only promises can get a verdict.

A record's tier (`quality`) is its protocol verifiability level: `high`,
`medium` or `low`. Every term is extracted under the same protocol, so bars
compare directly and deltas are drawn between every pair of adjacent terms.

## One filter state, owned by the list

The page owns one filter state: a multi-select per facet (topic, president,
term, verifiability, verdict; `Filters` in `model.ts`) plus the search text.
It narrows **the list only**. The filter bar under the search box is where it
is shown and changed.

- Within a facet the picks are alternatives (Bush *or* Obama); across facets
  they narrow together (`filterRows`). Nothing picked means the facet is off.
- Each option shows how many rows it would leave given the *other* facets
  (`facetCounts`). A facet never counts against itself, so picking one option
  still shows what another would add. Options at zero are greyed but stay in
  place: menus never reshuffle under the cursor.
- The charts above always draw the whole corpus of the current kind. They are
  shortcuts into the filter bar: a bar block sets term + verifiability to that
  cell, a track-record section sets term + verdict, the tier and verdict
  legends toggle verifiability and verdict. Clicking the same cell again clears it. Cells the filters
  leave out are dimmed, so the charts show what the list is showing.
- Search narrows the list alone. It is the reader's own question, not a claim
  about the corpus.

The list is the standing view: it starts with every promise, and everything
above narrows it.

## The content model (shallow on purpose)

A **Topic** is one measurable subject carrying one shared, cross-president
`series`, the `terms` that annotate it, and the `promises` made about it. A
**PromiseSpec** is one promise (who, quote, baseline candidates, deadline
candidates, target rule). `toClaim(topic, promise)` adapts the pair into what
the chart consumes.

This is the seam the product is bending toward: **comparing presidents on a
topic is iterating that topic's promises against the one series** — a data
addition, not an architectural change. A topic's promises come only from the
corpus (the shared source types), never hand-entered from another occasion; the
deficit topic is empty until verdicts exist. There is no plugin system, no per-promise
component, no registry framework, because none of that is needed yet.

The sign/units transform (deficit = −FYFSD, into billions) lives in
`content/deficit.ts` next to the comparator it serves — not in the data file.

## What we deliberately deferred

An earlier design split the chart into its own repository behind an executable
"zero domain vocabulary" fence. That bought reusability the product cannot yet
specify, and taxed every pivot. It has been folded back in. The chart stays
domain-neutral **by convention** (so re-extraction is easy) but that neutrality
is no longer enforced by a test — the cost of the enforcement outweighed the
benefit at this stage. Revisit if and when a second consumer actually appears.

## What would erode the design (don't)

- Letting a caller pass a reading in "to save a computation".
- Making the refresh job update a row in place (that rewrites history).
- Fetching a verdict-bearing figure live at render time.
- Reaching for a topic/promise framework before there are enough topics and
  promises to justify one.
- Picking a default knob position that presents one reading as *the* answer. The
  readings are shown together precisely so no single cell carries that weight.
- Letting one of the board's views narrow its own counts. Topics and categories
  count each other so that neither offers a dead end; the moment either one also
  counts itself, the chip you clicked reads zero and the way back is gone.
- Letting the legend reflow — re-sorting it, dropping an emptied chip, or
  letting a count's width change — while a filter moves.
