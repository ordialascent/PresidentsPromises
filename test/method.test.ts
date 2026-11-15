import { describe, it, expect } from 'vitest';
import { CORPUS_AMBITION_COUNT, CORPUS_PROMISE_COUNT, CORPUS_TERMS } from '../src/content/promises.generated.js';
import { methodRows } from '../src/promises/model.js';
import { THEMES, DECISIONS } from '../scripts/validate-corpus.mjs';
import { EXCLUSIONS, THEMES as PAGE_THEMES } from '../src/pages/method.js';

/** The methodology page's numbers are computed, so they must agree with the board. */
describe('methodology page', () => {
  const rows = methodRows(CORPUS_TERMS);

  it('has one row per term, and its totals match the board', () => {
    expect(rows.map((r) => r.key)).toEqual(CORPUS_TERMS.map((t) => t.key));
    expect(rows.reduce((n, r) => n + r.promises, 0)).toBe(CORPUS_PROMISE_COUNT);
    expect(rows.reduce((n, r) => n + r.ambitions, 0)).toBe(CORPUS_AMBITION_COUNT);
    for (const r of rows) {
      expect(r.tiers.high + r.tiers.medium + r.tiers.low).toBe(r.promises);
      expect(r.included + r.excluded).toBe(r.screened);
      expect(r.excludedBy.reduce((n, [, c]) => n + c, 0)).toBe(r.excluded);
      // every term is screened, and every included sentence yields at least one record
      expect(r.screened).toBeGreaterThan(0);
      expect(r.included).toBeGreaterThan(0);
    }
  });

  it('counts every ledger decision the validator knows, and no other', () => {
    for (const t of CORPUS_TERMS) expect(Object.keys(t.screening).sort()).toEqual([...DECISIONS].sort());
  });

  it('lists the protocol’s topics and exclusion reasons', () => {
    expect(PAGE_THEMES).toEqual(THEMES);
    expect(EXCLUSIONS.map(([code]) => code)).toEqual(DECISIONS.filter((d) => d !== 'include'));
  });
});
