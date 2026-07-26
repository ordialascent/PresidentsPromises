import { describe, it, expect } from 'vitest';
import { CORPUS_TERMS, CORPUS_PROMISE_COUNT } from '../src/content/promises.generated.js';
import { QUALITIES, deltaBetween, share, summarize } from '../src/promises/model.js';

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

  it('per-term counts sum to the term total, and totals to the corpus count', () => {
    let grand = 0;
    for (const s of summaries) {
      const sum = QUALITIES.reduce((n, q) => n + s.counts[q], 0);
      expect(sum).toBe(s.total);
      grand += s.total;
    }
    expect(grand).toBe(CORPUS_PROMISE_COUNT);
  });

  it('the corpus-wide tier split matches the known extraction (12 / 91 / 21)', () => {
    const c = { full: 0, partial: 0, no: 0 };
    for (const s of summaries) for (const q of QUALITIES) c[q] += s.counts[q];
    expect(c).toEqual({ full: 12, partial: 91, no: 21 });
    expect(c.full + c.partial + c.no).toBe(124);
  });

  it('shares are a proper distribution within each term', () => {
    for (const s of summaries) {
      const totalShare = QUALITIES.reduce((n, q) => n + share(s, q), 0);
      expect(totalShare).toBeCloseTo(1, 10);
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
});
