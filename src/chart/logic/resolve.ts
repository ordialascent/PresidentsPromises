import type { ScopePreset, SeriesPoint, YScaleMode } from '../types.js';

const EPS = 1e-9;

/**
 * Read the observed value at an evaluation point. Returns null when the series
 * carries no measurement there — that absence is a first-class outcome
 * (indeterminate), not something to paper over by interpolating.
 */
export function observedAt(series: SeriesPoint[], x: number): number | null {
  let best: SeriesPoint | null = null;
  for (const p of series) {
    if (Math.abs(p.x - x) <= EPS) {
      if (best === null) best = p;
    }
  }
  return best ? best.y : null;
}

export function pointsInWindow(series: SeriesPoint[], win: ScopePreset): SeriesPoint[] {
  return series.filter((p) => p.x >= win.xMin - EPS && p.x <= win.xMax + EPS);
}

/**
 * Compute the y domain. `locked` derives it from the default window and keeps
 * it there even when a wider window is selected, so unrelated later events do
 * not squash the span in question. `auto` refits to the current window.
 * Extra values (baseline, target, observed) are always folded in so the marks
 * stay on screen.
 */
export function yDomain(
  series: SeriesPoint[],
  currentWindow: ScopePreset,
  defaultWindow: ScopePreset,
  mode: YScaleMode,
  extra: number[] = [],
): [number, number] {
  const source = mode === 'locked' ? defaultWindow : currentWindow;
  const ys = pointsInWindow(series, source).map((p) => p.y);
  const values = [...ys, ...extra].filter((v) => Number.isFinite(v));
  if (values.length === 0) return [0, 1];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    const pad = Math.abs(min) || 1;
    return [min - pad, max + pad];
  }
  const pad = (max - min) * 0.08;
  return [min - pad, max + pad];
}
