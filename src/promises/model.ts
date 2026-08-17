import type { CorpusPromise, CorpusTerm, Quality } from '../content/promises.generated.js';

export type { CorpusPromise, CorpusTerm, Quality };

/**
 * The three measurability tiers, in stack order **bottom → top**: the most
 * measurable sits at the base. This is a quality-of-promise axis (can "was it
 * kept?" even be asked as a measured question?), never a kept/broken verdict
 * and never a party coding.
 */
export const QUALITIES: Quality[] = ['full', 'partial', 'no'];

export interface QualityMeta {
  key: Quality;
  label: string;
  blurb: string;
}

export const QUALITY_META: Record<Quality, QualityMeta> = {
  full: { key: 'full', label: 'Full', blurb: 'metric + threshold + deadline all present' },
  partial: { key: 'partial', label: 'Partial', blurb: 'at least one is missing or too vague' },
  no: { key: 'no', label: 'None', blurb: 'aspirational — no measurable quantity' },
};

export interface VerdictPlaceholder {
  /** Short status word, shown next to the mark. */
  label: string;
  /** One line saying why that status, in the reader's terms. */
  note: string;
  /** Stand-in for the eventual pass/fail glyph. */
  mark: string;
}

/**
 * What the detail panel says under the quotes until the scoring pass exists.
 * The split is the point: only a *full* promise carries a metric, a threshold
 * and a deadline, so it is the only tier that can ever be scored against the
 * record. The other two say so plainly rather than promising an analysis that
 * is not coming. Replace `full` here when the first verdicts land.
 */
export const VERDICT_PLACEHOLDER: Record<Quality, VerdictPlaceholder> = {
  full: {
    label: 'Verdict pending',
    mark: '?',
    note: 'Metric, threshold and deadline are all on the record, so this promise can be scored against it. That analysis is coming soon.',
  },
  partial: {
    label: 'Not yet in scope',
    mark: '–',
    note: 'Scoring starts with the fully verifiable promises. This one is missing a threshold or a deadline, so there is no unambiguous test to run against it.',
  },
  no: {
    label: 'Not in scope',
    mark: '–',
    note: 'Nothing here is measurable — no metric, no threshold, no deadline — so there is no record to check it against.',
  },
};

/** One term with its promises rolled up by tier. */
export interface TermSummary {
  key: string;
  label: string;
  surname: string;
  termLabel: string;
  speechYear: number | null;
  total: number;
  counts: Record<Quality, number>;
  promises: CorpusPromise[];
}

export interface TopicCount {
  theme: string;
  count: number;
}

/** Terms carrying only the promises whose tier is in `tiers`. */
export function filterByTiers(terms: CorpusTerm[], tiers: ReadonlySet<Quality>): CorpusTerm[] {
  return terms.map((t) => ({ ...t, promises: t.promises.filter((p) => tiers.has(p.quality)) }));
}

/**
 * Terms carrying only the promises on the selected `themes`. An empty selection
 * is no filter at all: picking topics narrows, and un-picking the last one is
 * how you get back to everything.
 */
export function filterByTopics(terms: CorpusTerm[], themes: ReadonlySet<string>): CorpusTerm[] {
  if (themes.size === 0) return terms;
  return terms.map((t) => ({ ...t, promises: t.promises.filter((p) => themes.has(p.theme)) }));
}

/**
 * Promise count per topic over `terms`, listed in `order` and zero-filled:
 * a topic the filters have emptied comes back as 0 rather than vanishing, so
 * the legend keeps both its shape and its ordering while the filters move.
 */
export function topicCountsIn(terms: CorpusTerm[], order: readonly string[]): TopicCount[] {
  const counted = new Map(topicCounts(terms).map((t) => [t.theme, t.count]));
  return order.map((theme) => ({ theme, count: counted.get(theme) ?? 0 }));
}

/** Promise count per topic across all terms, largest first (ties alphabetical). */
export function topicCounts(terms: CorpusTerm[]): TopicCount[] {
  const m = new Map<string, number>();
  for (const t of terms) for (const p of t.promises) m.set(p.theme, (m.get(p.theme) ?? 0) + 1);
  return [...m.entries()]
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count || a.theme.localeCompare(b.theme));
}

export function summarize(terms: CorpusTerm[]): TermSummary[] {
  return terms.map((t) => {
    const counts: Record<Quality, number> = { full: 0, partial: 0, no: 0 };
    for (const p of t.promises) counts[p.quality] += 1;
    return {
      key: t.key,
      label: t.label,
      surname: t.surname,
      termLabel: t.termLabel,
      speechYear: t.speechYear,
      total: t.promises.length,
      counts,
      promises: t.promises,
    };
  });
}

/** Share of a tier within its term (0 when the term has no promises). */
export function share(summary: TermSummary, quality: Quality): number {
  return summary.total === 0 ? 0 : summary.counts[quality] / summary.total;
}

export interface Delta {
  quality: Quality;
  /** Change in raw count from the previous term to this one. */
  count: number;
  /** Change in share, in percentage points. */
  points: number;
}

/**
 * Tier-by-tier change from `prev` to `curr`. `count` drives the absolute view's
 * ± labels; `points` (percentage points) drives the normalized view's.
 */
export function deltaBetween(prev: TermSummary, curr: TermSummary): Record<Quality, Delta> {
  const out = {} as Record<Quality, Delta>;
  for (const q of QUALITIES) {
    out[q] = {
      quality: q,
      count: curr.counts[q] - prev.counts[q],
      points: (share(curr, q) - share(prev, q)) * 100,
    };
  }
  return out;
}
