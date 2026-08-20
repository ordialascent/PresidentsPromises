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
  promises/     the front-page board: the donut, the stacked chart, and the
                searchable list of every promise. fuzzy.ts is a domain-neutral
                string matcher; search.ts is the policy that ranks promises
                with it.
  components/   app-specific views (the reading grid).
  App.tsx       renders one topic and one of its promises.
data/           the append-only snapshot + its provenance docs.
scripts/        the insert-only refresh job.
```

## Invariant 1 — the reading is derived, never supplied

`met` / `missed` / `indeterminate` is computed by `deriveVerdict(series,
baseline, deadline, targetRule, comparator)` in `src/chart/logic`, and nowhere
else. No prop, type, or code path lets a caller hand a reading in. The whole
product is the claim that "was it kept?" is underdetermined; the moment a result
can be passed in, that claim is a lie. `test/grid.test.ts` pins the derived grid
and checks the indeterminate path.

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

## One filter state, four views, one direction

The board's page owns every filter — selected topics, shown tiers, the picked
bar block, the search text — and the donut, the tier legend, the chart and the
promise list are all renderings of it. None of them filters itself.

The filters are a **hierarchy**, and it only ever runs downward:

```
topics  →  categories (tiers)  →  bar blocks  →  search
```

Each level counts what the levels above it leave, and is blind to the levels
below. The donut is always the whole corpus by topic; the category legend counts
the selected topics; the bars draw those promises in the picked categories; the
search box narrows the list and nothing else. So no filter can change the numbers
a reader chose it by, and the way back is always where they left it. (An earlier
version had topics and tiers cross-filtering each other — each re-counted by the
other — which meant a click could move the chip you were about to click next.)

Every level also filters the *same way round*: a click narrows to what you
clicked, clicking it again releases it, and an empty selection means all of it.
Topics and categories are then the same gesture with the same way back. (The
category legend used to be the odd one out, inherited from when the chart was
the whole feature: it was a visibility toggle, so clicking "Partial" showed
everything *except* partial.)

The list underneath the chart is the standing view: it starts with **every**
promise and the levels above narrow it. That is the inversion of the earlier
flow, where the promises existed only inside a bar block and a click was the
only way to see any of them.

The one exception runs upward, and only to keep the state honest: a bar block
the levels above it have emptied is no longer drawn, so the page drops that
selection rather than leave a filter with no visible switch.

## The content model (shallow on purpose)

A **Topic** is one measurable subject carrying one shared, cross-president
`series`, the `terms` that annotate it, and the `promises` made about it. A
**PromiseSpec** is one promise (who, quote, baseline candidates, deadline
candidates, target rule). `toClaim(topic, promise)` adapts the pair into what
the chart consumes.

This is the seam the product is bending toward: **comparing presidents on a
topic is iterating that topic's promises against the one series** — a data
addition, not an architectural change. There is no plugin system, no per-promise
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
- Letting a filter re-count a level above it in the board's hierarchy. It reads
  as helpful ("show me the topic mix of what's left") and costs the reader the
  fixed frame they were navigating by.
