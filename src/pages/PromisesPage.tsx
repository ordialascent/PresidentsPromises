import { useMemo, useState } from 'react';
import { PromisesChart } from '../promises/PromisesChart.js';
import { TopicDonut } from '../promises/TopicDonut.js';
import { topicCounts } from '../promises/model.js';
import { CORPUS_TERMS, CORPUS_PROMISE_COUNT } from '../content/promises.generated.js';

/**
 * Front page: every nomination-acceptance promise since 2000, one stacked bar
 * per president, split by how measurable each promise is. The point is not a
 * scorecard — it is how much of what candidates promise can even be checked.
 */
export function PromisesPage() {
  const [topic, setTopic] = useState<string | null>(null);
  const topics = useMemo(() => topicCounts(CORPUS_TERMS), []);

  // Selecting a topic filters the bars to that topic's promises. Memoised by
  // `topic` so the array identity is stable — the chart only resets its own
  // block-selection when the filter actually changes.
  const terms = useMemo(
    () =>
      topic == null
        ? CORPUS_TERMS
        : CORPUS_TERMS.map((t) => ({ ...t, promises: t.promises.filter((p) => p.theme === topic) })),
    [topic],
  );

  return (
    <div className="page">
      <header className="masthead">
        <h1>The Promises Presidents Make</h1>
        <p className="subtitle">
          A collection of promises from comparable and authoritative sources, starting in 2000, categorized by verifiability.
        </p>
        <p className="provenance">
          {CORPUS_PROMISE_COUNT} promises · {CORPUS_TERMS.length} terms · sources verbatim
        </p>
      </header>

      <main>
        <TopicDonut
          topics={topics}
          total={CORPUS_PROMISE_COUNT}
          selected={topic}
          onSelect={setTopic}
        />

        <PromisesChart terms={terms} />

        <footer className="colophon">
          <div className="colophon-cols">
            <section className="colophon-box">
              <p>Verifiability judges the proposition, not the president.</p>
              <table className="veri-table">
                <thead>
                  <tr>
                    <th className="veri-swatch-col" aria-hidden="true" />
                    <th scope="col" aria-label="Verifiability tier" />
                    <th scope="col">Metric</th>
                    <th scope="col">Threshold</th>
                    <th scope="col">Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="veri-swatch" data-q="full" aria-hidden="true" />
                    <th scope="row">Full</th>
                    <td className="veri-yes">✓</td>
                    <td className="veri-yes">✓</td>
                    <td className="veri-yes">✓</td>
                  </tr>
                  <tr>
                    <td className="veri-swatch" data-q="partial" aria-hidden="true" />
                    <th scope="row">Partial</th>
                    <td className="veri-yes">✓</td>
                    <td className="veri-q">?</td>
                    <td className="veri-q">?</td>
                  </tr>
                  <tr>
                    <td className="veri-swatch" data-q="no" aria-hidden="true" />
                    <th scope="row">None</th>
                    <td className="veri-q">?</td>
                    <td className="veri-q">?</td>
                    <td className="veri-q">?</td>
                  </tr>
                </tbody>
              </table>
              <p>
                A <em>partial</em> promise names a measurable quantity but leaves the threshold or the deadline missing or vague. Even a <em>full</em> promise may be debatable.
              </p>
            </section>

            <section className="colophon-box">
              <p>Sources currently in use:</p>
              <ul>
                <li>Nomination acceptance speech from <em>The American Presidency Project</em></li>
                <li>Inaugural address from <em>The American Presidency Project</em></li>
                <li>Final general-election debate from <em>The American Presidency Project</em></li>
              </ul>
              <p>All sources are treated identically.</p>
            </section>
          </div>
        </footer>
      </main>
    </div>
  );
}
