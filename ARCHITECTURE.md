# Architecture

Two repositories, one dependency edge, and two invariants that future work must
not erode.

```
  ordialascent/AmbiguityGraphs   (public)   the reusable graph template
            ▲                                    zero domain knowledge
            │  depends on (git dependency)
            │
  ordialascent/PresidentsPromises (public)   the product + data layer
```

The app depends on the library. **The library never depends on the app**, and
never learns anything about it.

## Invariant 1 — the module boundary (a fence, not a guideline)

`AmbiguityGraphs` contains **zero domain vocabulary**. It speaks only in:

> claim · subject · series · target · period · baseline · deadline · comparator

No `promise`, `president`, `party`, `election`, `administration`, `kept`,
`broken`, `deficit`, `fiscal`, … anywhere in it — not in type names, props,
comments, docs, or examples. This is **executable**: the library's
`test/vocabulary-fence.test.ts` tokenizes its shipped surface (source,
examples, docs) against a domain denylist and fails the build on any hit.

Where a concept lives follows from one question — *can it be said in the eight
words above?*

| Belongs to the library (generic)                     | Belongs to the app (domain)                                   |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| series / baseline / deadline / target / comparator   | that the subject is the federal deficit                       |
| deriving met / missed / indeterminate                | the words "kept" / "broken", president names, term bands      |
| period bands as alternating labeled spans            | inauguration dates, the FY-attribution caveat                 |
| rendering, knobs, snap chips, scope windows          | the FYFSD sign/units transform, provenance strings            |

### Corollary — the reading is always derived, never supplied

There is no prop, type, or code path in the library that accepts a result. The
reading is computed by `deriveVerdict(series, baseline, deadline, targetRule,
comparator)` and nowhere else. The library's `test/derived-verdict.test.ts`
asserts, at build time, that no input type carries a field that could inject
one. The app is free to *use* the word "verdict"; the library is not free to
*accept* one.

### The transform sits next to the comparator

FYFSD is published surplus-positive / deficit-negative in USD millions. The app
measures the deficit as a positive magnitude in USD billions so that
`comparator: 'lte'` reads as "deficit at or below the target". That transform
lives in `src/claim/obamaDeficit2009.ts`, **immediately beside the comparator it
serves** — not in the data file, and not smuggled into the library.

## Invariant 2 — the data snapshot is append-only

`data/deficit_fyfsd.csv` is the audit trail, and the refresh job
(`scripts/refresh.mjs`) **only ever inserts**:

- A revised figure lands as a **new row** for the same `period` with a later
  `retrieved_at`. The old row stays.
- Nothing is ever updated in place; nothing is ever deleted.
- "Current" is resolved at read time as the **latest `retrieved_at` per
  period** (`src/data/snapshot.ts`). Older rows remain as the trail.
- **Provenance travels with each point** — `source_url`, `publisher`,
  `retrieved_at`, `retrieval_method` are columns on the row, not facts about the
  file.
- The scheduled workflow commits the appended rows. **Git history is the as-of
  log.**

A number silently overwriting an older one would destroy the trail the whole
product rests on. If you touch the refresh job, it must remain insert-only.

### Read at build time, not at render time

The site imports the committed snapshot at build time (`?raw` import, resolved
+ transformed in `src/claim/`). It does **not** fetch anything live at render
time for a verdict-bearing number. What ships is what was committed.

## The dependency wiring

The app pins the library as a git dependency:

```
"ambiguity-graphs": "github:ordialascent/AmbiguityGraphs#claude/presidents-promises-mvp-arch-h8jpbv"
```

On install, npm clones that ref and runs the library's `prepare` (tsup) to
produce `dist/`. **Hardening step for later:** pin to a commit SHA or a tag
instead of a moving branch, and/or publish the library to a registry, so builds
are reproducible independent of branch state.

## What would erode the design (don't)

- Adding a `subject`-specific concept to the library "just this once". Put it in
  the app; the fence test will catch the leak either way.
- Letting a caller pass a reading in "to save a computation". The whole point is
  that the reading is derived.
- Making the refresh job update a row in place. That silently rewrites history.
- Fetching a verdict-bearing figure live at render time. The commit is the
  record.
- Picking a default knob position that presents one reading as *the* answer. The
  four readings are shown together precisely so no single cell carries that
  weight.
