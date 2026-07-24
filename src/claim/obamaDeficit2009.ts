import type { ParametricTargetClaim, Period } from 'ambiguity-graphs';
import { deriveVerdict, type Derivation } from 'ambiguity-graphs';
import { currentRows, dataAsOf, isBootstrap, publisher, seriesId, sourceUrl } from '../data/snapshot.js';

/**
 * The claim, verbatim:
 *   Barack Obama, Fiscal Responsibility Summit, 23 Feb 2009 —
 *   "cut the deficit we inherited in half by the end of my first term."
 *
 * Two parameters are genuinely disputed, and the reading flips with them:
 *   - which figure is the baseline (a stated $1.30T vs the recorded FY2009), and
 *   - which fiscal year is the deadline (FY2012 vs FY2013).
 * The product surfaces that; it does not resolve it.
 */

// The sign/units transform lives here, next to the comparator that needs it.
// FYFSD is published surplus-positive / deficit-negative, in USD millions. We
// measure the DEFICIT as a positive magnitude in USD billions, so comparator
// 'lte' reads as "deficit at or below the target".
export const toDeficitBillions = (valueRawMusd: number): number => -valueRawMusd / 1000;

// A figure Obama stated aloud. It appears NOWHERE in the data — that is the
// point of the "stated / decoupled" baseline, not an edge case.
export const STATED_BASELINE_BILLIONS = 1300;

const recordedFY2009 = currentRows.find((r) => r.fy === 2009);
export const RECORDED_FY2009_BILLIONS = recordedFY2009
  ? toDeficitBillions(recordedFY2009.valueRawMusd)
  : 1412.688;

const series = currentRows.map((r) => ({
  x: r.fy,
  y: toDeficitBillions(r.valueRawMusd),
  provenance: {
    sourceUrl: r.sourceUrl,
    retrievedAt: r.retrievedAt,
    publisher: r.publisher,
    note: r.retrievalMethod,
  },
}));

const usd = (n: number): string => {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1000) return `${sign}$${(a / 1000).toFixed(2)}T`;
  if (a >= 1) return `${sign}$${Math.round(a)}B`;
  return `${sign}$${a.toFixed(1)}B`;
};

const fy = (x: number): string => `FY${String(Math.round(x)).slice(2)}`;

// Inauguration (~Jan 20) falls about a third of the way into the fiscal year,
// so on an axis whose integer marks are fiscal-year ends it sits ~0.7 before
// the mark. Bands therefore deliberately do NOT align to FY gridlines.
const inaugurationX = (calendarYear: number): number => calendarYear - 0.7;

// Names-only reading aids. Never coloured by party, never a scorecard.
const TERMS: Array<{ label: string; from: number; to: number }> = [
  { label: 'Clinton II', from: 1997, to: 2001 },
  { label: 'Bush I', from: 2001, to: 2005 },
  { label: 'Bush II', from: 2005, to: 2009 },
  { label: 'Obama I', from: 2009, to: 2013 },
  { label: 'Obama II', from: 2013, to: 2017 },
];

const periods: Period[] = TERMS.map((t) => ({
  label: t.label,
  x0: inaugurationX(t.from),
  x1: inaugurationX(t.to),
}));

export const deficitClaim: ParametricTargetClaim = {
  subject: 'Federal deficit (USD billions)',
  series,
  baselineCandidates: [
    {
      label: 'recorded FY2009',
      value: RECORDED_FY2009_BILLIONS,
      x: 2009,
      source: 'FYFSD',
      stated: false,
    },
    {
      label: 'stated $1.30T',
      value: STATED_BASELINE_BILLIONS,
      source: '2009 remarks',
      stated: true,
    },
  ],
  deadlineCandidates: [
    { label: 'FY2012', x: 2012, source: 'strict end of term' },
    { label: 'FY2013', x: 2013, source: 'FY the term ended in' },
  ],
  targetRule: { kind: 'halve' },
  comparator: 'lte',
  bounds: {
    start: { min: 600, max: 1600 },
    end: { min: 2009, openEnded: true },
  },
  scopePresets: [
    { label: 'SCOPED · TERM ±1Y', xMin: 2007, xMax: 2014 },
    { label: 'OPEN · full range', xMin: 1997, xMax: 2017 },
  ],
  periods,
  yScaleMode: 'locked',
  baselineAnchorX: 2009,
  periodNote:
    'Term bands run inauguration to inauguration (about a third into the fiscal year) and deliberately do not align to fiscal-year boundaries. Attributing a fiscal year to a president is itself an ambiguity, not a fact.',
  formatValue: usd,
  formatX: fy,
};

/** Derive the reading for any baseline value / deadline, using this claim. */
export function readAt(baselineValue: number, deadlineX: number, deadlineLabel?: string): Derivation {
  return deriveVerdict({
    series,
    baselineValue,
    deadlineX,
    deadlineLabel,
    targetRule: deficitClaim.targetRule,
    comparator: deficitClaim.comparator,
  });
}

// The 2x2 the product refuses to collapse. Order matches the brief's grid.
export const baselineChoices = [
  { label: 'stated $1.30T', value: STATED_BASELINE_BILLIONS, stated: true },
  { label: 'recorded FY2009', value: RECORDED_FY2009_BILLIONS, stated: false },
];
export const deadlineChoices = [
  { label: 'FY2012', x: 2012 },
  { label: 'FY2013', x: 2013 },
];

export const provenance = { dataAsOf, publisher, seriesId, sourceUrl, isBootstrap };
export { usd as formatUSD, fy as formatFY };
