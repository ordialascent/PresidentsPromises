import type { Derivation, ParametricTargetClaim } from '../chart/index.js';
import { deriveVerdict } from '../chart/index.js';
import {
  currentRows,
  dataAsOf,
  isBootstrap,
  publisher,
  seriesId,
  sourceUrl,
} from '../data/snapshot.js';
import type { PromiseSpec, Term, Topic } from './types.js';

// The sign/units transform lives next to the comparator that needs it. FYFSD is
// published surplus-positive / deficit-negative in USD millions; we measure the
// deficit as a positive magnitude in USD billions, so comparator 'lte' reads as
// "deficit at or below the target".
export const toDeficitBillions = (valueRawMusd: number): number => -valueRawMusd / 1000;

const recordedFY2009 = currentRows.find((r) => r.fy === 2009);
export const RECORDED_FY2009_BILLIONS = recordedFY2009
  ? toDeficitBillions(recordedFY2009.valueRawMusd)
  : 1412.688;

// A figure Obama stated aloud; it appears nowhere in the data. That is the
// point of the "stated / decoupled" baseline, not an edge case.
export const STATED_BASELINE_BILLIONS = 1300;

const usd = (n: number): string => {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1000) return `${sign}$${(a / 1000).toFixed(2)}T`;
  if (a >= 1) return `${sign}$${Math.round(a)}B`;
  return `${sign}$${a.toFixed(1)}B`;
};

const fy = (x: number): string => `FY${String(Math.round(x)).slice(2)}`;

// Inauguration (~Jan 20) falls about a third into the fiscal year, so on an axis
// whose integer marks are fiscal-year ends it sits ~0.7 before the mark. Bands
// therefore deliberately do NOT align to FY gridlines.
export const inaugurationX = (calendarYear: number): number => calendarYear - 0.7;

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

const terms: Term[] = [
  { label: 'Clinton II', from: 1997, to: 2001 },
  { label: 'Bush I', from: 2001, to: 2005 },
  { label: 'Bush II', from: 2005, to: 2009 },
  { label: 'Obama I', from: 2009, to: 2013 },
  { label: 'Obama II', from: 2013, to: 2017 },
];

const obamaDeficit2009: PromiseSpec = {
  id: 'obama-deficit-2009',
  who: 'Barack Obama',
  quote: 'cut the deficit we inherited in half by the end of my first term.',
  occasion: 'Fiscal Responsibility Summit',
  date: '23 February 2009',
  baselineCandidates: [
    { label: 'recorded FY2009', value: RECORDED_FY2009_BILLIONS, x: 2009, source: 'FYFSD', stated: false },
    { label: 'stated $1.30T', value: STATED_BASELINE_BILLIONS, source: '2009 remarks', stated: true },
  ],
  deadlineCandidates: [
    { label: 'FY2012', x: 2012, source: 'strict end of term' },
    { label: 'FY2013', x: 2013, source: 'FY the term ended in' },
  ],
  targetRule: { kind: 'halve' },
  baselineAnchorX: 2009,
};

export const deficitTopic: Topic = {
  id: 'deficit',
  title: 'Federal deficit',
  subject: 'Federal deficit (USD billions)',
  comparator: 'lte',
  series,
  terms,
  bounds: {
    start: { min: 600, max: 1600 },
    end: { min: 2009, openEnded: true },
  },
  scopePresets: [
    { label: 'SCOPED · TERM ±1Y', xMin: 2007, xMax: 2014 },
    { label: 'OPEN · full range', xMin: 1997, xMax: 2017 },
  ],
  yScaleMode: 'locked',
  periodNote:
    'Term bands run inauguration to inauguration (about a third into the fiscal year) and deliberately do not align to fiscal-year boundaries. Attributing a fiscal year to a president is itself an ambiguity, not a fact.',
  formatValue: usd,
  formatX: fy,
  provenance: { dataAsOf, publisher, seriesId, sourceUrl, isBootstrap },
  promises: [obamaDeficit2009],
};

/** Build a chart claim from a topic and one of its promises. */
export function toClaim(topic: Topic, promise: PromiseSpec): ParametricTargetClaim {
  return {
    subject: topic.subject,
    series: topic.series,
    baselineCandidates: promise.baselineCandidates,
    deadlineCandidates: promise.deadlineCandidates,
    targetRule: promise.targetRule,
    comparator: topic.comparator,
    bounds: topic.bounds,
    scopePresets: topic.scopePresets,
    periods: topic.terms.map((t) => ({
      label: t.label,
      x0: inaugurationX(t.from),
      x1: inaugurationX(t.to),
    })),
    yScaleMode: topic.yScaleMode,
    baselineAnchorX: promise.baselineAnchorX,
    periodNote: topic.periodNote,
    formatValue: topic.formatValue,
    formatX: topic.formatX,
  };
}

/** Derive a reading for a promise on a topic, at chosen knob positions. */
export function readAt(
  topic: Topic,
  promise: PromiseSpec,
  baselineValue: number,
  deadlineX: number,
  deadlineLabel?: string,
): Derivation {
  return deriveVerdict({
    series: topic.series,
    baselineValue,
    deadlineX,
    deadlineLabel,
    targetRule: promise.targetRule,
    comparator: topic.comparator,
  });
}

export { usd as formatUSD, fy as formatFY };
