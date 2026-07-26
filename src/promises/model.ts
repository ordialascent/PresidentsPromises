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
