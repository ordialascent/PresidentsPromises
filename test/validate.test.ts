import { describe, it, expect } from 'vitest';
import {
  parseSource,
  quoteFits,
  resolveRef,
  triggerOf,
  validateCorpus,
  validateTerm,
} from '../scripts/validate-corpus.mjs';

/**
 * The corpus validator (corpus/PROTOCOL.md, "Checks"). Each rule is pinned on a
 * small fixture term, then the real corpus is required to pass.
 */

const speech = `---
name: Test President
title: 'Inaugural Address'
type: speech
date_published: 2001-01-20
source_url: https://example.org/inaugural
---

## ¶1
1. Thank you all.
2. We will cut taxes for every family.

## ¶2
1. We must reform the schools.
2. The story goes on.
3. And we’ll build roads and bridges across the land.
`;

const debate = `---
name: Test President
title: 'Final Debate'
type: debate
date_published: 2000-10-17
source_url: https://example.org/debate
speaker_label: SMITH
---

## ¶1 — MODERATOR
1. I will ask the first question.

## ¶2 — SMITH
1. I will balance the budget.

## ¶3 — JONES
1. I will do the opposite.
`;

const ledger = `source: 2001-inaugural
protocol: 1
rows:
  - { ref: "¶1.2", decision: include, promises: [t-cut-taxes] }
  - { ref: "¶2.1", decision: include, promises: [t-reform-schools] }
  - { ref: "¶2.3", decision: include, promises: [t-build-roads] }
`;

const debateLedger = `source: 2000-debate
protocol: 1
rows:
  - { ref: "¶2.1", decision: include, promises: [t-balance-budget] }
`;

const record = (id: string, kind: string, inKind: string, ref: string, quote: string) => `
  - id: ${id}
    kind: ${kind}
    sources:
      - in: ${inKind}
        ref: "${ref}"
        quote: ${quote}
    restatement: ${id}.
    type: action
    theme: taxes
    deadline: { stated: null, applied: 2005-01-20 }
    verifiability:
      level: low
    uncertainty: { extraction: clear }
    links: []`;

const promises = `protocol: 1
promises:${record('t-cut-taxes', 'promise', 'inaugural', '¶1.2', 'We will cut taxes for every family.')}${record('t-reform-schools', 'ambition', 'inaugural', '¶2.1', 'We must reform the schools.')}${record('t-build-roads', 'promise', 'inaugural', '¶2.3', 'build roads and bridges')}${record('t-balance-budget', 'promise', 'debate', '¶2.1', 'I will balance the budget.')}
`;

const term = (over: Record<string, string | undefined> = {}) => {
  const files: Record<string, string> = {
    '2001-inaugural.md': speech,
    '2001-inaugural.screening.yaml': ledger,
    '2000-debate.md': debate,
    '2000-debate.screening.yaml': debateLedger,
    'promises.yaml': promises,
  };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) delete files[k];
    else files[k] = v;
  }
  return validateTerm('T', files);
};
const errorsOf = (over: Record<string, string | undefined> = {}) => term(over).errors.join('\n');

describe('source parsing and refs', () => {
  const src = parseSource(speech);
  it('reads paragraphs, sentences and speakers', () => {
    expect(src.fm.name).toBe('Test President');
    expect(src.paragraphs.get(2)?.sentences).toHaveLength(3);
    expect(parseSource(debate).paragraphs.get(2)?.speaker).toBe('SMITH');
  });
  it('resolves single, ranged and cross-paragraph refs', () => {
    expect(resolveRef(src, '¶1.2').text).toBe('We will cut taxes for every family.');
    expect(resolveRef(src, '¶2.1-2.2').sentences).toHaveLength(2);
    expect(resolveRef(src, '¶1.2-2.1').sentences?.map((x) => `${x.p}.${x.s}`)).toEqual(['1.2', '2.1']);
  });
  it('rejects malformed, missing and backwards refs', () => {
    expect(resolveRef(src, '1.2').error).toMatch(/malformed/);
    expect(resolveRef(src, '¶9.1').error).toMatch(/no paragraph/);
    expect(resolveRef(src, '¶1.5').error).toMatch(/no sentence/);
    expect(resolveRef(src, '¶2.3-2.1').error).toMatch(/backwards/);
  });
  it('accepts only exact, contiguous quotes', () => {
    const span = 'We will cut taxes   for every family.';
    expect(quoteFits('cut taxes for every', span)).toBe(true);
    expect(quoteFits('We will cut taxes [...] family.', span)).toBe(false);
    expect(quoteFits('', span)).toBe(false);
  });
});

