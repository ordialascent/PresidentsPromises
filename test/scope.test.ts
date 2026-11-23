import { describe, expect, it } from 'vitest';
import { CORPUS_TERMS } from '../src/content/promises.generated.js';
import {
  LATEST_TERMS,
  latestTermKeys,
  scopeFromParam,
  scopePreset,
  scopeSpan,
  scopeToParam,
} from '../src/promises/model.js';

const all = new Set(CORPUS_TERMS.map((t) => t.key));
const latest = latestTermKeys(CORPUS_TERMS);

describe('term scope', () => {
  it('defaults to the latest terms, newest included, oldest left out', () => {
    expect(latest.size).toBe(LATEST_TERMS);
    expect(latest.has(CORPUS_TERMS[CORPUS_TERMS.length - 1].key)).toBe(true);
    expect(latest.has(CORPUS_TERMS[0].key)).toBe(false);
    expect(scopePreset(latest, CORPUS_TERMS)).toBe('latest');
  });

  it('rolls forward when a term is added', () => {
    const next = { ...CORPUS_TERMS[CORPUS_TERMS.length - 1], key: 'next', from: 2029, to: 2033 };
    const grown = [...CORPUS_TERMS, next];
    const rolled = latestTermKeys(grown);
    expect(rolled.size).toBe(LATEST_TERMS);
    expect(rolled.has('next')).toBe(true);
    expect(rolled.has(CORPUS_TERMS[CORPUS_TERMS.length - LATEST_TERMS].key)).toBe(false);
  });

  it('names its presets and its span', () => {
    expect(scopePreset(all, CORPUS_TERMS)).toBe('all');
    expect(scopePreset(new Set([CORPUS_TERMS[0].key]), CORPUS_TERMS)).toBe('custom');
    const first = CORPUS_TERMS[0];
    const last = CORPUS_TERMS[CORPUS_TERMS.length - 1];
    expect(scopeSpan(all, CORPUS_TERMS)).toBe(`${first.from}–${last.to}`);
  });

  it('round-trips through the URL, and falls back to the default on nonsense', () => {
    expect(scopeToParam(latest, CORPUS_TERMS)).toBeNull();
    expect(scopeToParam(all, CORPUS_TERMS)).toBe('all');
    const two = new Set([CORPUS_TERMS[1].key, CORPUS_TERMS[3].key]);
    const param = scopeToParam(two, CORPUS_TERMS)!;
    expect(param).toBe(`${CORPUS_TERMS[1].from},${CORPUS_TERMS[3].from}`);
    expect(scopeFromParam(param, CORPUS_TERMS)).toEqual(two);
    expect(scopeFromParam('all', CORPUS_TERMS)).toEqual(all);
    expect(scopeFromParam('1066', CORPUS_TERMS)).toEqual(latest);
    expect(scopeFromParam(null, CORPUS_TERMS)).toEqual(latest);
  });
});
