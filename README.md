# Presidents' Promises

A tool that makes the **ambiguity itself the object on screen**. For a given
political promise, the reader moves the disputed parameters — which figure is
the baseline, which date is the deadline — and watches the verdict flip. The
flip is real and defensible in *both* directions. Surfacing that is the entire
product.

It is not a scorecard, not a fact-check, not a performance tracker. The reader
should leave understanding that "was the promise kept?" was never a
single-valued question.

## The seed claim

> Barack Obama, Fiscal Responsibility Summit, 23 February 2009 —
> "cut the deficit we inherited in half by the end of my first term."

- **Baselines:** a stated **$1.30T** (said aloud; appears nowhere in the data)
  vs the recorded **FY2009** deficit (~$1.41T).
- **Deadlines:** **FY2012** (strict end of term) vs **FY2013** (the fiscal year
  the term ended in).
- Rule: halve the baseline. Comparator: `lte` (a smaller deficit is toward the
  target).

Three of the four defensible readings say **missed**; one says **met** — the
recorded-FY2009 baseline at FY2013, by roughly $27B. The app does not resolve
that, and picks no default that favors either reading. The grid is pinned in
`test/grid.test.ts`.

## Architecture in one breath

The chart is rendered by [AmbiguityGraphs](https://github.com/ordialascent/AmbiguityGraphs),
a generic component library with **zero domain knowledge**. This repo is the
domain + data layer that consumes it. The reading (`met` / `missed` /
`indeterminate`) is **derived inside the library**, never passed in. See
[ARCHITECTURE.md](ARCHITECTURE.md) for the module boundary and the append-only
data rule — the two invariants the project rests on.

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
npm install     # installs deps incl. the library (git dependency)
npm run dev      # local dev server
npm test         # vitest: pins the 2x2 reading grid
npm run build    # typecheck + static build to dist/
npm run refresh  # append-only pull of FYFSD from FRED (needs network to FRED)
```

## Deploy

Static, no backend. GitHub Actions builds and deploys to GitHub Pages
(`.github/workflows/deploy.yml`); Pages source must be set to "GitHub Actions".
The Vite `base` defaults to `/PresidentsPromises/` (project page); set
`BASE_PATH=/` for a custom-domain or user-page deploy. The append-only refresh
runs on a monthly schedule (`.github/workflows/refresh.yml`).

## What this deliberately is not

No verdict emitted as fact, no aggregate score, no party coloring, no
cross-president comparison, no causal claims. It measures only whether a numeric
target was met under a given reading — never whether anyone caused it. Term
bands are names-only reading aids.
