# Presidents' Promises

A tool that makes the **ambiguity itself the object on screen**. For a given
political promise, the reader moves the disputed parameters — which figure is
the baseline, which date is the deadline — and watches the reading flip. The
flip is real and defensible in *both* directions. Surfacing that is the entire
product.

It is not a scorecard, not a fact-check, not a performance tracker. The reader
should leave understanding that "was the promise kept?" was never a
single-valued question. The longer aim: track each president's promises against
shared, transparent metrics — the kind of tracking most institutions take for
granted and government rarely gets.

## The first promise

> Barack Obama, Fiscal Responsibility Summit, 23 February 2009 —
> "cut the deficit we inherited in half by the end of my first term."

- **Baselines:** a stated **$1.30T** (said aloud; appears nowhere in the data)
  vs the recorded **FY2009** deficit (~$1.41T).
- **Deadlines:** **FY2012** (last full fiscal year of the term) vs **FY2013**
  (the fiscal year the term ended in).
- Rule: halve the baseline. Comparator: `lte` (a smaller deficit is toward the
  target).

Three of the four defensible readings say **missed**; one says **met** — the
recorded-FY2009 baseline at FY2013, by roughly $27B. The app does not resolve
that, and picks no default that favors either reading. Pinned in
`test/grid.test.ts`.

## Shape of the thing

One repo, deliberately. It is still early enough that a premature module split
would cost more than it buys, so the reusable chart lives here as an internal
primitive (`src/chart/`) that could be extracted later, not a separate package.

The domain is organized by **topic** (`src/content/`): a topic is one measurable
subject — the federal deficit — carrying one shared, cross-president series plus
the **promises** made about it. Comparing presidents on a topic is then
"iterate the topic's promises against the one series" — a data addition, not a
rebuild. Today the deficit topic holds one promise; the structure is built for
more.

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
npm test         # vitest: pins the deficit topic's reading grid
npm run build    # typecheck + static build to dist/
npm run refresh  # append-only pull of FYFSD from FRED (needs network to FRED)
```

Add a promise: append a `PromiseSpec` to the topic in `src/content/deficit.ts`.
Add a topic: create `src/content/<topic>.ts` and register it in
`src/content/index.ts`.

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
