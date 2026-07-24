import { ParametricTarget } from './chart/index.js';
import { deficitTopic, toClaim } from './content/deficit.js';
import { ReadingGrid } from './components/ReadingGrid.js';

export function App() {
  const topic = deficitTopic;
  // One promise for now; the topic is built to carry every president's.
  const promise = topic.promises[0]!;
  const claim = toClaim(topic, promise);
  const { provenance } = topic;

  return (
    <div className="page">
      <header className="masthead">
        <div className="eyebrow">
          Topic · {topic.title} — {topic.promises.length} promise{topic.promises.length === 1 ? '' : 's'} tracked
        </div>
        <h1>“{promise.quote}”</h1>
        <p className="subtitle">
          {promise.who}, {promise.occasion}, {promise.date}. Whether that promise was kept has no
          single answer — it depends on two disputed choices: which figure counts as the baseline,
          and which fiscal year counts as the deadline. Move them below and watch the reading flip.
          The flip is real, and defensible, in both directions. That ambiguity is the whole point.
        </p>
        <p className="provenance">
          data as of {provenance.dataAsOf} · {provenance.publisher} · series {provenance.seriesId}
          {provenance.isBootstrap ? ' · hand-seeded bootstrap, pending first automated refresh' : ''}
        </p>
      </header>

      <main>
        <ParametricTarget claim={claim} />

        <section className="readings">
          <h2>Every reading of this promise</h2>
          <p className="readings-intro">
            Each cell is a defensible reading of the same sentence. Three say the target was missed;
            one says it was met — the recorded-FY2009 baseline evaluated at FY2013, met by a hair.
            This tool does not choose one, and picks no default that favors either.
          </p>
          <ReadingGrid topic={topic} promise={promise} />
        </section>

        <footer className="colophon">
          <p>
            The federal deficit is one <em>topic</em>. The same series carries every term on this
            chart, so the longer aim is to measure each president's promises against a shared,
            transparent metric — the kind of tracking most institutions take for granted and
            government rarely gets. This page is the first promise on the first topic.
          </p>
          <p>
            This measures only whether a numeric target was met under a given reading. It makes no
            claim about who or what caused the deficit to move — no causation, no scorecard, no
            party comparison. Term bands are names-only reading aids. See{' '}
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
