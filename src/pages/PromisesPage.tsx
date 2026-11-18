import { useMemo, useState } from 'react';
import { PromisesChart } from '../promises/PromisesChart.js';
import { PromiseList } from '../promises/PromiseList.js';
import { TrackRecord } from '../promises/TrackRecord.js';
import { FilterBar, type FacetControl } from '../promises/FilterBar.js';
import { searchPromises } from '../promises/search.js';
import {
  FACETS,
  KIND_META,
  NO_FILTERS,
  QUALITIES,
  QUALITY_META,
  VERDICT_META,
  VERDICT_STATUSES,
  facetCounts,
  facetValue,
  filterRows,
  flattenPromises,
  isFiltered,
  termsOfKind,
  topicCounts,
  type Facet,
  type Filters,
  type Kind,
  type Quality,
} from '../promises/model.js';
import {
  CORPUS_AMBITION_COUNT,
  CORPUS_PROMISE_COUNT,
  CORPUS_TERMS,
} from '../content/promises.generated.js';

const KINDS: Kind[] = ['promise', 'ambition'];
const KIND_TOTAL: Record<Kind, number> = {
  promise: CORPUS_PROMISE_COUNT,
  ambition: CORPUS_AMBITION_COUNT,
};
const KIND_HINT: Record<Kind, string> = {
  promise:
    'Firm commitments ("we will", "I\u2019m going to"). Only promises can be kept or broken, and only high and medium ones get a verdict.',
  ambition:
    'Wishes and obligations ("we must", "I want"). A direction, not a commitment, so never given a verdict.',
};
const BY_KIND: Record<Kind, typeof CORPUS_TERMS> = {
  promise: CORPUS_TERMS,
  ambition: termsOfKind(CORPUS_TERMS, 'ambition'),
};
const ROWS: Record<Kind, ReturnType<typeof flattenPromises>> = {
  promise: flattenPromises(BY_KIND.promise),
  ambition: flattenPromises(BY_KIND.ambition),
};

const SURNAME_OF = new Map(CORPUS_TERMS.map((t) => [t.key, t.surname]));
const PRESIDENTS = [...new Set(CORPUS_TERMS.map((t) => t.surname))];

/** Each facet's options, in a fixed order, so the menus never reshuffle. */
function optionsFor(kind: Kind, facet: Facet): { value: string; label: string }[] {
  switch (facet) {
    case 'topic':
      return topicCounts(BY_KIND[kind]).map((t) => ({ value: t.theme, label: t.theme }));
    case 'president':
      return PRESIDENTS.map((p) => ({ value: p, label: p }));
    case 'term':
      return CORPUS_TERMS.map((t) => ({ value: t.key, label: `${t.label} (${t.termLabel})` }));
    case 'tier':
      return QUALITIES.map((q) => ({ value: q, label: QUALITY_META[q].label }));
    case 'verdict': {
      // every verdict status, then "no verdict" for low promises, if any exist
      const present = new Set(ROWS[kind].map((r) => facetValue(r, 'verdict')));
      const out: { value: string; label: string }[] = VERDICT_STATUSES.map((v) => ({
        value: v,
        label: VERDICT_META[v].label,
      }));
      if (present.has('unjudged')) out.push({ value: 'unjudged', label: 'Not judged yet' });
      if (present.has('infeasible')) out.push({ value: 'infeasible', label: 'No verdict (low)' });
      return out;
    }
  }
}

const FACET_LABEL: Record<Facet, string> = {
  topic: 'Topic',
  president: 'President',
  term: 'Term',
  tier: 'Verifiability',
  verdict: 'Verdict',
};

const only = (set: ReadonlySet<string>, v: string) => set.size === 1 && set.has(v);

/**
 * Front page: the promises of every president since 2000, as two overview
 * charts and the searchable list beneath them.
 *
 * Every filter belongs to the list and sits in one place: the filter bar under
 * the search box (topic, president, term, verifiability, verdict; each a
 * multi-select). The charts above always draw the whole corpus and act as
 * shortcuts into that bar: a bar block sets term and verifiability to that one
 * cell, a track-record section sets term and verdict. Clicking the same cell
 * again clears it. Cells the filters leave out are dimmed, so the charts show
 * what the list is showing.
 *
 * Above everything sits the kind: promises (firm language) or ambitions (wishes
 * and obligations). It swaps the whole board's subject rather than mixing the
 * two, because only promises can ever be kept or broken.
 */
