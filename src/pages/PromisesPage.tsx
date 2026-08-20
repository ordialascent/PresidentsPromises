import { useEffect, useMemo, useState } from 'react';
import { PromisesChart, type Segment } from '../promises/PromisesChart.js';
import { TopicDonut } from '../promises/TopicDonut.js';
import { PromiseList, type FilterChip } from '../promises/PromiseList.js';
import { searchPromises } from '../promises/search.js';
import {
  QUALITIES,
  QUALITY_META,
  filterBySegment,
  filterByTiers,
  filterByTopics,
  flattenPromises,
  topicCounts,
  type Quality,
} from '../promises/model.js';
import { CORPUS_PROMISE_COUNT, CORPUS_TERMS } from '../content/promises.generated.js';

/**
 * Every topic in the corpus, counted and ordered once. Topics sit at the top of
 * the filter hierarchy, so nothing below them may re-count or re-order this
 * list: the donut and its legend are the same shape on every render, and a chip
 * never moves out from under the reader's cursor.
 */
const CORPUS_TOPICS = topicCounts(CORPUS_TERMS);
const TOPIC_ORDER = CORPUS_TOPICS.map((t) => t.theme);

/**
 * Digits to pad every chip's count to, fixed by the largest count in the corpus.
 * Without it a count falling from 25 to 1 narrows its chip by a character, the
 * row fits one more, and the legend repacks — the same jump the fixed list was
 * meant to remove, arriving one layer down.
 */
const COUNT_WIDTH = String(Math.max(...CORPUS_TOPICS.map((t) => t.count))).length;

/**
 * Front page: every nomination-acceptance promise since 2000, one stacked bar
 * per president, split by how measurable each promise is. The point is not a
 * scorecard — it is how much of what candidates promise can even be checked.
 *
 * Every filter lives here, because all four views read the same promises, and
 * they form a hierarchy — **topics, then categories (tiers), then bar blocks,
 * then search**. Each level counts what the levels *above* it leave, and never
 * what the levels below it do:
 *
 * - the donut always shows the whole corpus by topic;
 * - the category legend counts the promises on the selected topics;
 * - the bars draw those promises in the picked categories, and a block picks
 *   one president's share of them;
 * - the search box narrows the list alone, and nothing else.
 *
 * So a click only ever moves the levels underneath it. That is what makes the
 * way back obvious: no filter can quietly change the numbers you chose it by,
 * and the promises are no longer hidden inside a bar block waiting for a click
 * — they are the standing view, and every level above is a way to narrow it.
 */
export function PromisesPage() {
  // Topics are multi-select and additive: an empty selection means every topic,
  // so un-picking the last one is the way back to the whole corpus.
  const [selectedTopics, setSelectedTopics] = useState<ReadonlySet<string>>(() => new Set());
  // Tiers work exactly like topics — a click picks that category, and an empty
  // selection means all of them. `activeTiers` is what the chart draws, so the
  // legend still lights all three at rest.
  const [selectedTiers, setSelectedTiers] = useState<ReadonlySet<Quality>>(() => new Set());
  const activeTiers = useMemo<ReadonlySet<Quality>>(
    () => (selectedTiers.size ? selectedTiers : new Set(QUALITIES)),
    [selectedTiers],
  );
  // One bar block — a president crossed with a tier. Single-select: it is a
  // pointer at one cell of the chart, so a second click elsewhere moves it.
  const [segment, setSegment] = useState<Segment | null>(null);
  const [query, setQuery] = useState('');

  // Level 2 — the promises on the selected topics. The chart takes these and
  // applies the category filter itself, so its legend still counts what picking
  // a category *would* get you, even one currently left out: a level narrows
  // what is below it, never the switch that got you there.
  const terms = useMemo(() => filterByTopics(CORPUS_TERMS, selectedTopics), [selectedTopics]);

  // Levels 3 and 4 — the shown tiers, then the picked block, then ranked against
  // the search box. Search sits at the bottom on purpose: it is the reader's own
  // question, not a claim about the corpus, so it narrows the list and nothing
  // else — it must not re-proportion the donut or re-scale the bars above it.
  const shownTerms = useMemo(() => filterByTiers(terms, activeTiers), [terms, activeTiers]);
  const rows = useMemo(
    () => filterBySegment(flattenPromises(shownTerms), segment),
    [shownTerms, segment],
  );
  const hits = useMemo(() => searchPromises(rows, query), [rows, query]);

  // A block the other filters have emptied can't be un-clicked in the chart —
  // it isn't drawn any more — so drop the selection rather than strand it.
  useEffect(() => {
    if (!segment) return;
    const term = shownTerms.find((t) => t.key === segment.termKey);
    const left = term ? term.promises.filter((p) => p.quality === segment.quality).length : 0;
    if (left === 0) setSegment(null);
  }, [shownTerms, segment]);

  const toggleTopic = (theme: string) => {
    const next = new Set(selectedTopics);
    if (next.has(theme)) next.delete(theme);
    else next.add(theme);
    setSelectedTopics(next);
  };

  const toggleTier = (q: Quality) => {
    const next = new Set(selectedTiers);
    if (next.has(q)) next.delete(q);
    else next.add(q);
    // picking every category is the same as picking none: both mean all of
    // them, so the chart is never left empty and there is always a way back
    setSelectedTiers(next.size === QUALITIES.length ? new Set() : next);
    // the topic selection is a level above, and is left exactly as it was
  };

  // Every narrowing currently in force, said in words above the list. The chart
  // and the donut already show their own state, but a filter set three views ago
  // is easy to lose track of — and a bar block scrolled out of sight has no
  // visible "off" switch at all. Each chip is that switch.
  const filters = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    for (const theme of TOPIC_ORDER) {
      if (!selectedTopics.has(theme)) continue;
      chips.push({
        key: `topic:${theme}`,
        label: `topic: ${theme}`,
        onClear: () => toggleTopic(theme),
      });
    }
    if (selectedTiers.size > 0) {
      chips.push({
        key: 'tiers',
        label: `${QUALITIES.filter((q) => selectedTiers.has(q))
          .map((q) => QUALITY_META[q].label.toLowerCase())
          .join(' + ')} only`,
        onClear: () => setSelectedTiers(new Set()),
      });
    }
    if (segment) {
      const term = CORPUS_TERMS.find((t) => t.key === segment.termKey);
      chips.push({
        key: 'segment',
        label: `${term?.label ?? segment.termKey} · ${QUALITY_META[segment.quality].label}`,
        onClear: () => setSegment(null),
      });
    }
    return chips;
  }, [selectedTopics, selectedTiers, segment]);

  const clearAll = () => {
    setSelectedTopics(new Set());
    setSelectedTiers(new Set());
    setSegment(null);
    setQuery('');
  };

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
            topics={CORPUS_TOPICS}
            total={CORPUS_PROMISE_COUNT}
            countWidth={COUNT_WIDTH}
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
              selected={segment}
              onSelect={setSegment}
            />
          </div>

          <hr className="board-rule" />

          <PromiseList
            hits={hits}
            total={CORPUS_PROMISE_COUNT}
            query={query}
            onQuery={setQuery}
            filters={filters}
            onClearFilters={clearAll}
          />
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
