import { describe, it, expect } from 'vitest';
import {
  CORPUS_AMBITION_COUNT,
  CORPUS_PROMISE_COUNT,
  CORPUS_TERMS,
} from '../src/content/promises.generated.js';
import { summarize, termsOfKind, verdictFor } from '../src/promises/model.js';

/**
 * Promises and ambitions, and the two extraction methods. The board shows one
 * kind at a time and labels every legacy term; these pin what it draws from.
 */
describe('kinds and methods', () => {
  const all = CORPUS_TERMS.flatMap((t) => [...t.promises, ...t.ambitions]);

  it('every term says which method produced it, and its records agree', () => {
    for (const t of CORPUS_TERMS) {
      expect(['protocol', 'legacy']).toContain(t.method);
      for (const p of [...t.promises, ...t.ambitions]) expect(p.method).toBe(t.method);
    }
  });

  it('keeps promises and ambitions in separate lists', () => {
    for (const t of CORPUS_TERMS) {
      for (const p of t.promises) expect(p.kind).toBe('promise');
      for (const p of t.ambitions) expect(p.kind).toBe('ambition');
    }
    expect(CORPUS_TERMS.reduce((n, t) => n + t.ambitions.length, 0)).toBe(CORPUS_AMBITION_COUNT);
  });

  it('legacy terms have no ambitions and no protocol fields', () => {
    for (const t of CORPUS_TERMS.filter((x) => x.method === 'legacy')) {
      expect(t.ambitions).toEqual([]);
      for (const p of t.promises) expect(p.protocol).toBeUndefined();
    }
  });

  it('re-extracted records carry the protocol description', () => {
    for (const p of all.filter((x) => x.method === 'protocol')) {
      expect(p.protocol).toBeDefined();
      const f = p.protocol!;
      expect(['action', 'outcome', 'ongoing']).toContain(f.type);
      expect(f.deadline.applied).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect({ high: 'full', medium: 'partial', low: 'no' }[f.verifiability.level]).toBe(p.quality);
      if (f.verifiability.level !== 'low') expect(f.verifiability.criterion).toBeTruthy();
      if (f.verifiability.level === 'medium') expect(f.verifiability.ambiguity).toBeTruthy();
    }
  });

  it('every link points at a record that exists', () => {
    const ids = new Set(all.map((p) => p.id));
    for (const p of all) for (const l of p.protocol?.links ?? []) expect(ids.has(l.to)).toBe(true);
  });

  it('the ambition view puts ambitions in the promises slot and nothing else', () => {
    const amb = termsOfKind(CORPUS_TERMS, 'ambition');
    expect(termsOfKind(CORPUS_TERMS, 'promise')).toBe(CORPUS_TERMS);
    expect(summarize(amb).reduce((n, s) => n + s.total, 0)).toBe(CORPUS_AMBITION_COUNT);
    expect(summarize(CORPUS_TERMS).reduce((n, s) => n + s.total, 0)).toBe(CORPUS_PROMISE_COUNT);
  });

  it('ambitions never wait for a verdict; re-extracted medium promises do', () => {
    for (const p of all) {
      const v = verdictFor(p);
      if (p.kind === 'ambition') expect(v.tag).toBe('ambition');
      else if (p.method === 'protocol' && p.quality !== 'no') expect(v.tag).toBe('pending');
      else if (p.method === 'protocol') expect(v.tag).toBe('infeasible');
    }
  });
});
