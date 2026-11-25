import { useEffect, useMemo, useState } from 'react';
import { PromiseFunnel, type Scale } from '../promises/PromiseFunnel.js';
import { BoardSettings } from '../promises/BoardSettings.js';
import { BoardLegend } from '../promises/BoardLegend.js';
import { TrendGraph } from '../promises/TrendGraph.js';
import { PromiseList } from '../promises/PromiseList.js';
import { FilterBar, type FacetControl } from '../promises/FilterBar.js';
import { searchPromises } from '../promises/search.js';
import {
  CHECKS,
  CHECK_META,
  FACETS,
  KIND_META,
  NO_FILTERS,
  VERDICT_META,
  VERDICT_STATUSES,
  facetCounts,
  facetValue,
  filterRows,
  flattenPromises,
  isFiltered,
  scopeFromParam,
  scopeToParam,
  termsOfKind,
  topicCounts,
  checkOf,
  type Check,
  type Facet,
  type Filters,
  type Kind,
} from '../promises/model.js';
import {
  CORPUS_TERMS,
} from '../content/promises.generated.js';

/** Election year of the oldest term in the corpus (terms are oldest first). */
const FIRST_ELECTION = CORPUS_TERMS[0].from - 1;
const KIND_HINT: Record<Kind, string> = {
  promise:
    'Firm commitments ("we will", "I\u2019m going to"). Only promises can be kept or broken, and only verifiable ones get a verdict.',
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

/** The term scope as it stands in the address bar (`?terms=`). */
const scopeFromUrl = () =>
  scopeFromParam(new URLSearchParams(window.location.search).get('terms'), CORPUS_TERMS);

/** Each facet's options, in a fixed order, so the menus never reshuffle. */
function optionsFor(kind: Kind, facet: Facet, scope: ReadonlySet<string>): { value: string; label: string }[] {
  const inScope = CORPUS_TERMS.filter((t) => scope.has(t.key));
  switch (facet) {
    case 'topic':
      return topicCounts(BY_KIND[kind]).map((t) => ({ value: t.theme, label: t.theme }));
    case 'president':
      return [...new Set(inScope.map((t) => t.surname))].map((p) => ({ value: p, label: p }));
    case 'term':
      return inScope.map((t) => ({ value: t.key, label: `${t.label} (${t.termLabel})` }));
    case 'tier':
      return CHECKS.map((c) => ({ value: c, label: CHECK_META[c].label }));
    case 'verdict': {
      // every verdict status, then "no verdict" for low promises, if any exist
      const present = new Set(ROWS[kind].map((r) => facetValue(r, 'verdict')));
      const out: { value: string; label: string }[] = VERDICT_STATUSES.map((v) => ({
        value: v,
        label: VERDICT_META[v].label,
      }));
      if (present.has('unjudged')) out.push({ value: 'unjudged', label: 'Not judged yet' });
      if (present.has('infeasible')) out.push({ value: 'infeasible', label: 'No verdict (unverifiable)' });
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
 * Front page: the promises of every president in the corpus, as one overview
 * chart (promises and their track record, per term) and the searchable list
 * beneath it.
 *
 * Under the settings, a graph gives the board at a glance (verifiable
 * promises per term as an area, kept, broken and other as lines), then one
 * legend serves both it and the bars below.
 *
 * Above everything sit two choices that set the whole board's subject. The
 * kind: promises (firm language) or ambitions (wishes and obligations), never
 * mixed, because only promises can ever be kept or broken. And the term scope:
 * the latest few terms by default, or all, or a hand-picked set (kept in the
 * URL as `?terms=`). The chart, the counts and the list all cover the scope,
 * so the board stays short however many terms the corpus holds.
 *
 * Every other filter belongs to the list and sits in one place: the filter bar
 * under the search box (topic, president, verifiability, verdict; each a
 * multi-select). The chart acts as a shortcut into that bar: a top block sets
 * one term and verifiability (verifiable or not), a verdict block one term and verdict
 * (the bar then shows a Term pick to clear). Clicking the same cell again
 * clears it. Blocks the filters leave out are dimmed, so the chart shows what
 * the list is showing.
 */
export function PromisesPage() {
  const [kind, setKind] = useState<Kind>('promise');
  const [scope, setScope] = useState<ReadonlySet<string>>(scopeFromUrl);
  const [scale, setScale] = useState<Scale>('count');
  const corpus = useMemo(() => BY_KIND[kind].filter((t) => scope.has(t.key)), [kind, scope]);
  const rows = useMemo(() => ROWS[kind].filter((r) => scope.has(r.termKey)), [kind, scope]);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [query, setQuery] = useState('');

  // Keep the scope in the address bar, so a link opens the same view.
  useEffect(() => {
    const url = new URL(window.location.href);
    const param = scopeToParam(scope, CORPUS_TERMS);
    if (param === null) url.searchParams.delete('terms');
    else url.searchParams.set('terms', param);
    url.search = url.searchParams.toString().replace(/%2C/g, ','); // keep "2001,2017" readable
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
  }, [scope]);

  // Picks for terms or presidents outside the new scope would hide every row.
  const changeScope = (next: Set<string>) => {
    setScope(next);
    const presidents = new Set(CORPUS_TERMS.filter((t) => next.has(t.key)).map((t) => t.surname));
    setFilters((f) => ({
      ...f,
      term: new Set([...f.term].filter((k) => next.has(k))),
      president: new Set([...f.president].filter((p) => presidents.has(p))),
    }));
  };

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

  // Terms are chosen by the scope above; the bar shows a Term pick only when a
  // chart click has narrowed the list to one term, so it can be cleared there.
  const facets: Facet[] = FACETS.filter(
    (f) => (f !== 'verdict' || kind === 'promise') && (f !== 'term' || filters.term.size > 0),
  );
  const controls: FacetControl[] = facets.map((facet) => {
    const counts = facetCounts(rows, filters, facet);
    return {
      key: facet,
      label: FACET_LABEL[facet],
      options: optionsFor(kind, facet, scope).map((o) => ({ ...o, count: counts.get(o.value) ?? 0 })),
      picked: filters[facet],
      onToggle: (v) => toggle(facet, v),
      onClear: () => setFacet(facet, new Set()),
    };
  });

  // A bar block: one term crossed with one tier.
  const blockPicked = (termKey: string, q: Check) =>
    only(filters.term, termKey) &&
    only(filters.tier, q) &&
    filters.president.size === 0 &&
    filters.verdict.size === 0;
  const blockLit =
    filters.term.size || filters.president.size || filters.tier.size
      ? (termKey: string, q: Check) =>
          (filters.term.size === 0 || filters.term.has(termKey)) &&
          (filters.president.size === 0 || filters.president.has(SURNAME_OF.get(termKey)!)) &&
          (filters.tier.size === 0 || filters.tier.has(q))
      : null;
  const selectBlock = (termKey: string, q: Check) =>
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

  // The legend's numbers: the whole scope, whatever the list's filters.
  const checkCounts = useMemo(() => {
    const c: Record<Check, number> = { verifiable: 0, unverifiable: 0 };
    for (const r of rows) c[checkOf(r.promise.quality)] += 1;
    return c;
  }, [rows]);
  const verdictCounts = useMemo(() => {
    const c = Object.fromEntries(VERDICT_STATUSES.map((v) => [v, 0])) as Record<(typeof VERDICT_STATUSES)[number], number>;
    for (const r of rows) {
      const v = r.promise.verdict;
      if (r.promise.quality === 'low' || !v) continue;
      c[v.review ? 'review' : v.verdict] += 1;
    }
    return c;
  }, [rows]);

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
          A collection of promises from comparable and authoritative sources, starting in {FIRST_ELECTION},
          categorized by verifiability. <a href="#method">How promises are chosen, rated and judged</a>
        </p>
      </header>

      <main>
        <section className="board">
          <BoardSettings
            terms={CORPUS_TERMS}
            scope={scope}
            onScope={changeScope}
            kind={kind}
            kindLabel={(k) => KIND_META[k].plural}
            kindHint={(k) => KIND_HINT[k]}
            onKind={switchKind}
            scale={scale}
            onScale={setScale}
          />
          <div className="board-promises">
            <TrendGraph terms={corpus} kind={kind} />
            <BoardLegend
              withVerdicts={kind === 'promise'}
              checkCounts={checkCounts}
              verdictCounts={verdictCounts}
              pickedChecks={filters.tier}
              onToggleCheck={(c) => toggle('tier', c)}
              pickedVerdicts={filters.verdict}
              onToggleVerdict={(v) => toggle('verdict', v)}
              onSetVerdicts={(next) => setFacet('verdict', next)}
            />
            <PromiseFunnel
              terms={corpus}
              kind={kind}
              scale={scale}
              tierLit={blockLit}
              tierPicked={blockPicked}
              onSelectTier={selectBlock}
              verdictLit={cellLit}
              verdictPicked={cellPicked}
              onSelectVerdict={selectCell}
            />
          </div>

          <hr className="board-rule" />

          <PromiseList
            hits={hits}
            total={rows.length}
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
