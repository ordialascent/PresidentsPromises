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
        <div className="eyebrow">Presidents' Promises · What can be measured and what was achieved? · MVP</div>
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
          <p>
            Verifiability is a property of the sentence, not of the president. A promise is <em>full</em> when it names a metric, a threshold, and a deadline; <em>partial</em> when one of those is missing or vague; <em>none</em> when it names no measurable quantity. Even a <em>full</em> promise can still be disputed on baseline or endpoint.
          </p>
          <p>
            The colors are taken from the US flag and do not represent the parties. Nowhere does this site make a causal claim or compare parties.
          </p>
          <div>
            Sources currently in use:
            <ul>
              <li>Nomination acceptance speech from <em>The American Presidency Project</em></li>
            </ul>
          </div>
        </footer>
      </main>
    </div>
  );
}
