import { describe, it, expect } from 'vitest';
import { CORPUS_PROMISE_COUNT, CORPUS_TERMS } from '../src/content/promises.generated.js';
import { fuzzyMatch, mergeIndices, nearestWord, toSpans, wordIndices } from '../src/promises/fuzzy.js';
import { searchPromises } from '../src/promises/search.js';
import {
  filterBySegment,
  flattenPromises,
  summarize,
  type CorpusPromise,
  type PromiseRow,
  type Quality,
} from '../src/promises/model.js';

/** The characters a match landed on, read back out of the haystack. */
const picked = (text: string, indices: readonly number[]) =>
  indices.map((i) => text[i]).join('');

describe('fuzzy matching', () => {
  it('matches a subsequence and reports where it landed', () => {
    const m = fuzzyMatch('tax', 'cut taxes')!;
    expect(m).not.toBeNull();
    expect(picked('cut taxes', m.indices)).toBe('tax');
    // the word itself, not scattered letters
    expect(m.indices).toEqual([4, 5, 6]);
  });

  it('is case-insensitive and matches an empty needle at zero', () => {
    expect(picked('Health Care', fuzzyMatch('HEALTH', 'Health Care')!.indices)).toBe('Health');
    expect(fuzzyMatch('', 'anything')).toEqual({ score: 0, indices: [] });
  });

  it('rejects characters that are absent or out of order', () => {
    expect(fuzzyMatch('xyz', 'cut taxes')).toBeNull();
    expect(fuzzyMatch('xat', 'cut taxes')).toBeNull();
    expect(fuzzyMatch('taxes', 'tax')).toBeNull();
  });

  it('forgives a typo, so the list keeps up with a reader mid-word', () => {
    const m = fuzzyMatch('helthcare', 'health care for every American')!;
    expect(m).not.toBeNull();
    expect(picked('health care for every American', m.indices)).toBe('helthcare');
  });

  it('scores a word the same wherever in the sentence it sits', () => {
    // only the alignment counts: the text before and after it is not a gap, or a
    // promise would rank by how much it says after the word the reader typed
    expect(fuzzyMatch('tax', 'cut taxes for working families and everyone else')!.score).toBe(
      fuzzyMatch('tax', 'cut taxes')!.score,
    );
    expect(fuzzyMatch('tax', 'raise taxes')!.score).toBe(fuzzyMatch('tax', 'taxes')!.score);
  });

  it('scores a tight, word-starting run above a scattered one', () => {
    const tight = fuzzyMatch('tax', 'cut taxes now')!.score;
    const scattered = fuzzyMatch('tax', 'the agreements we expect')!.score;
    expect(scattered).toBeGreaterThan(-Infinity); // it *is* a subsequence…
    expect(tight).toBeGreaterThan(scattered); // …and that is exactly why we score
  });

  it('takes the best alignment, not the first one greedily available', () => {
    // a greedy walk would spend the "t" on "the" and end up scattered
    const m = fuzzyMatch('tax', 'the tax cuts')!;
    expect(m.indices).toEqual([4, 5, 6]);
  });

  it('recognises a misspelled word, within a budget that scales with its length', () => {
    const near = nearestWord('edukation', 'Reform public education now')!;
    expect(near.distance).toBe(1);
    expect('Reform public education now'.slice(near.start, near.start + near.length)).toBe(
      'education',
    );
    expect(wordIndices(near)).toHaveLength(9);
    // two edits are allowed at nine characters…
    expect(nearestWord('edukatiom', 'Reform public education now')!.distance).toBe(2);
    // …and none at three, where an edit is simply a different word
    expect(nearestWord('tax', 'the cab fare')).toBeNull();
    expect(nearestWord('immigration', 'health care for all')).toBeNull();
  });

  it('merges runs and groups them into contiguous spans for rendering', () => {
    expect(mergeIndices([[3, 4], [0], [4]])).toEqual([0, 3, 4]);
    expect(toSpans([0, 3, 4])).toEqual([
      [0, 1],
      [3, 5],
    ]);
    expect(toSpans([])).toEqual([]);
  });
});

