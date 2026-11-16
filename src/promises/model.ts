import type {
  CorpusPromise,
  CorpusTerm,
  Kind,
  Quality,
  Verdict,
  VerdictValue,
} from '../content/promises.generated.js';

export type { CorpusPromise, CorpusTerm, Kind, Quality, Verdict, VerdictValue };

/**
 * The three measurability tiers, in stack order **bottom → top**: the most
 * measurable sits at the base. This is a quality-of-promise axis (can "was it
 * kept?" even be asked as a measured question?), never a kept/broken verdict
 * and never a party coding.
 */
export const QUALITIES: Quality[] = ['high', 'medium', 'low'];

export interface QualityMeta {
  key: Quality;
  label: string;
  blurb: string;
}

/** The tiers are the protocol's verifiability levels (corpus/PROTOCOL.md §4). */
export const QUALITY_META: Record<Quality, QualityMeta> = {
  high: { key: 'high', label: 'High', blurb: 'object, public record and criterion all fixed by the words' },
  medium: { key: 'medium', label: 'Medium', blurb: 'needs one stated judgement call' },
  low: { key: 'low', label: 'Low', blurb: 'object or record missing, or several judgement calls' },
};

export const KIND_META: Record<Kind, { label: string; plural: string }> = {
  promise: { label: 'promise', plural: 'Promises' },
  ambition: { label: 'ambition', plural: 'Ambitions' },
};

/**
 * The corpus as one kind of record: promises (firm language) or ambitions
 * (wishes and obligations). The board shows one kind at a time, so every view
 * reads the `promises` slot and this swaps what is in it.
 */
export function termsOfKind(terms: CorpusTerm[], kind: Kind): CorpusTerm[] {
  return kind === 'promise' ? terms : terms.map((t) => ({ ...t, promises: t.ambitions }));
}

/**
 * What the list row and the detail panel say about keeping a record. For a
 * judged promise that is its verdict; a verdict whose evidence still needs a
 * human check is shown as "under review"; otherwise it says why there is none.
 */
export type VerdictStatus =
  | VerdictValue
  | 'review'
  | 'unjudged'
  | 'infeasible'
  | 'ambition';

export interface VerdictView {
  status: VerdictStatus;
  /** Short status word, shown next to the mark. */
  label: string;
  /** The same status as one lower-case word for the list row's tag. */
  tag: string;
  /** One line saying why that status, in the reader's terms. */
  note: string;
  /** The glyph in the detail panel's mark. */
  mark: string;
  /** The verdict record, when there is one (also when under review). */
  record: Verdict | null;
}

/** Kept, partly, broken: the readings that count towards a track record, in display order. */
export const SETTLED: VerdictValue[] = ['kept', 'partly', 'broken'];

/** Every verdict status a judged promise can show, in display order. */
export const VERDICT_STATUSES: (VerdictValue | 'review')[] = [
  'kept',
  'partly',
  'broken',
  'indeterminate',
  'review',
  'pending',
];

export const VERDICT_META: Record<VerdictValue | 'review', { label: string; mark: string; blurb: string }> = {
  kept: { label: 'Kept', mark: '✓', blurb: 'the criterion was met by the deadline' },
  partly: { label: 'Partly kept', mark: '◐', blurb: 'met only in part, or only for a time' },
  broken: { label: 'Broken', mark: '✗', blurb: 'not met by the deadline, or the opposite was done' },
  indeterminate: { label: 'Indeterminate', mark: '?', blurb: 'the record does not settle it' },
  review: { label: 'Under review', mark: '…', blurb: 'a figure is being confirmed against the official record' },
  pending: { label: 'Pending', mark: '⧗', blurb: 'the deadline has not passed yet' },
};

/** The tag word for each status: one lower-case word that the label contains. */
const VERDICT_TAG: Record<VerdictValue | 'review', string> = {
  kept: 'kept',
  partly: 'partly',
  broken: 'broken',
  indeterminate: 'indeterminate',
  review: 'review',
  pending: 'pending',
};

/** What can be said about keeping this record. */
export function verdictFor(p: CorpusPromise): VerdictView {
  if (p.kind === 'ambition') return AMBITION_PLACEHOLDER;
  const v = p.verdict;
  if (!v) return VERDICT_PLACEHOLDER[p.quality];
  const status: VerdictValue | 'review' = v.review ? 'review' : v.verdict;
  const meta = VERDICT_META[status];
  return {
    status,
    label: meta.label,
    tag: VERDICT_TAG[status],
    mark: meta.mark,
    note: v.summary,
    record: v,
  };
}

