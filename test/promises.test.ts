import { describe, it, expect } from 'vitest';
import {
  CORPUS_TERMS,
  CORPUS_PROMISE_COUNT,
  CORPUS_OCCURRENCE_COUNT,
} from '../src/content/promises.generated.js';
import {
  CHECKS,
  QUALITIES,
  VERDICT_PLACEHOLDER,
  checkOf,
  countAxis,
  trendPoints,
  deltaBetween,
  FACETS,
  NO_FILTERS,
  facetCounts,
  filterRows,
  share,
  summarize,
  topicCounts,
  trackRecords,
  flattenPromises,
  verdictFor,
  VERDICT_STATUSES,
  type Filters,
} from '../src/promises/model.js';

/**
 * The overview aggregation, pinned against the generated corpus. Totals are the
 * sanity anchor; per-term rollups and deltas are what the stacked chart draws.
 */
describe('promises overview aggregation', () => {
  const summaries = summarize(CORPUS_TERMS);

  it('terms are chronological and every promise is one of the three tiers', () => {
    const froms = CORPUS_TERMS.map((t) => t.from);
    expect(froms).toEqual([...froms].sort((a, b) => a - b));
    for (const t of CORPUS_TERMS) {
      for (const p of t.promises) expect(QUALITIES).toContain(p.quality);
    }
  });

  it('every promise has at least one occurrence, summing to the occurrence count', () => {
    let occ = 0;
    for (const t of CORPUS_TERMS) {
      for (const p of t.promises) {
        expect(p.occurrences.length).toBeGreaterThanOrEqual(1);
        for (const o of p.occurrences) {
          expect(o.source.kind).toBeTruthy();
          expect(o.quote).toBeTypeOf('string');
        }
        occ += p.occurrences.length;
      }
    }
    expect(occ).toBe(CORPUS_OCCURRENCE_COUNT);
    // a promise recurs across sources, so occurrences >= distinct promises
    expect(CORPUS_OCCURRENCE_COUNT).toBeGreaterThanOrEqual(CORPUS_PROMISE_COUNT);
  });

  it('per-term counts sum to the term total, and totals to the corpus count', () => {
    let grand = 0;
    for (const s of summaries) {
      const sum = QUALITIES.reduce((n, q) => n + s.counts[q], 0);
      expect(sum).toBe(s.total);
      grand += s.total;
    }
    expect(grand).toBe(CORPUS_PROMISE_COUNT);
  });

  it('the corpus-wide tier split matches the current extraction (94 / 217 / 279)', () => {
    // Snapshot anchor — update when the corpus changes. All nine terms are re-extracted
    // under protocol 1 (their promises only; levels stand in for tiers).
    const c = { high: 0, medium: 0, low: 0 };
    for (const s of summaries) for (const q of QUALITIES) c[q] += s.counts[q];
    expect(c).toEqual({ high: 94, medium: 217, low: 279 });
    expect(c.high + c.medium + c.low).toBe(590);
  });

  it('shares are a proper distribution within each term', () => {
    for (const s of summaries) {
      const totalShare = QUALITIES.reduce((n, q) => n + share(s, q), 0);
      expect(totalShare).toBeCloseTo(1, 10);
    }
  });

  it('topic counts cover every promise, are sorted, and match a spot check', () => {
    const topics = topicCounts(CORPUS_TERMS);
    // every promise lands in exactly one topic
    expect(topics.reduce((n, t) => n + t.count, 0)).toBe(CORPUS_PROMISE_COUNT);
    // sorted by count desc (ties alphabetical)
    for (let i = 1; i < topics.length; i += 1) {
      const a = topics[i - 1]!;
      const b = topics[i]!;
      expect(a.count > b.count || (a.count === b.count && a.theme < b.theme)).toBe(true);
    }
    // a manual count of one topic, straight from the corpus promises
    const health = CORPUS_TERMS.flatMap((t) => t.promises).filter((p) => p.theme === 'health').length;
    expect(topics.find((t) => t.theme === 'health')!.count).toBe(health);
  });

  it('the filter bar: picks within a facet are alternatives, facets narrow together', () => {
    const rows = flattenPromises(CORPUS_TERMS);
    const f = (patch: Partial<Filters>): Filters => ({ ...NO_FILTERS, ...patch });
    // nothing picked is no filter at all
    expect(filterRows(rows, NO_FILTERS)).toBe(rows);
    // one topic keeps exactly that topic
    const taxes = filterRows(rows, f({ topic: new Set(['taxes']) }));
    expect(taxes.length).toBe(topicCounts(CORPUS_TERMS).find((t) => t.theme === 'taxes')!.count);
    for (const r of taxes) expect(r.promise.theme).toBe('taxes');
    // two topics are the union of both
    const energy = filterRows(rows, f({ topic: new Set(['energy']) }));
    expect(filterRows(rows, f({ topic: new Set(['taxes', 'energy']) })).length).toBe(
      taxes.length + energy.length,
    );
    // topic and tier together are the intersection, in either order
    const both = filterRows(rows, f({ topic: new Set(['health']), tier: new Set(['verifiable']) }));
    expect(both.length).toBeGreaterThan(0);
    expect(both).toEqual(
      filterRows(filterRows(rows, f({ tier: new Set(['verifiable']) })), f({ topic: new Set(['health']) })),
    );
    for (const r of both) {
      expect(r.promise.theme).toBe('health');
      expect(r.promise.quality).not.toBe('low');
    }
    // verifiable is high and medium together; unverifiable is low
    const verifiable = filterRows(rows, f({ tier: new Set(['verifiable']) })).length;
    expect(verifiable).toBe(rows.filter((r) => r.promise.quality !== 'low').length);
    expect(filterRows(rows, f({ tier: new Set(['unverifiable']) })).length).toBe(rows.length - verifiable);
    // a president covers all of their terms
    const bush = filterRows(rows, f({ president: new Set(['W. Bush']) }));
    const bushTerms = CORPUS_TERMS.filter((t) => t.surname === 'W. Bush');
    expect(bushTerms.length).toBeGreaterThan(1);
    expect(bush.length).toBe(bushTerms.reduce((n, t) => n + t.promises.length, 0));
  });

  it('gives each president one name, even when two share a surname', () => {
    const byName = new Map<string, Set<string>>();
    for (const t of CORPUS_TERMS) byName.set(t.surname, (byName.get(t.surname) ?? new Set()).add(t.name));
    for (const names of byName.values()) expect(names.size).toBe(1);
    const bushes = CORPUS_TERMS.filter((t) => t.name.endsWith('Bush')).map((t) => t.surname);
    expect(new Set(bushes)).toEqual(new Set(['H. W. Bush', 'W. Bush']));
  });

  it('facet counts never count against their own facet, and add up', () => {
    const rows = flattenPromises(CORPUS_TERMS);
    const filters: Filters = { ...NO_FILTERS, tier: new Set(['verifiable']), topic: new Set(['health']) };
    // the verifiability menu, with "verifiable" picked, still says what unverifiable would add
    const tiers = facetCounts(rows, filters, 'tier');
    for (const c of CHECKS) {
      const alone = filterRows(rows, { ...filters, tier: new Set([c]) }).length;
      expect(alone).toBeGreaterThan(0);
      expect(tiers.get(c) ?? 0).toBe(alone);
    }
    // every facet's counts sum to what the other facets leave
    for (const facet of FACETS) {
      const counts = facetCounts(rows, filters, facet);
      const sum = [...counts.values()].reduce((n, c) => n + c, 0);
      expect(sum).toBe(filterRows(rows, { ...filters, [facet]: new Set() }).length);
    }
  });

  it('deltas are the difference between adjacent terms, both count and points', () => {
    for (let i = 1; i < summaries.length; i += 1) {
      const prev = summaries[i - 1]!;
      const curr = summaries[i]!;
      const d = deltaBetween(prev, curr);
      for (const q of QUALITIES) {
        expect(d[q].count).toBe(curr.counts[q] - prev.counts[q]);
        expect(d[q].points).toBeCloseTo((share(curr, q) - share(prev, q)) * 100, 9);
      }
      // count deltas across tiers sum to the change in the term total
      const totalCountDelta = QUALITIES.reduce((n, q) => n + d[q].count, 0);
      expect(totalCountDelta).toBe(curr.total - prev.total);
    }
  });

  it('every tier has verification copy, and only low is never checked', () => {
    for (const q of QUALITIES) {
      const v = VERDICT_PLACEHOLDER[q];
      expect(v.label).toBeTruthy();
      expect(v.note).toBeTruthy();
      expect(v.mark).toBeTruthy();
    }
    // high and medium get verdicts (medium after its stated judgement call);
    // low never does
    expect(VERDICT_PLACEHOLDER.high.label).toMatch(/unjudged/i);
    expect(VERDICT_PLACEHOLDER.medium.label).toMatch(/unjudged/i);
    expect(VERDICT_PLACEHOLDER.low.label).toMatch(/infeasible/i);

    // the list row shows the same status in one lower-case phrase; it must say
    // the same thing as the panel, or a promise reads one way in the list and
    // another when opened
    for (const q of QUALITIES) {
      const v = VERDICT_PLACEHOLDER[q];
      expect(v.tag).toBe(v.tag.toLowerCase());
      expect(v.label.toLowerCase()).toContain(v.tag);
    }
  });
});