describe('trigger lexicon', () => {
  it('matches firm and soft phrases as whole words, any case or apostrophe', () => {
    expect(triggerOf('And we’ll build roads.')).toBe("we'll");
    expect(triggerOf('WE MUST act.')).toBe('WE MUST');
    expect(triggerOf('As president, I will act.')).toBe('As president, I');
    expect(triggerOf('Their commitments matter.')).toBeNull();
    expect(triggerOf('The story goes on.')).toBeNull();
  });

  it('matches spoken negations, contractions and wishes with an object', () => {
    expect(triggerOf("I'm not going to grow the government.")).toBe("I'm not going to");
    expect(triggerOf("And you bet we're gonna take a trillion dollars.")).toBe("we're gonna");
    expect(triggerOf('But I want a diverse administration.')).toBe('I want');
    expect(triggerOf('There ought to be filters in public libraries.')).toBe('There ought to be');
    expect(triggerOf('I support a bill of rights.')).toBeNull();
  });
});

describe('validateTerm', () => {
  it('passes a consistent re-extracted term', () => {
    expect(term()).toEqual({ errors: [], warnings: [] });
  });

  it('fails when a trigger-matched sentence has no ledger row', () => {
    const l = ledger.replace(/.*¶2\.3.*\n/, '');
    expect(errorsOf({ '2001-inaugural.screening.yaml': l })).toMatch(/¶2\.3 matches "we'll" but has no ledger row/);
  });

  it('screens only the president’s turns in a debate', () => {
    // ¶1 (moderator) and ¶3 (opponent) match "I will" but need no row.
    expect(errorsOf()).not.toMatch(/2000-debate/);
    const outside = debateLedger.replace('¶2.1', '¶3.1');
    expect(errorsOf({ '2000-debate.screening.yaml': outside })).toMatch(/outside the turns of "SMITH"/);
  });

  it('requires a speaker_label on debates', () => {
    expect(errorsOf({ '2000-debate.md': debate.replace('speaker_label: SMITH\n', '') })).toMatch(/speaker_label/);
  });

  it('rejects overlapping rows and include rows without promises', () => {
    const overlap = ledger + '  - { ref: "¶1.1-1.2", decision: ceremony }\n';
    expect(errorsOf({ '2001-inaugural.screening.yaml': overlap })).toMatch(/already covered/);
    const empty = ledger.replace('promises: [t-build-roads] ', '');
    expect(errorsOf({ '2001-inaugural.screening.yaml': empty })).toMatch(/must list its promises/);
  });

  it('cross-checks ledger rows against promises, both ways', () => {
    const unknown = ledger.replace('t-build-roads', 't-nope');
    const out = errorsOf({ '2001-inaugural.screening.yaml': unknown });
    expect(out).toMatch(/unknown promise "t-nope"/);
    expect(out).toMatch(/t-build-roads: inaugural ¶2\.3 has no include row/);
  });

  it('requires a ledger for every source of a re-extracted term', () => {
    expect(errorsOf({ '2000-debate.screening.yaml': undefined })).toMatch(/needs a screening ledger/);
  });

  it('enforces the protocol-1 record schema', () => {
    const p = (from: string, to: string) => errorsOf({ 'promises.yaml': promises.replace(from, to) });
    expect(p('theme: taxes', 'theme: fiscal')).toMatch(/theme "fiscal" is not in the list/);
    expect(p('kind: promise', 'kind: pledge')).toMatch(/kind must be/);
    expect(p('applied: 2005-01-20', 'applied: soon')).toMatch(/deadline.applied/);
    expect(p('level: low', 'level: medium')).toMatch(/needs verifiability.criterion/);
    expect(p('level: low', 'level: medium')).toMatch(/needs verifiability.ambiguity/);
    expect(p('{ extraction: clear }', '{ extraction: contested }')).toMatch(/needs a note/);
    expect(p('links: []', 'links: [{ kind: repeats, to: t-gone }]')).toMatch(/unknown promise "t-gone"/);
    expect(p('id: t-build-roads', 'id: t-cut-taxes')).toMatch(/duplicate id/);
    expect(p('quote: build roads and bridges', 'quote: build roads [...] bridges')).toMatch(/not a contiguous part/);
  });

  it('rejects a promises.yaml that does not declare the protocol', () => {
    const old = `promises:
  - id: t-old
    ref: "¶1.2"
    quote: We will cut taxes for every family.
`;
    const r = validateTerm('T', { '2001-acceptance.md': speech, 'promises.yaml': old });
    expect(r.errors.join()).toMatch(/must declare `protocol: 1`/);
  });
});

