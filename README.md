# Presidents' Promises

What US presidents promise, and how checkable those promises are. Every promise
is pulled from the same kinds of speeches for every president, cites the lines
it came from, and is rated for how verifiable it is. Where a promise can be
checked, the reader will be able to move the disputed parameters — which figure
is the baseline, which date is the deadline — and see whether the reading
flips. Language is ambiguous; the product shows that ambiguity instead of
hiding it.

It is not a scorecard, not a fact-check, not a performance tracker. The reader
should leave understanding that "was the promise kept?" was never a
single-valued question. The longer aim: track each president's promises against
shared, transparent metrics — the kind of tracking most institutions take for
granted and government rarely gets.

## What it covers

Every promise comes from the same three source types, for every term:

- the **nomination acceptance speech**,
- the **final general-election debate** (the winner's turns only),
- the **inaugural address**.

Seven terms so far (2001–2029). Each source is kept verbatim and numbered in
`corpus/`, and every promise cites the exact lines it came from. How a sentence
becomes a promise (or an ambition, or nothing) is written down in
[corpus/PROTOCOL.md](corpus/PROTOCOL.md) and applied the same way to every
president. A statement from any other kind of occasion (a summit, an interview,
a press release) is not used, because not every president has one.

Kept/broken readings are not published yet.

## Shape of the thing

One repo, deliberately. It is still early enough that a premature module split
would cost more than it buys, so the reusable chart lives here as an internal
primitive (`src/chart/`) that could be extracted later, not a separate package.

The domain is organized by **topic** (`src/content/`): a topic is one measurable
subject — the federal deficit — carrying one shared, cross-president series plus
the **promises** made about it. Comparing presidents on a topic is then
"iterate the topic's promises against the one series" — a data addition, not a
rebuild. The deficit topic holds the series and the reading engine; its promises
will come from the corpus.

The reading (`met` / `missed` / `indeterminate`) is always **derived** from
`(series, baseline, deadline, targetRule, comparator)` — there is no code path
that lets a caller hand one in. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Data

Federal deficit series **FYFSD** (OMB, via FRED). The snapshot under `data/` is
**append-only**: a revised figure is inserted as a new row with a later
`retrieved_at`, never an in-place edit, and "current" resolves to the latest per
period. Provenance travels with each point. See [data/README.md](data/README.md).

> The committed values are currently `manual-bootstrap` (hand-seeded, because the
> build environment had no network route to FRED). The first automated refresh
> from a network that can reach FRED supersedes them by recency.

## Develop

```
npm install      # react + vite; no external chart dependency
npm run dev      # local dev server
npm test         # vitest: corpus snapshot, board filters, reading engine
npm run validate # checks every promise's ids, refs and quotes against the sources
npm run build    # typecheck + static build to dist/
npm run refresh  # append-only pull of FYFSD from FRED (needs network to FRED)
```

Add or change promises: edit `corpus/<term>/promises.yaml` following
`corpus/PROTOCOL.md`, then `npm run validate` and `npm run build:corpus`.

## Deploy

Static, no backend. GitHub Actions builds and deploys to GitHub Pages
(`.github/workflows/deploy.yml`, from `main`); Pages source must be set to
"GitHub Actions". The Vite `base` defaults to `/PresidentsPromises/`; set
`BASE_PATH=/` for a custom-domain or user-page deploy. The append-only refresh
runs on a monthly schedule (`.github/workflows/refresh.yml`).

## What this deliberately is not

No reading emitted as fact, no aggregate score, no party coloring, no causal
claims. It measures only whether a numeric target was met under a given
reading — never whether anyone caused it. Term bands are names-only reading aids.
Comparing presidents means measuring their promises against the same metric, not
ranking them.
