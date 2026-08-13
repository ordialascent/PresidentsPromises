import { describe, it, expect } from 'vitest';
import {
  CORPUS_TERMS,
  CORPUS_PROMISE_COUNT,
  CORPUS_OCCURRENCE_COUNT,
} from '../src/content/promises.generated.js';
import { QUALITIES, deltaBetween, share, summarize, topicCounts } from '../src/promises/model.js';

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

  it('the corpus-wide tier split matches the current extraction (15 / 132 / 37)', () => {
    // Snapshot anchor — update when the corpus grows. Acceptance + inaugural +
    // the Bush (2000, 2004) and Obama (2008, 2012) final debates.
    const c = { full: 0, partial: 0, no: 0 };
    for (const s of summaries) for (const q of QUALITIES) c[q] += s.counts[q];
    expect(c).toEqual({ full: 15, partial: 132, no: 37 });
    expect(c.full + c.partial + c.no).toBe(184);
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

  it('filtering terms to one topic keeps only that topic and preserves tiers', () => {
    const filtered = CORPUS_TERMS.map((t) => ({
      ...t,
      promises: t.promises.filter((p) => p.theme === 'taxes'),
    }));
    const s = summarize(filtered);
    const total = s.reduce((n, x) => n + x.total, 0);
    expect(total).toBe(topicCounts(CORPUS_TERMS).find((t) => t.theme === 'taxes')!.count);
    for (const term of filtered) for (const p of term.promises) expect(p.theme).toBe('taxes');
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
});