describe('verdicts (PROTOCOL.md §6)', () => {
  // t-cut-taxes becomes a high promise; the other fixtures stay low.
  const highPromises = promises.replace(
    'level: low',
    'level: high\n      object: taxes\n      record: tax law\n      criterion: a tax cut is enacted',
  );
  const verdicts = `protocol: 1
verdicts:
  - promise: t-cut-taxes
    verdict: broken
    as_of: 2026-11-15
    summary: No tax cut was enacted.
    attempt: initiated
    evidence:
      - { what: Budget proposal, url: "https://example.org/budget", publisher: Treasury }
    uncertainty: { verdict: clear }
`;
  const v = (from: string | RegExp = '', to = '') =>
    term({ 'promises.yaml': highPromises, 'verdicts.yaml': verdicts.replace(from, to) });

  it('passes a complete, consistent verdict file', () => {
    expect(v()).toEqual({ errors: [], warnings: [] });
  });

  it('warns about verifiable promises without a verdict', () => {
    const r = term({ 'promises.yaml': highPromises, 'verdicts.yaml': 'protocol: 1\nverdicts: []\n' });
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toMatch(/1 high\/medium promises have no verdict/);
  });

  it('judges only high and medium promises, once each', () => {
    expect(v('promise: t-cut-taxes', 'promise: t-build-roads').errors.join()).toMatch(/only high and medium/);
    expect(v('promise: t-cut-taxes', 'promise: t-reform-schools').errors.join()).toMatch(/ambitions never/);
    expect(v('promise: t-cut-taxes', 'promise: t-nope').errors.join()).toMatch(/names no promise/);
    const twice = verdicts + verdicts.split('verdicts:\n')[1];
    expect(term({ 'promises.yaml': highPromises, 'verdicts.yaml': twice }).errors.join()).toMatch(/second verdict/);
  });

  it('enforces the verdict record', () => {
    const e = (from: string | RegExp, to: string) => v(from, to).errors.join('\n');
    expect(e('verdict: broken', 'verdict: meh')).toMatch(/verdict must be one of/);
    expect(e('    attempt: initiated\n', '')).toMatch(/broken verdict needs attempt/);
    expect(e('https://example.org/budget', 'example.org')).toMatch(/needs an https url/);
    expect(e(/ {4}evidence:\n.*\n/, '')).toMatch(/needs evidence/);
    expect(e('{ verdict: clear }', '{ verdict: probable }')).toMatch(/needs a note/);
    expect(e('verdict: broken', 'verdict: pending')).toMatch(/pending, but the deadline 2005-01-20 has passed/);
    expect(e('    attempt: initiated\n', "    attempt: initiated\n    review: ''\n")).toMatch(/review must say/);
    expect(v('    attempt: initiated\n', '    attempt: initiated\n    review: Confirm the budget figure.\n').errors).toEqual([]);
  });
});

describe('the corpus', () => {
  it('passes the validator', () => {
    const r = validateCorpus(decodeURIComponent(new URL('../corpus', import.meta.url).pathname));
    expect(r.terms).toBe(9);
    expect(r.errors).toEqual([]);
  });
});
