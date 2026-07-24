/**
 * Vocabulary note (enforced by test/vocabulary-fence.test.ts):
 * this package speaks only in claim / subject / series / target / period /
 * baseline / deadline / comparator. It carries no knowledge of what any claim
 * is *about*. If a concept cannot be said in those words, it belongs to the
 * consuming application, not here.
 */

/** Where a single measurement came from. Provenance travels with the point. */
export interface Provenance {
  sourceUrl?: string;
  retrievedAt?: string;
  publisher?: string;
  note?: string;
}

/** One measurement in the observed series. */
export interface SeriesPoint {
  x: number;
  y: number;
  provenance?: Provenance;
}

/**
 * A candidate starting value for the target derivation.
 *
 * `value` is independent of the series: it may be a figure that appears
 * nowhere in the data. When `x` is absent (or arbitrary) it is placement
 * only — it positions the dot, it does not read a value off the series.
 * `stated: true` marks a value that is asserted from outside the data rather
 * than grounded in it.
 */
export interface BaselineCandidate {
  label: string;
  value: number;
  x?: number;
  source?: string;
  stated?: boolean;
}

/** A candidate evaluation point. */
export interface DeadlineCandidate {
  label: string;
  x: number;
  source?: string;
}

/** How the target is derived from the baseline value. */
export type TargetRule =
  | { kind: 'halve' }
  | { kind: 'reduceByPercent'; percent: number }
  | { kind: 'reduceToAbsolute'; value: number };

/**
 * Direction of success, stated explicitly and never inferred from the data.
 * `lte`: the observed value meets the target when it is at or below it.
 * `gte`: the observed value meets the target when it is at or above it.
 */
export type Comparator = 'lte' | 'gte';

/** A named span drawn behind the series as a reading aid. */
export interface Period {
  label: string;
  x0: number;
  x1: number;
}

/** A named view window over the x axis. */
export interface ScopePreset {
  label: string;
  xMin: number;
  xMax: number;
}

/**
 * Per-knob range specification. Start and end are different constraint kinds:
 * the start is a closed interval; the end may be open-ended on the right.
 */
export interface KnobBounds {
  start: { min: number; max: number };
  end: { min: number; max?: number; openEnded?: boolean };
}

/** Locked keeps the y range fixed to the default window; auto refits it. */
export type YScaleMode = 'locked' | 'auto';

/** The three readings the library can derive. Never supplied by a caller. */
export type Outcome = 'met' | 'missed' | 'indeterminate';

/**
 * A fully specified parametric-target claim. Notably absent: any field that
 * would let a caller hand in the reading. The reading is derived from
 * (series, baseline, deadline, targetRule, comparator) and nothing else.
 */
export interface ParametricTargetClaim {
  /** A neutral label for what the series measures. */
  subject: string;
  series: SeriesPoint[];
  baselineCandidates: BaselineCandidate[];
  deadlineCandidates: DeadlineCandidate[];
  targetRule: TargetRule;
  comparator: Comparator;
  bounds: KnobBounds;
  scopePresets: ScopePreset[];
  periods?: Period[];
  yScaleMode?: YScaleMode;
  /** Where to place a baseline dot whose candidate has no meaningful x. */
  baselineAnchorX?: number;
  /** Optional note rendered near the period bands. */
  periodNote?: string;
  formatValue?: (n: number) => string;
  formatX?: (x: number) => string;
}
