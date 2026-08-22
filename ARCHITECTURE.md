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

## One filter state, four views

The board's page owns every filter — picked topics, picked categories, the
picked bar block, the search text — and the donut, the category legend, the
chart and the promise list are all renderings of it. None of them filters
itself.

They narrow in this order:

```
topics  →  categories (tiers)  →  bar blocks  →  search
```

The first two **count each other**, and that is deliberate: a category with no
promises on a topic should not offer that topic, and a topic with none in a
category should not offer that category. So the donut counts what the category
filter leaves — leaving only "full" re-proportions the ring and greys the topics
that tier has nothing for — while the legend counts what the topic filter
leaves.

The rule that keeps this from eating itself: **a view never narrows its own
counts.** The donut is counted over categories only, the legend over topics
only. Narrow your own counts and the click that got you there disappears, so
there is no way back.

Two things follow, and both are load-bearing:

- The legend's *shape* is fixed against the movement — a topic the categories
  have emptied stays in place at zero, greyed and unpickable, and every count is
  padded to the corpus's widest, so only the numbers ever change. A chip must
  never move out from under the cursor that is about to click it.
- A greyed chip must never still be filtering. When a category empties a topic
  that is currently picked, the page drops it from the selection — otherwise the
  reader is left with an unclickable control holding the board empty.

The last two levels only ever narrow downward. A bar block picks one president's
share of what the filters above leave, and the search box narrows the list
alone: it is the reader's own question, not a claim about the corpus, so it must
not re-proportion the donut or re-scale the bars behind it.

The list underneath the chart is the standing view: it starts with **every**
promise and everything above narrows it. That is the inversion of the earlier
flow, where the promises existed only inside a bar block and a click was the
only way to see any of them.

Both filters are **picked**, and identically: nothing picked means all of them,
a click picks one, clicking it again releases it, and picking every one is the
same as picking none. No click is a dead end in either, and neither needs a rule
the other doesn't have.

Their chips look the same for the same reason, and each is lit in the colour of
the thing it filters — topics in the red of their donut slices, categories in
the navy the bars are drawn in. A category chip keeps its swatch, because that
is the only thing tying it to the colour of the blocks it draws in the chart.

(The category legend was briefly a visibility toggle — all three lit, a click
hiding one — inherited from when the chart was the whole feature. Two controls,
side by side, that answered a click in opposite directions was the confusing
part, not either rule on its own.)

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
- Letting one of the board's views narrow its own counts. Topics and categories
  count each other so that neither offers a dead end; the moment either one also
  counts itself, the chip you clicked reads zero and the way back is gone.
- Letting the legend reflow — re-sorting it, dropping an emptied chip, or
  letting a count's width change — while a filter moves.
