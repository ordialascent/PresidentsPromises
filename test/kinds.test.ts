import { describe, it, expect } from 'vitest';
import {
  CORPUS_AMBITION_COUNT,
  CORPUS_PROMISE_COUNT,
  CORPUS_TERMS,
} from '../src/content/promises.generated.js';
import { summarize, termsOfKind, verdictFor } from '../src/promises/model.js';

/**
 * Promises and ambitions. The board shows one kind at a time; these pin what it
 * draws from.
 */
describe('kinds', () => {
  const all = CORPUS_TERMS.flatMap((t) => [...t.promises, ...t.ambitions]);

  it('keeps promises and ambitions in separate lists', () => {
    for (const t of CORPUS_TERMS) {
      for (const p of t.promises) expect(p.kind).toBe('promise');
      for (const p of t.ambitions) expect(p.kind).toBe('ambition');
    }
    expect(CORPUS_TERMS.reduce((n, t) => n + t.ambitions.length, 0)).toBe(CORPUS_AMBITION_COUNT);
  });

  it('every record carries the protocol description', () => {
    for (const p of all) {
      const f = p.protocol;
      expect(['action', 'outcome', 'ongoing']).toContain(f.type);
      expect(f.deadline.applied).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(f.verifiability.level).toBe(p.quality);
      if (f.verifiability.level !== 'low') expect(f.verifiability.criterion).toBeTruthy();
      if (f.verifiability.level === 'medium') expect(f.verifiability.ambiguity).toBeTruthy();
    }
  });

  it('every link points at a record that exists', () => {
    const ids = new Set(all.map((p) => p.id));
    for (const p of all) for (const l of p.protocol.links) expect(ids.has(l.to)).toBe(true);
  });

  it('the ambition view puts ambitions in the promises slot and nothing else', () => {
    const amb = termsOfKind(CORPUS_TERMS, 'ambition');
    expect(termsOfKind(CORPUS_TERMS, 'promise')).toBe(CORPUS_TERMS);
    expect(summarize(amb).reduce((n, s) => n + s.total, 0)).toBe(CORPUS_AMBITION_COUNT);
    expect(summarize(CORPUS_TERMS).reduce((n, s) => n + s.total, 0)).toBe(CORPUS_PROMISE_COUNT);
  });

  it('ambitions never get a verdict; high and medium promises have one', () => {
    for (const p of all) {
      const v = verdictFor(p);
      if (p.kind === 'ambition') expect(v.tag).toBe('ambition');
      else if (p.quality !== 'low') expect(v.record).not.toBeNull();
      else expect(v.tag).toBe('infeasible');
    }
  });
});
