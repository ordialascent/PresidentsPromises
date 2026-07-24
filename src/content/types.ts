import type {
  BaselineCandidate,
  Comparator,
  DeadlineCandidate,
  ScopePreset,
  SeriesPoint,
  TargetRule,
  YScaleMode,
} from '../chart/index.js';

/**
 * The content model is deliberately shallow. A Topic is one measurable subject
 * (the federal deficit) carrying one shared, cross-president series plus the
 * promises made about it. Comparing presidents on a topic is then "iterate the
 * topic's promises against the one series" — a data addition, not a rebuild.
 * We are not committing to more structure than that until the product asks for
 * it.
 */

/** A presidential term, as a names-only reading aid. Never coloured by party. */
export interface Term {
  label: string;
  /** Inauguration calendar year (≈ Jan 20). */
  from: number;
  /** Next inauguration calendar year. */
  to: number;
}

/** One promise made about a topic, by one person on one occasion. */
export interface PromiseSpec {
  id: string;
  who: string;
  quote: string;
  occasion: string;
  date: string;
  baselineCandidates: BaselineCandidate[];
  deadlineCandidates: DeadlineCandidate[];
  targetRule: TargetRule;
  /** Where to place a baseline dot whose candidate has no meaningful x. */
  baselineAnchorX?: number;
}

export interface TopicProvenance {
  dataAsOf: string;
  publisher: string;
  seriesId: string;
  sourceUrl: string;
  isBootstrap: boolean;
}

/** A measurable subject and everything needed to read promises against it. */
export interface Topic {
  id: string;
  title: string;
  /** Axis / unit label for the shared series. */
  subject: string;
  /** Direction of success — a topic-level fact, never inferred from the data. */
  comparator: Comparator;
  /** The one series every promise on this topic is measured against. */
  series: SeriesPoint[];
  terms: Term[];
  /** Range for the optional custom (free-standing) baseline value. */
  valueBounds: { min: number; max: number };
  scopePresets: ScopePreset[];
  yScaleMode?: YScaleMode;
  periodNote?: string;
  formatValue: (n: number) => string;
  formatX: (x: number) => string;
  provenance: TopicProvenance;
  /** Promises made on this topic, across presidents. */
  promises: PromiseSpec[];
}
