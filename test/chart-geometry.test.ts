import { describe, expect, it } from 'vitest';
import { geometry } from '../src/promises/PromisesChart.js';

describe('chart geometry', () => {
  it('fills a wide container without scrolling', () => {
    const g = geometry(860, 8);
    expect(g.width).toBeCloseTo(860);
    expect(g.barW).toBe(67);
  });

  it('keeps a readable column on a phone and scrolls instead of shrinking', () => {
    const g = geometry(358, 8);
    expect(g.step).toBe(64);
    expect(g.width).toBe(512);
    expect(g.barW).toBeLessThan(g.step);
  });

  it('never lets bars overlap, even with many terms', () => {
    for (const n of [1, 8, 13, 20]) {
      for (const w of [320, 390, 860]) {
        const g = geometry(w, n);
        expect(g.barW).toBeLessThanOrEqual(84);
        expect(g.step - g.barW).toBeGreaterThanOrEqual(24);
      }
    }
  });
});
