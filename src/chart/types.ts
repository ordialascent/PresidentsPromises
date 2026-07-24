/**
 * The chart is a domain-neutral primitive: it speaks in claim / subject /
 * series / target / period / baseline / deadline / comparator, and never learns
 * what a claim is about. Kept internal to the app for now (see ARCHITECTURE.md),
 * still written so it could be extracted later.
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
 * A candidate starting value for the target derivation. `value` is independent
 * of the series — it may be a figure that appears nowhere in the data. `x`, when
 * present, is the year that figure belongs to. `stated: true` marks a value
 * asserted from outside the data rather than read off it.
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
 * `lte`: met when the observed value is at or below the target.
 * `gte`: met when the observed value is at or above the target.
 */
export type Comparator = 'lte' | 'gte';

/** A named span drawn behind the series as a reading aid. */
export interface Period {
  label: string;
  x0: number;
  x1: number;
}

/** A named view window over the x axis. `[0]` is the default, narrow window. */
export interface ScopePreset {
  label: string;
  xMin: number;
  xMax: number;
}

/** A notable year marked on a slider, with a short event label. */
export interface YearMark {
  x: number;
  label: string;
}

/** A one-tap preset for the custom baseline value. */
export interface ValuePreset {
  label: string;
  value: number;
}

/** Locked keeps the y range fixed to the default window; auto refits it. */
export type YScaleMode = 'locked' | 'auto';

/** The three readings the chart can derive. Never supplied by a caller. */
export type Outcome = 'met' | 'missed' | 'indeterminate';

/**
 * A fully specified parametric-target claim. Notably absent: any field that
 * would let a caller hand in the reading — it is derived from
 * (series, baseline, deadline, targetRule, comparator) and nothing else.
 *
 * The baseline is chosen by a *year* (the start slider) whose value is read off
 * the series, unless the reader overrides it with a custom value.
 */
export interface ParametricTargetClaim {
  subject: string;
  series: SeriesPoint[];
  comparator: Comparator;
  targetRule: TargetRule;
  periods?: Period[];
  /** `[0]` is the default narrow window; `[1]` a wider one. */
  scopePresets: ScopePreset[];
  yScaleMode?: YScaleMode;
  periodNote?: string;

  /** Default year for the baseline (start) slider. */
  defaultStartX: number;
  /** Notable years marked on the start slider. */
  startMarks?: YearMark[];
  /** Range for the optional custom (free-standing) baseline value. */
  valueBounds: { min: number; max: number };
  /** One-tap presets that set the custom baseline value. */
  customValuePresets?: ValuePreset[];

  /** Default year for the deadline (end) slider. */
  defaultDeadlineX: number;
  /** Notable years marked on the end slider. */
  deadlineMarks?: YearMark[];

  formatValue?: (n: number) => string;
  formatX?: (x: number) => string;
}
