import type { Comparator, Outcome, SeriesPoint, TargetRule } from '../types.js';
import { deriveTarget } from './deriveTarget.js';
import { observedAt } from './resolve.js';

export interface DerivationInput {
  series: SeriesPoint[];
  baselineValue: number;
  deadlineX: number;
  deadlineLabel?: string;
  targetRule: TargetRule;
  comparator: Comparator;
}

/**
 * The derived reading and every number behind it, so the caller can show the
 * whole derivation rather than a bare word. There is deliberately no way to
 * supply `outcome` from outside: it is computed here or nowhere.
 */
export interface Derivation {
  baselineValue: number;
  rule: TargetRule;
  comparator: Comparator;
  target: number;
  deadlineX: number;
  deadlineLabel?: string;
  observed: number | null;
  outcome: Outcome;
  /** observed - target, when an observation exists. */
  gap: number | null;
  /** Positive magnitude past/short of the target, with a direction word. */
  distance: number | null;
  distanceWord: 'over' | 'under' | 'short' | null;
}

/**
 * Derive met / missed / indeterminate from the parameters and nothing else.
 * This is the single source of a reading in the whole package.
 */
export function deriveVerdict(input: DerivationInput): Derivation {
  const { series, baselineValue, deadlineX, deadlineLabel, targetRule, comparator } = input;
  const target = deriveTarget(baselineValue, targetRule);
  const observed = observedAt(series, deadlineX);

  if (observed === null) {
    return {
      baselineValue,
      rule: targetRule,
      comparator,
      target,
      deadlineX,
      deadlineLabel,
      observed: null,
      outcome: 'indeterminate',
      gap: null,
      distance: null,
      distanceWord: null,
    };
  }

  const meets = comparator === 'lte' ? observed <= target : observed >= target;
  const outcome: Outcome = meets ? 'met' : 'missed';
  const gap = observed - target;

  let distance: number;
  let distanceWord: 'over' | 'under' | 'short';
  if (comparator === 'lte') {
    // Success is at-or-below. Above target = over (missed); below = under (met).
    distance = Math.abs(gap);
    distanceWord = meets ? 'under' : 'over';
  } else {
    // Success is at-or-above. Below target = short (missed); above = over (met).
    distance = Math.abs(gap);
    distanceWord = meets ? 'over' : 'short';
  }

  return {
    baselineValue,
    rule: targetRule,
    comparator,
    target,
    deadlineX,
    deadlineLabel,
    observed,
    outcome,
    gap,
    distance,
    distanceWord,
  };
}

const DEFAULT_FMT = (n: number) => String(Math.round(n));

/** The rule expression, e.g. "1300 ÷ 2 = 650" or "1300 − 50% = 650". */
export function describeRule(
  baselineValue: number,
  rule: TargetRule,
  target: number,
  formatValue: (n: number) => string = DEFAULT_FMT,
): string {
  switch (rule.kind) {
    case 'halve':
      return `${formatValue(baselineValue)} ÷ 2 = ${formatValue(target)}`;
    case 'reduceByPercent':
      return `${formatValue(baselineValue)} − ${rule.percent}% = ${formatValue(target)}`;
    case 'reduceToAbsolute':
      return `target = ${formatValue(target)}`;
  }
}

/**
 * The whole one-line derivation, e.g.
 * "target = 1300 ÷ 2 = 650 · observed @ FY12 = 1087 · over by 437".
 */
export function describeDerivation(
  d: Derivation,
  formatValue: (n: number) => string = DEFAULT_FMT,
): string {
  const rulePart =
    d.rule.kind === 'reduceToAbsolute'
      ? describeRule(d.baselineValue, d.rule, d.target, formatValue)
      : `target = ${describeRule(d.baselineValue, d.rule, d.target, formatValue)}`;
  const at = d.deadlineLabel ?? String(d.deadlineX);
  if (d.observed === null) {
    return `${rulePart} · no observation @ ${at}`;
  }
  const obsPart = `observed @ ${at} = ${formatValue(d.observed)}`;
  const gapPart = `${d.distanceWord} by ${formatValue(d.distance ?? 0)}`;
  return `${rulePart} · ${obsPart} · ${gapPart}`;
}