export function PromisesPage() {
  const [kind, setKind] = useState<Kind>('promise');
  const corpus = BY_KIND[kind];
  const rows = ROWS[kind];
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => filterRows(rows, filters), [rows, filters]);
  const hits = useMemo(() => searchPromises(filtered, query), [filtered, query]);

  const setFacet = (facet: Facet, next: ReadonlySet<string>) =>
    setFilters((f) => ({ ...f, [facet]: next }));
  const toggle = (facet: Facet, value: string) => {
    const next = new Set(filters[facet]);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setFacet(facet, next);
  };

  const facets: Facet[] = kind === 'promise' ? FACETS : FACETS.filter((f) => f !== 'verdict');
  const controls: FacetControl[] = facets.map((facet) => {
    const counts = facetCounts(rows, filters, facet);
    return {
      key: facet,
      label: FACET_LABEL[facet],
      options: optionsFor(kind, facet).map((o) => ({ ...o, count: counts.get(o.value) ?? 0 })),
      picked: filters[facet],
      onToggle: (v) => toggle(facet, v),
      onClear: () => setFacet(facet, new Set()),
    };
  });

  // A bar block: one term crossed with one tier.
  const blockPicked = (termKey: string, q: Quality) =>
    only(filters.term, termKey) &&
    only(filters.tier, q) &&
    filters.president.size === 0 &&
    filters.verdict.size === 0;
  const blockLit =
    filters.term.size || filters.president.size || filters.tier.size
      ? (termKey: string, q: Quality) =>
          (filters.term.size === 0 || filters.term.has(termKey)) &&
          (filters.president.size === 0 || filters.president.has(SURNAME_OF.get(termKey)!)) &&
          (filters.tier.size === 0 || filters.tier.has(q))
      : null;
  const selectBlock = (termKey: string, q: Quality) =>
    setFilters((f) =>
      blockPicked(termKey, q)
        ? { ...f, term: new Set(), tier: new Set() }
        : { ...f, term: new Set([termKey]), tier: new Set([q]), president: new Set(), verdict: new Set() },
    );

  // A track-record cell: one term crossed with one verdict.
  const cellPicked = (termKey: string, v: string) =>
    only(filters.term, termKey) &&
    only(filters.verdict, v) &&
    filters.president.size === 0 &&
    filters.tier.size === 0;
  const cellLit =
    filters.term.size || filters.president.size || filters.verdict.size
      ? (termKey: string, v: string) =>
          (filters.term.size === 0 || filters.term.has(termKey)) &&
          (filters.president.size === 0 || filters.president.has(SURNAME_OF.get(termKey)!)) &&
          (filters.verdict.size === 0 || filters.verdict.has(v))
      : null;
  const selectCell = (termKey: string, v: string) =>
    setFilters((f) =>
      cellPicked(termKey, v)
        ? { ...f, term: new Set(), verdict: new Set() }
        : { ...f, term: new Set([termKey]), verdict: new Set([v]), president: new Set(), tier: new Set() },
    );

  // The other kind is a different corpus: its topics don't carry over.
  const switchKind = (k: Kind) => {
    if (k === kind) return;
    setKind(k);
    setFilters(NO_FILTERS);
  };

  const clearAll = () => {
    setFilters(NO_FILTERS);
    setQuery('');
  };

  return (
    <div className="page">
      <header className="masthead">
        <h1>The Promises Presidents Make</h1>
        <p className="subtitle">
          A collection of promises from comparable and authoritative sources, starting in 2000,
          categorized by verifiability. <a href="#method">How promises are chosen, rated and judged</a>
        </p>
      </header>

      <main>
        <section className="board">
          <div className="kind-switch" role="group" aria-label="Promises or ambitions">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                data-on={kind === k}
                aria-pressed={kind === k}
                title={KIND_HINT[k]}
                onClick={() => switchKind(k)}
              >
                {KIND_META[k].plural}
                <span className="kind-switch-n">{KIND_TOTAL[k]}</span>
              </button>
            ))}
          </div>
          <div className="board-promises">
            <span className="board-label">{KIND_META[kind].plural}</span>
            <PromisesChart
              terms={corpus}
              pickedTiers={filters.tier}
              onToggleTier={(q) => toggle('tier', q)}
              lit={blockLit}
              picked={blockPicked}
              onSelect={selectBlock}
            />
          </div>

          {kind === 'promise' && (
            <>
              <hr className="board-rule" />
              <div className="board-promises">
                <span className="board-label">Track record</span>
                <TrackRecord
                  terms={corpus}
                  lit={cellLit}
                  picked={cellPicked}
                  onSelect={selectCell}
                />
              </div>
            </>
          )}

          <hr className="board-rule" />

          <PromiseList
            hits={hits}
            total={KIND_TOTAL[kind]}
            noun={KIND_META[kind].plural.toLowerCase()}
            query={query}
            onQuery={setQuery}
            filterBar={
              <FilterBar
                controls={controls}
                active={isFiltered(filters) || query.trim() !== ''}
                onClearAll={clearAll}
              />
            }
            onClearFilters={clearAll}
          />
        </section>
      </main>
    </div>
  );
}
