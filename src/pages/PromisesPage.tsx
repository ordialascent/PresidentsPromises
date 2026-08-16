import { useMemo, useState } from 'react';
import { PromisesChart } from '../promises/PromisesChart.js';
import { TopicDonut } from '../promises/TopicDonut.js';
import {
  QUALITIES,
  QUALITY_META,
  filterByTiers,
  filterByTopics,
  topicCounts,
  topicCountsIn,
  type Quality,
} from '../promises/model.js';
import { CORPUS_TERMS } from '../content/promises.generated.js';

/**
 * Every topic in the corpus, ordered once by its unfiltered size. The legend is
 * drawn from this fixed list so that hiding a tier only ever changes the numbers
 * on the chips — it never removes one or re-sorts the rows, which would shove
 * the whole page around under the reader's cursor.
 */
const TOPIC_ORDER = topicCounts(CORPUS_TERMS).map((t) => t.theme);

/**
 * Front page: every nomination-acceptance promise since 2000, one stacked bar
 * per president, split by how measurable each promise is. The point is not a
 * scorecard — it is how much of what candidates promise can even be checked.
 *
 * Both filters — topic and tier — live here because they cross-filter: each
 * view counts what the *other* filter leaves, so the donut re-proportions when
 * a tier is hidden and the legend re-counts when a topic is picked. Neither
 * filter narrows its own counts, or a click would erase the way back.
 */
export function PromisesPage() {
  // Topics are multi-select and additive: an empty selection means every topic,
  // so un-picking the last one is the way back to the whole corpus.
  const [selectedTopics, setSelectedTopics] = useState<ReadonlySet<string>>(() => new Set());
  const [activeTiers, setActiveTiers] = useState<ReadonlySet<Quality>>(() => new Set(QUALITIES));

  // Topics as counted over the shown tiers only: deselect "partial" and "none"
  // and the donut is the topic mix of the full promises alone. Topics with
  // nothing left stay in the list at zero — greyed out, not gone.
  const topics = useMemo(
    () => topicCountsIn(filterByTiers(CORPUS_TERMS, activeTiers), TOPIC_ORDER),
    [activeTiers],
  );
  const topicTotal = useMemo(() => topics.reduce((n, t) => n + t.count, 0), [topics]);

  // The bars get the topic filter; the chart applies the tier filter itself, so
  // its legend can still count (and re-show) a tier it is currently hiding.
  const terms = useMemo(() => filterByTopics(CORPUS_TERMS, selectedTopics), [selectedTopics]);

  const toggleTopic = (theme: string) => {
    const next = new Set(selectedTopics);
    if (next.has(theme)) next.delete(theme);
    else next.add(theme);
    setSelectedTopics(next);
  };

  const toggleTier = (q: Quality) => {
    const next = new Set(activeTiers);
    if (next.has(q)) next.delete(q);
    else next.add(q);
    // never leave the chart empty — clicking the last active tier shows all again
    const shown = next.size ? next : new Set(QUALITIES);
    setActiveTiers(shown);
    // topics with nothing left in the shown tiers drop out of the selection —
    // their chip stays put, just greyed and unpickable — and if that empties the
    // selection, the bars widen back to every topic on their own
    const surviving = new Set(topicCounts(filterByTiers(CORPUS_TERMS, shown)).map((t) => t.theme));
    const kept = new Set([...selectedTopics].filter((t) => surviving.has(t)));
    if (kept.size !== selectedTopics.size) setSelectedTopics(kept);
  };

  // Which tiers the topic counts are drawn from, when it isn't all of them.
  const scope =
    activeTiers.size === QUALITIES.length
      ? null
      : QUALITIES.filter((q) => activeTiers.has(q))
          .map((q) => QUALITY_META[q].label.toLowerCase())
          .join(' + ');

  return (
    <div className="page">
      <header className="masthead">
        <h1>The Promises Presidents Make</h1>
        <p className="subtitle">
          A collection of promises from comparable and authoritative sources, starting in 2000, categorized by verifiability.
        </p>
      </header>

      <main>
        <section className="board">
          <TopicDonut
            topics={topics}
            total={topicTotal}
            scope={scope}
            selected={selectedTopics}
            onToggle={toggleTopic}
          />

          <hr className="board-rule" />

          <div className="board-promises">
            <span className="board-label">Promises</span>
            <PromisesChart
              terms={terms}
              activeTiers={activeTiers}
              onToggleTier={toggleTier}
            />
          </div>
        </section>

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
              <p>Even a <em>full</em> promise may be debatable.</p>
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