// A small hand-built corpus: real rows would tie every assertion to the
// extraction, and what is under test here is the ranking, not the promises.
function promise(
  id: string,
  theme: string,
  restatement: string,
  quality: Quality,
  quote: string,
): CorpusPromise {
  return {
    id,
    theme,
    restatement,
    quality,
    occurrences: [
      {
        ref: '¶1',
        quote,
        source: {
          kind: 'acceptance',
          medium: 'speech',
          speaker: 'Someone',
          event: 'Acceptance speech',
          year: 2008,
          date: '2008-08-28',
          publisher: 'The American Presidency Project',
          url: 'https://example.org',
          label: '2008 acceptance speech',
        },
      },
    ],
  };
}

function row(surname: string, year: number, p: CorpusPromise): PromiseRow {
  return {
    promise: p,
    termKey: `${year}-${surname}`,
    termLabel: `${surname} ${year}`,
    surname,
    speechYear: year,
  };
}

const ROWS: PromiseRow[] = [
  row('Obama', 2008, promise('a', 'taxes', 'Cut taxes for working families', 'partial', 'I will cut taxes for ninety-five percent of working families.')),
  row('Bush', 2000, promise('b', 'taxes', 'Return the surplus to taxpayers', 'partial', 'The surplus is the people’s money.')),
  row('Obama', 2008, promise('c', 'health', 'Guarantee health care coverage', 'no', 'We will keep the promise of affordable health care.')),
  row('Reagan', 1984, promise('d', 'defense', 'Rebuild the armed forces', 'no', 'Peace through strength, and a stronger military.')),
];

