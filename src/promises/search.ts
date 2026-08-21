import { fuzzyMatch, mergeIndices, nearestWord, wordIndices } from './fuzzy.js';
import type { PromiseRow } from './model.js';

/**
 * Free-text search over the promise list: fuzzy on the short fields a reader
 * types from memory (topic, restatement, president), literal on the quotes.
 *
 * The split is deliberate. A subsequence match is the right forgiveness for
 * "helthcare" or "afgan" against a one-line restatement, and exactly the wrong
 * thing against a 200-word quote, where the needle's characters are certain to
 * appear in order somewhere and every promise would match everything. So quotes
 * are searched for the literal string only — a quote hit means the words really
 * are in the speech.
 */

/** The searchable fields of a promise row. */
export type Field = 'theme' | 'restatement' | 'who' | 'quote';

/**
 * How much a hit in each field is worth. A topic match is the most deliberate
 * thing a reader can type, and a quote match the least specific — it is a hint
 * that the words occur somewhere in a speech, so it ranks last without being
 * dropped.
 */
const WEIGHT: Record<Field, number> = {
  theme: 1.15,
  restatement: 1,
  who: 1.05,
  quote: 0.55,
};

/** A literal quote hit scores per character matched — no alignment to score. */
const QUOTE_PER_CHAR = 7;

/**
 * A word recognised through a misspelling, per character, divided by how many
 * edits it took. Deliberately far below what a real match earns (about 30 a
 * character): a guess at what the reader meant belongs under everything the
 * reader actually typed.
 */
const MISSPELLED_PER_CHAR = 8;

/**
 * What a word is worth in the fields it matched *besides* its best one. The
 * strongest field sets the score; the rest only corroborate, because a promise
 * whose topic and wording both say "taxes" is more about taxes than one where
 * only the topic does — but not twice as much, which is what full credit for
 * every field would claim.
 */
const CORROBORATION = 0.25;

/**
 * How far a word's characters may be spread before the match stops being a
 * match. Scoring alone ranks the junk last but still lists it: "helthcare" is a
 * subsequence of "t**h**e military th**e** resources", and no reader typing
 * that word wants to be shown it. A real hit — even one crossing a space, as
 * "helthcare" does in "health care" — stays close to its own length; a
 * coincidence sprawls across the sentence. Anything spread wider than this is
 * dropped outright.
 */
function tight(indices: readonly number[], needle: number): boolean {
  if (indices.length < 2) return true;
  const span = indices[indices.length - 1]! - indices[0]! + 1;
  return span <= needle * 2 + 4;
}

export interface PromiseHit {
  row: PromiseRow;
  score: number;
  /** Highlight indices per field, for the fields the list renders. */
  theme: number[];
  restatement: number[];
  who: number[];
  /** The query was only found inside the quotes — worth saying in the row. */
  quoteOnly: boolean;
}

/** The president as a searchable string: "Obama 2008" reaches both halves. */
function whoText(row: PromiseRow): string {
  return row.speechYear == null ? row.surname : `${row.surname} ${row.speechYear}`;
}

function unranked(rows: PromiseRow[]): PromiseHit[] {
  return rows.map((row) => ({
    row,
    score: 0,
    theme: [],
    restatement: [],
    who: [],
    quoteOnly: false,
  }));
}

/**
 * Rank `rows` against `query`. An empty query is not a filter: every row comes
 * back, in the order given, so clearing the box restores the full list rather
 * than an empty one.
 *
 * Multi-word queries are an AND across the row, not across a field: "obama tax"
 * keeps a promise whose president matches one word and whose text matches the
 * other. Each word is scored where it does best, and the row's score is the sum,
 * so a row that answers the whole query outranks one that answers half of it
 * twice.
 */
export function searchPromises(rows: PromiseRow[], query: string): PromiseHit[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return unranked(rows);

  const hits: PromiseHit[] = [];
  for (const row of rows) {
    const { theme, restatement } = row.promise;
    const who = whoText(row);
    const quotes = row.promise.occurrences.map((o) => o.quote.toLowerCase());

    let score = 0;
    let matchedOutsideQuotes = false;
    const runs: Record<'theme' | 'restatement' | 'who', number[][]> = {
      theme: [],
      restatement: [],
      who: [],
    };
    let all = true;

    for (const token of tokens) {
      // Every field the word reaches, not just the best one: the score comes
      // from the best, but the *highlights* have to come from all of them, or a
      // word found through the topic goes unmarked in the sentence beside it.
      const scores: number[] = [];
      for (const [field, text] of [
        ['theme', theme],
        ['restatement', restatement],
        ['who', who],
      ] as const) {
        const m = fuzzyMatch(token, text);
        if (!m || !tight(m.indices, token.length)) continue;
        scores.push(m.score * WEIGHT[field]);
        runs[field].push(m.indices);
        matchedOutsideQuotes = true;
      }
      if (quotes.some((q) => q.includes(token))) {
        scores.push(token.length * QUOTE_PER_CHAR * WEIGHT.quote);
      }
      // Only when the word was found nowhere: try it as a misspelling. It runs
      // last, and scores low, so a row that really contains the word is never
      // displaced by one that merely resembles it.
      if (scores.length === 0) {
        for (const [field, text] of [
          ['theme', theme],
          ['restatement', restatement],
          ['who', who],
        ] as const) {
          const near = nearestWord(token, text);
          if (!near) continue;
          scores.push(
            (token.length * MISSPELLED_PER_CHAR * WEIGHT[field]) / Math.max(1, near.distance),
          );
          runs[field].push(wordIndices(near));
          matchedOutsideQuotes = true;
        }
      }
      if (scores.length === 0) {
        all = false;
        break;
      }
      const best = Math.max(...scores);
      const rest = scores.reduce((n, s) => n + s, 0) - best;
      score += best + rest * CORROBORATION;
    }
    if (!all) continue;

    hits.push({
      row,
      score,
      theme: mergeIndices(runs.theme),
      restatement: mergeIndices(runs.restatement),
      who: mergeIndices(runs.who),
      quoteOnly: !matchedOutsideQuotes,
    });
  }

  // Best first. `sort` is stable, so equally-scored rows keep corpus order —
  // chronological — instead of shuffling between keystrokes.
  return hits.sort((a, b) => b.score - a.score);
}
