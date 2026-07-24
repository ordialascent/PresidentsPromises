import { describe, it, expect } from 'vitest';
import {
  RECORDED_FY2009_BILLIONS,
  STATED_BASELINE_BILLIONS,
  deficitTopic,
  readAt,
  toDeficitBillions,
} from '../src/content/deficit.js';

/**
 * The grid the product refuses to collapse, pinned against the committed
 * snapshot. Outcomes are asserted exactly (robust to small revisions); the
 * single met margin is asserted within a tolerant band so the first real FRED
 * refresh, which supersedes the bootstrap values, cannot break this test.
 */
describe('the deficit topic, Obama 2009 promise', () => {
  const promise = deficitTopic.promises[0]!;
  const cell = (baselineValue: number, deadlineX: number) =>
    readAt(deficitTopic, promise, baselineValue, deadlineX).outcome;
  const read = (baselineValue: number, deadlineX: number) =>
    readAt(deficitTopic, promise, baselineValue, deadlineX);

  it('sign/units transform: FYFSD negative millions -> positive billions of deficit', () => {
    expect(toDeficitBillions(-1412688)).toBeCloseTo(1412.688, 3);
    expect(toDeficitBillions(236241)).toBeCloseTo(-236.241, 3); // a surplus reads negative
  });

  it('targets derive by halving the chosen baseline', () => {
    expect(read(STATED_BASELINE_BILLIONS, 2012).target).toBe(650);
    expect(read(RECORDED_FY2009_BILLIONS, 2013).target).toBeCloseTo(RECORDED_FY2009_BILLIONS / 2, 6);
  });

  it('stated $1.30T baseline (target $650B) misses at both deadlines', () => {
    expect(cell(STATED_BASELINE_BILLIONS, 2012)).toBe('missed');
    expect(cell(STATED_BASELINE_BILLIONS, 2013)).toBe('missed');
  });

  it('recorded FY2009 baseline misses at FY2012 but meets at FY2013', () => {
    expect(cell(RECORDED_FY2009_BILLIONS, 2012)).toBe('missed');
    expect(cell(RECORDED_FY2009_BILLIONS, 2013)).toBe('met');
  });

  it('exactly three readings miss and one is met, across the promise candidates', () => {
    const outcomes = promise.baselineCandidates.flatMap((b) =>
      promise.deadlineCandidates.map((d) => cell(b.value, d.x)),
    );
    expect(outcomes.filter((o) => o === 'missed')).toHaveLength(3);
    expect(outcomes.filter((o) => o === 'met')).toHaveLength(1);
  });

  it('the single met cell is (recorded FY2009 baseline, FY2013 deadline), by a hair', () => {
    const met = read(RECORDED_FY2009_BILLIONS, 2013);
    expect(met.outcome).toBe('met');
    expect(met.distanceWord).toBe('under');
    expect(met.distance).toBeGreaterThan(0);
    expect(met.distance).toBeLessThan(60);
  });

  it('the reading is derived, never supplied: a missing observation is indeterminate', () => {
    expect(cell(RECORDED_FY2009_BILLIONS, 2099)).toBe('indeterminate');
  });
});