describe('verdicts on the board', () => {
  const all = CORPUS_TERMS.flatMap((t) => [...t.promises, ...t.ambitions]);

  it('every high and medium promise carries a verdict; low ones and ambitions never do', () => {
    for (const p of all) {
      if (p.kind === 'promise' && p.quality !== 'low') expect(p.verdict, p.id).not.toBeNull();
      else expect(p.verdict, p.id).toBeNull();
    }
  });

  it('a verdict with an open review shows as under review, keeping the provisional reading', () => {
    const reviewed = all.find((p) => p.verdict?.review);
    expect(reviewed).toBeDefined();
    const v = verdictFor(reviewed!);
    expect(v.status).toBe('review');
    expect(v.label).toMatch(/under review/i);
    expect(v.record?.verdict).toBe(reviewed!.verdict!.verdict);

    const settled = all.find((p) => p.verdict && !p.verdict.review)!;
    expect(verdictFor(settled).status).toBe(settled.verdict!.verdict);
  });

  it('the list tag and the panel label say the same thing', () => {
    for (const p of all) {
      const v = verdictFor(p);
      expect(v.tag).toBe(v.tag.toLowerCase());
      expect(v.label.toLowerCase()).toContain(v.tag);
    }
  });

  it('track records count every verifiable promise exactly once', () => {
    const records = trackRecords(CORPUS_TERMS);
    expect(records).toHaveLength(CORPUS_TERMS.length);
    for (const r of records) {
      const sum = VERDICT_STATUSES.reduce((n, s) => n + r.counts[s], 0);
      expect(sum).toBe(r.verifiable);
      expect(r.settled).toBe(r.counts.kept + r.counts.partly + r.counts.broken);
    }
    const review = records.reduce((n, r) => n + r.counts.review, 0);
    expect(review).toBe(all.filter((p) => p.verdict?.review).length);
  });

  it('a track-record cell lists exactly the promises it counts', () => {
    const rows = flattenPromises(CORPUS_TERMS);
    for (const r of trackRecords(CORPUS_TERMS)) {
      for (const status of VERDICT_STATUSES) {
        const picked = filterRows(rows, {
          ...NO_FILTERS,
          term: new Set([r.key]),
          verdict: new Set([status]),
        });
        expect(picked).toHaveLength(r.counts[status]);
        for (const row of picked) expect(row.termKey).toBe(r.key);
      }
    }
  });
});