describe('promise search', () => {
  it('an empty query is not a filter — every row comes back, in order', () => {
    for (const q of ['', '   ']) {
      const hits = searchPromises(ROWS, q);
      expect(hits.map((h) => h.row.promise.id)).toEqual(['a', 'b', 'c', 'd']);
      for (const h of hits) {
        expect(h.score).toBe(0);
        expect(h.restatement).toEqual([]);
        expect(h.quoteOnly).toBe(false);
      }
    }
  });

  it('drops rows the query does not reach at all', () => {
    expect(searchPromises(ROWS, 'immigration')).toEqual([]);
  });

  it('several words are an AND across the row, not within one field', () => {
    // "obama" matches the president, "tax" the restatement — one row satisfies both
    const hits = searchPromises(ROWS, 'obama tax');
    expect(hits.map((h) => h.row.promise.id)).toEqual(['a']);
    // and a word no row can satisfy empties the result rather than being ignored
    expect(searchPromises(ROWS, 'obama zeppelin')).toEqual([]);
  });

  it('highlights the characters it matched, in the field it matched them in', () => {
    const [hit] = searchPromises(ROWS, 'health');
    expect(hit!.row.promise.id).toBe('c');
    expect(picked(hit!.row.promise.theme, hit!.theme)).toBe('health');
    expect(picked(hit!.row.promise.restatement, hit!.restatement)).toBe('health');
    const [who] = searchPromises(ROWS, 'reagan');
    expect(picked('Reagan 1984', who!.who)).toBe('Reagan');
  });

  it('finds a phrase that only ever appears in the quote, and says so', () => {
    const hits = searchPromises(ROWS, 'ninety-five');
    expect(hits.map((h) => h.row.promise.id)).toEqual(['a']);
    expect(hits[0]!.quoteOnly).toBe(true);
    // the quotes are matched literally: a subsequence of a long speech is noise
    expect(searchPromises(ROWS, 'nnnnnnnnnn')).toEqual([]);
  });

  it('drops a match whose letters are merely scattered across the sentence', () => {
    // "helthcare" *is* a subsequence of the defense row ("t-h-e mi-l-i-t…"), and
    // listing it would be noise; it is a real match of the health row, where it
    // stays inside one phrase even though it crosses a space
    const hits = searchPromises(ROWS, 'helthcare');
    expect(hits.map((h) => h.row.promise.id)).toEqual(['c']);
    // and the gate is about spread, not length: a short word still has to land
    expect(searchPromises(ROWS, 'tax').map((h) => h.row.promise.id)).toEqual(['a', 'b']);
  });

  it('finds a promise through a mistyped letter, under the ones spelled right', () => {
    // "covrrage" is not a subsequence of "coverage" — the second r is not in
    // there — so only the near-word pass can reach it
    const typo = searchPromises(ROWS, 'covrrage');
    expect(typo.map((h) => h.row.promise.id)).toEqual(['c']);
    // the highlight covers the word that was meant, not the letters that landed
    expect(picked(ROWS[2]!.promise.restatement, typo[0]!.restatement)).toBe('coverage');
    // and a guess at the reader's meaning ranks under what the reader typed
    const spelled = searchPromises(ROWS, 'coverage');
    expect(spelled[0]!.score).toBeGreaterThan(typo[0]!.score);
  });

  it('ranks the promise that is about the query above one that merely mentions it', () => {
    const hits = searchPromises(ROWS, 'taxes');
    // both tax rows match; the one whose *restatement* says it comes first
    expect(hits.map((h) => h.row.promise.id)).toEqual(['a', 'b']);
    expect(hits[0]!.score).toBeGreaterThan(hits[1]!.score);
    expect(hits[1]!.quoteOnly).toBe(false); // "taxpayers" is a restatement hit
  });

  it('equal scores keep corpus order, so typing does not shuffle the list', () => {
    const hits = searchPromises(ROWS, 'obama');
    expect(hits.map((h) => h.row.promise.id)).toEqual(['a', 'c']);
    expect(hits[0]!.score).toBe(hits[1]!.score);
  });

  it('searches the whole corpus without ever inventing or losing a row', () => {
    const rows = flattenPromises(CORPUS_TERMS);
    expect(rows.length).toBe(CORPUS_PROMISE_COUNT);
    expect(searchPromises(rows, '').length).toBe(CORPUS_PROMISE_COUNT);

    const ids = new Set(rows.map((r) => r.promise.id));
    const hits = searchPromises(rows, 'health');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThan(CORPUS_PROMISE_COUNT);
    for (const h of hits) expect(ids.has(h.row.promise.id)).toBe(true);
    // every promise on the health topic is in there somewhere
    const onTopic = rows.filter((r) => r.promise.theme === 'health').map((r) => r.promise.id);
    const found = new Set(hits.map((h) => h.row.promise.id));
    for (const id of onTopic) expect(found.has(id)).toBe(true);

    expect(searchPromises(rows, 'qqqzzzjjj')).toEqual([]);
  });
});

describe('the promise list under the chart', () => {
  it('flattens to one row per promise, carrying the president along', () => {
    const rows = flattenPromises(CORPUS_TERMS);
    expect(rows.length).toBe(CORPUS_PROMISE_COUNT);
    const keys = new Set(CORPUS_TERMS.map((t) => t.key));
    for (const r of rows) expect(keys.has(r.termKey)).toBe(true);
    // chronological, because the corpus is: the terms come out in term order
    const first = CORPUS_TERMS[0]!;
    expect(rows.slice(0, first.promises.length).every((r) => r.termKey === first.key)).toBe(true);
  });

  it('a bar block is exactly one president crossed with one tier', () => {
    const rows = flattenPromises(CORPUS_TERMS);
    const term = CORPUS_TERMS.find((t) => t.promises.some((p) => p.quality === 'partial'))!;
    const segment = { termKey: term.key, quality: 'partial' as Quality };
    const inBlock = filterBySegment(rows, segment);
    for (const r of inBlock) {
      expect(r.termKey).toBe(term.key);
      expect(r.promise.quality).toBe('partial');
    }
    // and it is the number the block itself draws
    const summary = summarize(CORPUS_TERMS).find((s) => s.key === term.key)!;
    expect(inBlock.length).toBe(summary.counts.partial);
    // no block picked is no filter
    expect(filterBySegment(rows, null)).toBe(rows);
  });
});
