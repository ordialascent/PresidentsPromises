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
  topicCountsIn,
  type Quality,
} from '../promises/model.js';
import { CORPUS_PROMISE_COUNT, CORPUS_TERMS } from '../content/promises.generated.js';

/**
 * Every topic in the corpus, ordered once by its unfiltered size. The legend is
 * drawn from this fixed list, so picking a category only ever changes the
 * numbers on the chips — it never removes one or re-sorts the rows, which would
 * shove the whole page around under the reader's cursor.
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
 * they narrow in this order — **topics, then categories (tiers), then bar
 * blocks, then search**:
 *
 * - the donut counts the promises in the shown categories, by topic;
 * - the category legend counts the promises on the selected topics;
 * - the bars draw what both leave, and a block picks one president's share;
 * - the search box narrows the list alone, and nothing else.
 *
 * The first two count each other on purpose: a category with no promises on a
 * topic should not offer that topic, and a topic with none in a category should
 * not offer that category. Each view therefore counts what the *other* filter
 * leaves and never what its own does, or picking a chip would erase the way
 * back. The legend's shape is fixed against that movement — same chips, same
 * order, only the numbers change — so nothing reflows mid-click.
 *
 * Both are *picked*, and identically: nothing picked means all of them, a click
 * picks one, clicking it again releases it, and picking every one is the same
 * as picking none. So no click is a dead end in either control, and neither
 * needs a rule the other doesn't have.
 *
 * Search stays out of it entirely. It is the reader's own question, not a claim
 * about the corpus, so it must not re-proportion the donut or re-scale the bars
 * behind it. And the promises are no longer hidden inside a bar block waiting
 * for a click — they are the standing view, and everything above narrows it.
 */
export function PromisesPage() {
  // Topics are multi-select and additive: an empty selection means every topic,
  // so un-picking the last one is the way back to the whole corpus.
  const [selectedTopics, setSelectedTopics] = useState<ReadonlySet<string>>(() => new Set());
  // Categories are picked exactly like topics: nothing picked means all of
  // them, a click picks one, and clicking it again releases it. `activeTiers` is
  // what the chart and the list are narrowed to; `pickedTiers` is what the
  // reader actually clicked, which is what the legend lights.
  const [pickedTiers, setPickedTiers] = useState<ReadonlySet<Quality>>(() => new Set());
  const activeTiers = useMemo<ReadonlySet<Quality>>(
    () => (pickedTiers.size ? pickedTiers : new Set(QUALITIES)),
    [pickedTiers],
  );
  // Picking every category is no narrowing at all — same promises as picking
  // none — so it names no filter and draws no chip.
  const tierFilterOn = pickedTiers.size > 0 && pickedTiers.size < QUALITIES.length;

  // Topics as counted inside the picked categories: pick "full" and the donut is
  // the topic mix of the fully measurable promises alone. Topics with nothing
  // left stay in the list at zero — greyed out and unpickable, not gone.
  const topics = useMemo(
    () => topicCountsIn(filterByTiers(CORPUS_TERMS, activeTiers), TOPIC_ORDER),
    [activeTiers],
  );
  const topicTotal = useMemo(() => topics.reduce((n, t) => n + t.count, 0), [topics]);
  // One bar block — a president crossed with a tier. Single-select: it is a
  // pointer at one cell of the chart, so a second click elsewhere moves it.
  const [segment, setSegment] = useState<Segment | null>(null);
  const [query, setQuery] = useState('');

  // The bars get the topic filter; the chart applies the category filter itself,
  // so its legend still counts what picking a category *would* get you, even one
  // currently left out. Neither view narrows its own counts — only the other's.
  const terms = useMemo(() => filterByTopics(CORPUS_TERMS, selectedTopics), [selectedTopics]);

  // What the list draws from: both filters, then the picked block, then ranked
  // against the search box.
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
    const next = new Set(pickedTiers);
    if (next.has(q)) next.delete(q);
    else next.add(q);
    setPickedTiers(next);
    // un-picking the last one is the way back to all of them, so the chart is
    // never left empty and no click is a dead end
    const shown = next.size ? next : new Set(QUALITIES);
    // topics with nothing left in the shown categories drop out of the
    // selection — their chip stays put, just greyed and unpickable — and if that
    // empties the selection, the bars widen back to every topic on their own.
    // Without this a greyed chip could still be filtering, with no way to click
    // it off.
    const surviving = new Set(topicCounts(filterByTiers(CORPUS_TERMS, shown)).map((t) => t.theme));
    const kept = new Set([...selectedTopics].filter((t) => surviving.has(t)));
    if (kept.size !== selectedTopics.size) setSelectedTopics(kept);
  };

  // Which categories the topic counts are drawn from, when it isn't all of them.
  const scope = tierFilterOn
    ? QUALITIES.filter((q) => pickedTiers.has(q))
        .map((q) => QUALITY_META[q].label.toLowerCase())
        .join(' + ')
    : null;

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
    if (tierFilterOn) {
      chips.push({
        key: 'tiers',
        label: `${QUALITIES.filter((q) => pickedTiers.has(q))
          .map((q) => QUALITY_META[q].label.toLowerCase())
          .join(' + ')} only`,
        onClear: () => setPickedTiers(new Set()),
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
  }, [selectedTopics, pickedTiers, tierFilterOn, segment]);

  const clearAll = () => {
    setSelectedTopics(new Set());
    setPickedTiers(new Set());
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
            topics={topics}
            total={topicTotal}
            countWidth={COUNT_WIDTH}
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
              pickedTiers={pickedTiers}
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