describe('cited sentences', () => {
  const norm = (s: string) => s.replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' ').trim();
  const occurrences = CORPUS_TERMS.flatMap((t) =>
    [...t.promises, ...t.ambitions].flatMap((p) => p.occurrences),
  );

  it('every occurrence carries its full sentence, with the quote marked inside it', () => {
    expect(occurrences.length).toBeGreaterThan(CORPUS_OCCURRENCE_COUNT);
    for (const o of occurrences) {
      const [from, to] = o.mark;
      expect(from).toBeGreaterThanOrEqual(0);
      expect(to).toBeLessThanOrEqual(o.context.length);
      expect(norm(o.context.slice(from, to))).toBe(norm(o.quote));
    }
  });

  it('shows the whole sentence when a promise is one part of it', () => {
    const o = CORPUS_TERMS.flatMap((t) => t.promises)
      .find((p) => p.id === 'bush-2004-afghan-iraq-elections')!.occurrences[0];
    expect(o.quote).toBe('move toward elections');
    expect(o.context).toMatch(/^So our mission in Afghanistan and Iraq is clear: .* as quickly as possible\.$/);
    expect(o.context.slice(...o.mark)).toBe('move toward elections');
  });
});

describe('the trend graph', () => {
  it('has one point per term, and its lines never exceed the verifiable area', () => {
    const points = trendPoints(CORPUS_TERMS);
    const records = trackRecords(CORPUS_TERMS);
    expect(points.map((p) => p.key)).toEqual(CORPUS_TERMS.map((t) => t.key));
    points.forEach((p, i) => {
      const t = CORPUS_TERMS[i];
      expect(p.verifiable).toBe(t.promises.filter((q) => checkOf(q.quality) === 'verifiable').length);
      expect(p.verifiable).toBe(records[i].verifiable);
      // every verifiable promise has a verdict, so the three lines add up to the area
      expect(p.kept + p.broken + p.other).toBe(p.verifiable);
    });
  });

  it('rounds the count axis to whole, even steps that cover the maximum', () => {
    for (const max of [0, 1, 3, 7, 18, 41, 64, 99, 250]) {
      const { top, step } = countAxis(max);
      expect(Number.isInteger(step)).toBe(true);
      expect(top).toBeGreaterThanOrEqual(max);
      expect(top % step).toBe(0);
      expect(top / step).toBeLessThanOrEqual(5);
    }
  });
});
