import { describe, it, expect } from 'vitest';
import {
  CORPUS_TERMS,
  CORPUS_PROMISE_COUNT,
  CORPUS_OCCURRENCE_COUNT,
} from '../src/content/promises.generated.js';
import {
  QUALITIES,
  VERDICT_PLACEHOLDER,
  deltaBetween,
  filterByTiers,
  filterByTopics,
  share,
  summarize,
  topicCounts,
  topicCountsIn,
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

  it('the corpus-wide tier split matches the current extraction (16 / 141 / 38)', () => {
    // Snapshot anchor — update when the corpus grows. Acceptance + inaugural +
    // all seven final debates (2000–2024).
    const c = { full: 0, partial: 0, no: 0 };
    for (const s of summaries) for (const q of QUALITIES) c[q] += s.counts[q];
    expect(c).toEqual({ full: 16, partial: 141, no: 38 });
    expect(c.full + c.partial + c.no).toBe(195);
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
    const filtered = filterByTopics(CORPUS_TERMS, new Set(['taxes']));
    const s = summarize(filtered);
    const total = s.reduce((n, x) => n + x.total, 0);
    expect(total).toBe(topicCounts(CORPUS_TERMS).find((t) => t.theme === 'taxes')!.count);
    for (const term of filtered) for (const p of term.promises) expect(p.theme).toBe('taxes');
  });

  it('a multi-topic selection is the union of its topics, and an empty one is everything', () => {
    const counts = topicCounts(CORPUS_TERMS);
    const of = (theme: string) => counts.find((t) => t.theme === theme)!.count;

    const picked = new Set(['taxes', 'energy', 'health']);
    const filtered = filterByTopics(CORPUS_TERMS, picked);
    const total = summarize(filtered).reduce((n, s) => n + s.total, 0);
    expect(total).toBe(of('taxes') + of('energy') + of('health'));
    for (const term of filtered) for (const p of term.promises) expect(picked.has(p.theme)).toBe(true);

    // picking two topics is the sum of picking each — a union, never an
    // intersection, so a second pick can't empty out the first one's bars
    const taxes = summarize(filterByTopics(CORPUS_TERMS, new Set(['taxes'])));
    const energy = summarize(filterByTopics(CORPUS_TERMS, new Set(['energy'])));
    const both = summarize(filterByTopics(CORPUS_TERMS, new Set(['taxes', 'energy'])));
    for (let i = 0; i < both.length; i += 1) {
      expect(both[i]!.total).toBe(taxes[i]!.total + energy[i]!.total);
      for (const q of QUALITIES) {
        expect(both[i]!.counts[q]).toBe(taxes[i]!.counts[q] + energy[i]!.counts[q]);
      }
    }

    // no selection is no filter: same terms, untouched
    expect(filterByTopics(CORPUS_TERMS, new Set())).toBe(CORPUS_TERMS);
    // selecting every topic is the same as selecting none
    const allPicked = filterByTopics(CORPUS_TERMS, new Set(counts.map((t) => t.theme)));
    expect(summarize(allPicked)).toEqual(summarize(CORPUS_TERMS));
  });

  it('topic counts follow the tier filter, and the tiers still sum to the whole', () => {
    // What the page draws when only "full" is left selected in the chart legend.
    const full = topicCounts(filterByTiers(CORPUS_TERMS, new Set(['full'] as const)));
    expect(full.reduce((n, t) => n + t.count, 0)).toBe(16);
    for (const t of full) {
      const manual = CORPUS_TERMS.flatMap((x) => x.promises).filter(
        (p) => p.theme === t.theme && p.quality === 'full',
      ).length;
      expect(t.count).toBe(manual);
    }
    // a topic with no full promises drops out of the donut entirely
    const all = topicCounts(CORPUS_TERMS);
    expect(full.length).toBeLessThanOrEqual(all.length);
    for (const t of full) expect(all.some((a) => a.theme === t.theme)).toBe(true);

    // splitting the corpus by tier partitions it: the per-tier topic counts add
    // back up to the unfiltered ones, so no promise is double-counted or lost.
    const perTopic = new Map<string, number>();
    for (const q of QUALITIES) {
      for (const t of topicCounts(filterByTiers(CORPUS_TERMS, new Set([q])))) {
        perTopic.set(t.theme, (perTopic.get(t.theme) ?? 0) + t.count);
      }
    }
    expect([...perTopic.entries()].sort()).toEqual(
      all.map((t) => [t.theme, t.count] as [string, number]).sort(),
    );
  });

  it('the topic legend keeps every topic, and its order, as the category filter moves', () => {
    const order = topicCounts(CORPUS_TERMS).map((t) => t.theme);
    for (const q of QUALITIES) {
      const listed = topicCountsIn(filterByTiers(CORPUS_TERMS, new Set([q])), order);
      // same topics, same positions — only the numbers move, so nothing reflows
      expect(listed.map((t) => t.theme)).toEqual(order);
      // the ones this tier has nothing for are present at zero, not missing
      const live = new Set(
        topicCounts(filterByTiers(CORPUS_TERMS, new Set([q]))).map((t) => t.theme),
      );
      for (const t of listed) expect(t.count === 0).toBe(!live.has(t.theme));
      expect(listed.reduce((n, t) => n + t.count, 0)).toBe(
        CORPUS_TERMS.flatMap((x) => x.promises).filter((p) => p.quality === q).length,
      );
    }
    // with every tier shown it is exactly the unfiltered list again
    expect(topicCountsIn(CORPUS_TERMS, order)).toEqual(topicCounts(CORPUS_TERMS));

    // Why a greyed chip must not stay in the topic selection: it has nothing to
    // filter to, so the two filters together would leave the reader an empty
    // board with a chip they can no longer click off. The page drops such a
    // topic from the selection as the category filter empties it.
    for (const q of QUALITIES) {
      const tier = filterByTiers(CORPUS_TERMS, new Set([q]));
      for (const t of topicCountsIn(tier, order).filter((x) => x.count === 0)) {
        const both = summarize(filterByTopics(tier, new Set([t.theme])));
        expect(both.reduce((n, s) => n + s.total, 0)).toBe(0);
      }
    }
  });

  it('the two filters commute — topic then tier is the same set as tier then topic', () => {
    const tiers = new Set(['full', 'partial'] as const);
    const picked = new Set(['health']);
    const a = summarize(filterByTiers(filterByTopics(CORPUS_TERMS, picked), tiers));
    const b = summarize(filterByTopics(filterByTiers(CORPUS_TERMS, tiers), picked));
    expect(a).toEqual(b);
    const total = a.reduce((n, s) => n + s.total, 0);
    expect(total).toBe(
      topicCounts(filterByTiers(CORPUS_TERMS, tiers)).find((t) => t.theme === 'health')!.count,
    );
    for (const term of a) expect(term.counts.no).toBe(0);
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

  it('every tier has verification copy, and only full is waiting on a verdict', () => {
    for (const q of QUALITIES) {
      const v = VERDICT_PLACEHOLDER[q];
      expect(v.label).toBeTruthy();
      expect(v.note).toBeTruthy();
      expect(v.mark).toBeTruthy();
    }
    // the scoring pass starts (and for now, stops) at the fully verifiable tier,
    // and the two it skips are skipped for different reasons
    expect(VERDICT_PLACEHOLDER.full.label).toMatch(/pending/i);
    expect(VERDICT_PLACEHOLDER.partial.label).toMatch(/scope/i);
    expect(VERDICT_PLACEHOLDER.no.label).toMatch(/infeasible/i);
  });
});
