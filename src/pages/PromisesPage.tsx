import { PromisesChart } from '../promises/PromisesChart.js';
import { CORPUS_TERMS, CORPUS_PROMISE_COUNT } from '../content/promises.generated.js';

/**
 * Front page: every nomination-acceptance promise since 2000, one stacked bar
 * per president, split by how measurable each promise is. The point is not a
 * scorecard — it is how much of what candidates promise can even be checked.
 */
export function PromisesPage() {
  return (
    <div className="page">
      <header className="masthead">
        <div className="eyebrow">Presidents' Promises · nomination acceptance speeches</div>
        <h1>What can even be measured?</h1>
        <p className="subtitle">
          Every promise in each president's nomination acceptance speech since 2000, sorted by
          whether the promise carries what it takes to be checked at all — a named metric, a
          threshold, and a deadline. Most don't. This is the raw material the rest of the tool
          reads promise by promise; it takes no view on whether any promise was kept.
        </p>
        <p className="provenance">
          {CORPUS_PROMISE_COUNT} promises · {CORPUS_TERMS.length} terms · sources verbatim from The
          American Presidency Project
        </p>
      </header>

      <main>
        <PromisesChart
          terms={CORPUS_TERMS}
          onOpenPromise={(promise) => {
            // Per-promise analysis pages are a later feature. For now, the one
            // built page is the deficit deep-dive.
            void promise;
            window.location.hash = 'deficit';
          }}
        />

        <footer className="colophon">
          <p>
            “Measurable” is a property of the sentence, not a judgment of the president: a promise
            is <em>full</em> when it names a metric, a threshold, and a deadline; <em>partial</em>{' '}
            when one of those is missing or too vague; <em>none</em> when it is aspirational with no
            measurable quantity at all. Even a <em>full</em> promise is usually still disputable —
            which baseline, which endpoint — and that dispute is exactly what the per-promise view
            exists to show.
          </p>
          <p>
            The three colours are the flag's — Old Glory Red, Old Glory Blue, white — and they
            encode the measurability tier (full / partial / none), the same three for every
            president. They are not a party coding: no causation, no scorecard, no party comparison.
            Bars are ordered by term.
          </p>
          <p>
            For now every promise is drawn from a nomination acceptance speech, but each one already
            carries its own <em>source</em>, so other kinds — debates, official statements, other
            speeches — can be added without reshaping the model or this chart. See{' '}
            <a href="https://github.com/ordialascent/PresidentsPromises/blob/main/ARCHITECTURE.md">
              ARCHITECTURE.md
            </a>{' '}
            for the corpus and the measurability model.
          </p>
        </footer>
      </main>
    </div>
  );
}