const AMBITION_PLACEHOLDER: VerdictView = {
  status: 'ambition',
  label: 'No verdict (ambition)',
  tag: 'ambition',
  mark: '–',
  note: 'Said as a wish or an obligation ("we must", "I want"), not as a commitment. Ambitions are recorded and rated like promises, but never get a kept/broken verdict.',
  record: null,
};

export const VERDICT_PLACEHOLDER: Record<Quality, VerdictView> = {
  high: {
    status: 'unjudged',
    label: 'Unjudged',
    tag: 'unjudged',
    mark: '?',
    note: 'The words fix what the promise is about, a public record shows what happened, and the words say what counts as kept. The check has not been done yet.',
    record: null,
  },
  medium: {
    status: 'unjudged',
    label: 'Unjudged',
    tag: 'unjudged',
    mark: '?',
    note: 'Checkable against a public record once one judgement call is made; the call is stated above. The check has not been done yet.',
    record: null,
  },
  low: {
    status: 'infeasible',
    label: 'Verdict infeasible',
    tag: 'infeasible',
    mark: '–',
    note: 'The words leave open what it is about or where it would show, or would need more than one judgement call to check.',
    record: null,
  },
};

/** One term's verdicts, counted by status. */
export interface TrackRecord {
  key: string;
  label: string;
  termLabel: string;
  /** High and medium promises: the ones that get a verdict. */
  verifiable: number;
  counts: Record<VerdictValue | 'review', number>;
  /** Kept, partly and broken together: the base for the kept share. */
  settled: number;
}

/** Verdict counts per term. Under-review verdicts count apart from their provisional reading. */
export function trackRecords(terms: CorpusTerm[]): TrackRecord[] {
  return terms.map((t) => {
    const counts = Object.fromEntries(VERDICT_STATUSES.map((s) => [s, 0])) as TrackRecord['counts'];
    let verifiable = 0;
    for (const p of t.promises) {
      if (p.quality === 'low') continue;
      verifiable += 1;
      if (!p.verdict) continue;
      counts[p.verdict.review ? 'review' : p.verdict.verdict] += 1;
    }
    return {
      key: t.key,
      label: t.label,
      termLabel: t.termLabel,
      verifiable,
      counts,
      settled: SETTLED.reduce((n, s) => n + counts[s], 0),
    };
  });
}

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

/** One cell of the track record: a president's term crossed with a verdict. */
export interface VerdictPick {
  termKey: string;
  status: VerdictValue | 'review';
}

/** The promises of one term with one verdict status — what clicking a track-record cell means. */
export function filterByVerdict(rows: PromiseRow[], pick: VerdictPick | null): PromiseRow[] {
  if (!pick) return rows;
  return rows.filter((r) => r.termKey === pick.termKey && verdictFor(r.promise).status === pick.status);
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
    const counts: Record<Quality, number> = { high: 0, medium: 0, low: 0 };
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

/** One term's line in the methodology page's table: how screening went, and what came out. */
export interface MethodRow {
  key: string;
  label: string;
  /** Candidate sentences with a recorded decision, over all of the term's sources. */
  screened: number;
  included: number;
  excluded: number;
  /** Exclusion reasons with their counts, in protocol order, zeros dropped. */
  excludedBy: [string, number][];
  promises: number;
  tiers: Record<Quality, number>;
  ambitions: number;
}

export function methodRows(terms: CorpusTerm[]): MethodRow[] {
  return terms.map((t) => {
    const entries = Object.entries(t.screening) as [string, number][];
    const screened = entries.reduce((n, [, c]) => n + c, 0);
    const included = t.screening.include;
    const tiers: Record<Quality, number> = { high: 0, medium: 0, low: 0 };
    for (const p of t.promises) tiers[p.quality] += 1;
    return {
      key: t.key,
      label: t.label,
      screened,
      included,
      excluded: screened - included,
      excludedBy: entries.filter(([d, c]) => d !== 'include' && c > 0),
      promises: t.promises.length,
      tiers,
      ambitions: t.ambitions.length,
    };
  });
}
