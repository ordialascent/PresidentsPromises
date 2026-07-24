import { ParametricTarget } from 'ambiguity-graphs';
import { deficitClaim, provenance } from './claim/obamaDeficit2009.js';
import { ReadingGrid } from './components/ReadingGrid.js';

export function App() {
  return (
    <div className="page">
      <header className="masthead">
        <div className="eyebrow">Parametric claim · Archetype 01</div>
        <h1>“Cut the deficit we inherited in half by the end of my first term.”</h1>
        <p className="subtitle">
          Barack Obama, Fiscal Responsibility Summit, 23 February 2009. Whether that promise was
          kept has no single answer — it depends on two disputed choices: which figure counts as
          the baseline, and which fiscal year counts as the deadline. Move them below and watch the
          reading flip. The flip is real, and defensible, in both directions. That ambiguity is the
          whole point.
        </p>
        <p className="provenance">
          data as of {provenance.dataAsOf} · {provenance.publisher} · series {provenance.seriesId}
          {provenance.isBootstrap ? ' · hand-seeded bootstrap, pending first automated refresh' : ''}
        </p>
      </header>

      <main>
        <ParametricTarget claim={deficitClaim} />

        <section className="readings">
          <h2>The four readings</h2>
          <p className="readings-intro">
            Each cell below is a defensible reading of the same sentence. Three say the target was
            missed; one says it was met — the recorded-FY2009 baseline evaluated at FY2013, met by
            a hair. This tool does not choose one, and picks no default that favors either.
          </p>
          <ReadingGrid />
        </section>

        <footer className="colophon">
          <p>
            This measures only whether a numeric target was met under a given reading. It makes no
            claim about who or what caused the deficit to move — no causation, no scorecard, no
            party comparison. Term bands are names-only reading aids.
          </p>
          <p>
            The chart is rendered by{' '}
            <a href="https://github.com/ordialascent/AmbiguityGraphs">AmbiguityGraphs</a>, a generic
            component library that carries no domain knowledge: the reading is derived inside it from
            the parameters, never passed in. Data is CC0. See{' '}
            <a href="https://github.com/ordialascent/PresidentsPromises/blob/main/ARCHITECTURE.md">
              ARCHITECTURE.md
            </a>{' '}
            for the module boundary and the append-only data rule.
          </p>
        </footer>
      </main>
    </div>
  );
}
