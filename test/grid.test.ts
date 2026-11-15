import { describe, it, expect } from 'vitest';
import { deficitTopic, readAt, toDeficitBillions } from '../src/content/deficit.js';
import type { PromiseSpec } from '../src/content/types.js';
import { currentRows } from '../src/data/snapshot.js';

/**
 * The reading engine, pinned against the committed FYFSD snapshot. The fixture
 * is a synthetic "halve the deficit" target, not anyone's promise: real
 * promises reach the topic only from the corpus. Outcomes are asserted exactly
 * (robust to small revisions); margins sit in tolerant bands so a refresh that
 * revises a figure cannot break this test.
 */
const recordedFY2009 = toDeficitBillions(currentRows.find((r) => r.fy === 2009)!.valueRawMusd);

const fixture: PromiseSpec = {
  id: 'fixture-halve-from-fy2009',
  who: 'Test fixture',
  quote: 'halve the FY2009 deficit',
  occasion: 'test',
  date: 'n/a',
  baselineCandidates: [
    { label: 'recorded FY2009', value: recordedFY2009, x: 2009, stated: false },
    { label: 'stated $1.30T', value: 1300, stated: true },
  ],
  deadlineCandidates: [
    { label: 'FY2012', x: 2012 },
    { label: 'FY2013', x: 2013 },
  ],
  targetRule: { kind: 'halve' },
};

const read = (baselineValue: number, deadlineX: number) =>
  readAt(deficitTopic, fixture, baselineValue, deadlineX);
const cell = (baselineValue: number, deadlineX: number) => read(baselineValue, deadlineX).outcome;

describe('the deficit topic', () => {
  it('holds no promise from outside the corpus', () => {
    expect(deficitTopic.promises).toHaveLength(0);
  });

  it('sign/units transform: FYFSD negative millions -> positive billions of deficit', () => {
    expect(toDeficitBillions(-1412688)).toBeCloseTo(1412.688, 3);
    expect(toDeficitBillions(236241)).toBeCloseTo(-236.241, 3); // a surplus reads negative
  });

  it('every term in the corpus has a band, inauguration to inauguration', () => {
    expect(deficitTopic.terms.map((t) => t.from)).toEqual([1997, 2001, 2005, 2009, 2013, 2017, 2021, 2025]);
    for (let i = 1; i < deficitTopic.terms.length; i += 1) {
      expect(deficitTopic.terms[i]!.from).toBe(deficitTopic.terms[i - 1]!.to);
    }
  });
});

describe('the reading engine, on a halving target', () => {
  it('targets derive by halving the chosen baseline', () => {
    expect(read(1300, 2012).target).toBe(650);
    expect(read(recordedFY2009, 2013).target).toBeCloseTo(recordedFY2009 / 2, 6);
  });

  it('the stated baseline (target $650B) misses at both deadlines', () => {
    expect(cell(1300, 2012)).toBe('missed');
    expect(cell(1300, 2013)).toBe('missed');
  });

  it('the recorded baseline misses at FY2012 but is met at FY2013, by a hair', () => {
    expect(cell(recordedFY2009, 2012)).toBe('missed');
    const met = read(recordedFY2009, 2013);
    expect(met.outcome).toBe('met');
    expect(met.distanceWord).toBe('under');
    expect(met.distance).toBeGreaterThan(0);
    expect(met.distance).toBeLessThan(60);
  });

  it('the reading is derived, never supplied: a missing observation is indeterminate', () => {
    expect(cell(recordedFY2009, 2099)).toBe('indeterminate');
  });
});
