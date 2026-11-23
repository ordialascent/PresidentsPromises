import { describe, expect, it } from 'vitest';
import { percentShares, rowWidths } from '../src/promises/PromiseFunnel.js';

describe('funnel row widths', () => {
  it('percent: both rows fill the width; the fan starts where the checkable part ends', () => {
    expect(rowWidths('percent', 80, 40, 100)).toEqual({ top: 1, checkableEnd: 0.5, bottom: 1 });
  });

  it('count: one scale for both rows, so the verdicts sit exactly under the checkable part', () => {
    const w = rowWidths('count', 80, 40, 100);
    expect(w).toEqual({ top: 0.8, checkableEnd: 0.4, bottom: 0.4 });
    expect(w.bottom).toBe(w.checkableEnd);
  });

  it('a term with no promises draws nothing', () => {
    expect(rowWidths('count', 0, 0, 100)).toEqual({ top: 0, checkableEnd: 0, bottom: 0 });
    expect(rowWidths('percent', 0, 0, 100)).toEqual({ top: 0, checkableEnd: 0, bottom: 0 });
  });
});

describe('percentShares', () => {
  it('adds up to exactly 100 for every non-empty row', () => {
    for (const row of [[6, 26, 29], [1, 1, 1], [22, 1, 5, 0, 4, 0], [16, 1, 4, 0, 4, 27], [5]]) {
      expect(percentShares(row).reduce((a, b) => a + b, 0)).toBe(100);
    }
  });
  it('gives nothing to empty segments and keeps an empty row at zero', () => {
    expect(percentShares([3, 0, 1])).toEqual([75, 0, 25]);
    expect(percentShares([0, 0])).toEqual([0, 0]);
  });
});
