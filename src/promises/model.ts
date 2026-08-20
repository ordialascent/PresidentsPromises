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
 * The three differ in kind, not in degree: a *full* promise carries a metric, a
 * threshold and a deadline, so a verdict is only waiting to be done. A *partial*
 * one could be scored, but only by supplying the terms it left out — deferred,
 * not impossible. A promise with *no* measurable quantity has nothing to score
 * at all. Replace `full` here when the first verdicts land.
 */
export const VERDICT_PLACEHOLDER: Record<Quality, VerdictPlaceholder> = {
  full: {
    label: 'Verdict pending',
    mark: '?',
    note: 'Metric, threshold and deadline are all on the record, so this promise can be scored against it. That analysis is coming soon.',
  },
  partial: {
    label: 'Verdict out of scope (MVP)',
    mark: '–',
    note: 'The metric is on the record, but at least one of the threshold and deadline is missing or too vague. Supplying it is a judgement call, and out of scope for the MVP.',
  },
  no: {
    label: 'Verdict infeasible',
    mark: '–',
    note: 'Due to the lack of specificity (metric, threshold, deadline), a verdict would require too many assumptions.',
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

/**
 * One promise carrying the term it was made in. The chart reads promises
 * *grouped* by term (that grouping is the bars); the list reads them flat, one
 * row per promise across every president, so each row has to say whose it is.
 */
export interface PromiseRow {
  promise: CorpusPromise;
  termKey: string;
  /** Bar label, e.g. "Obama 2008". */
  termLabel: string;
  surname: string;
  speechYear: number | null;
}

/**
 * Every promise in `terms` as a flat list, in corpus order — terms are
 * chronological, so the list reads oldest-first with no further sorting. This is
 * the shape the searchable list wants, and it is derived, never stored: the
 * grouped corpus stays the one representation.
 */
export function flattenPromises(terms: CorpusTerm[]): PromiseRow[] {
  return terms.flatMap((t) =>
    t.promises.map((promise) => ({
      promise,
      termKey: t.key,
      termLabel: t.label,
      surname: t.surname,
      speechYear: t.speechYear,
    })),
  );
}

/** The promises of one president in one tier — what clicking a bar block means. */
export function filterBySegment(
  rows: PromiseRow[],
  segment: { termKey: string; quality: Quality } | null,
): PromiseRow[] {
  if (!segment) return rows;
  return rows.filter(
    (r) => r.termKey === segment.termKey && r.promise.quality === segment.quality,
  );
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
 * Promise count per topic over `terms`, listed in `order` and zero-filled: a
 * topic the category filter has emptied comes back as 0 rather than vanishing,
 * so the legend keeps both its shape and its ordering while the filter moves.
 * Only the numbers change — never which chips exist, or where they sit.
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
