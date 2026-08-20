/**
 * A small subsequence ("fuzzy") matcher: does every character of the needle
 * appear in the haystack, in order, and how good is the best such alignment.
 *
 * Domain-neutral on purpose — it knows nothing about promises. What a match is
 * *worth* against a promise (a topic hit beating a quote hit, say) is decided in
 * `search.ts`; this file only answers "where, and how tightly".
 *
 * The alignment is scored, not merely detected, because a subsequence match on
 * its own is far too generous: "tax" is a subsequence of "the **t**rade
 * **a**greements we e**x**pect", and of "cut **tax**es", and only the second is
 * what the reader meant. Scoring the run — contiguous characters and characters
 * starting a word count for much more than scattered ones — is what separates
 * the two, and the same numbers rank the results afterwards.
 */

/** One scored alignment: the score, plus which haystack characters it used. */
export interface FuzzyMatch {
  score: number;
  /** Indices into the haystack that the needle landed on, ascending. */
  indices: number[];
}

// Scoring weights. Their absolute size doesn't matter — only the ratios do, and
// the ratio that carries the work is CONSECUTIVE against GAP: a tight run has to
// out-earn a scattered one by enough that no amount of luck closes the gap. GAP
// is charged only between matched characters, never for the text on either side.
const MATCH = 16;
const CONSECUTIVE = 14;
const WORD_START = 12;
const GAP = -2;

const NEG = -Infinity;

/** True when the character at `i` opens a word (start of string, or after a separator). */
function startsWord(text: string, i: number): boolean {
  if (i === 0) return true;
  return !/[A-Za-z0-9]/.test(text[i - 1]!);
}

/**
 * Best alignment of `needle` inside `haystack`, or null when the characters
 * don't appear in order at all. Case-insensitive; an empty needle matches
 * everything at zero.
 *
 * Optimal, not greedy: a greedy left-to-right walk takes the first "t" it sees
 * and can miss the word that the reader was typing, so the whole alignment is
 * solved with a two-row recurrence (match / best-so-far) and traced back. The
 * strings here are a topic, a restatement or a name — tens of characters — so
 * the quadratic table is nothing.
 */
export function fuzzyMatch(needle: string, haystack: string): FuzzyMatch | null {
  const q = needle.toLowerCase();
  const t = haystack.toLowerCase();
  const m = q.length;
  const n = t.length;
  if (m === 0) return { score: 0, indices: [] };
  if (m > n) return null;

  const W = n + 1;
  // M[i][j]: best score for the first i needle chars with needle[i-1] landing
  // exactly on haystack[j-1]. D[i][j]: best score for the first i needle chars
  // anywhere within the first j haystack chars — i.e. M, or M further left.
  const M = new Float64Array((m + 1) * W).fill(NEG);
  const D = new Float64Array((m + 1) * W).fill(NEG);
  // Traceback crumbs: did M[i][j] continue a run, and did D[i][j] take the match
  // at j or skip past it?
  const ran = new Uint8Array((m + 1) * W);
  const took = new Uint8Array((m + 1) * W);

  // Nothing matched yet costs nothing: the needle is free to start anywhere.
  for (let j = 0; j <= n; j += 1) D[j] = 0;

  for (let i = 1; i <= m; i += 1) {
    const qc = q[i - 1]!;
    for (let j = 1; j <= n; j += 1) {
      const here = i * W + j;
      if (qc === t[j - 1]) {
        const prev = (i - 1) * W + (j - 1);
        // extend the run through j-1, or start fresh after a gap
        const run = M[prev] === NEG ? NEG : M[prev]! + CONSECUTIVE;
        const fresh = D[prev]!;
        const base = run >= fresh ? run : fresh;
        if (base !== NEG) {
          M[here] = base + MATCH + (startsWord(haystack, j - 1) ? WORD_START : 0);
          ran[here] = run >= fresh ? 1 : 0;
        }
      }
      const skipped = D[here - 1] === NEG ? NEG : D[here - 1]! + GAP;
      if (M[here] !== NEG && M[here]! >= skipped) {
        D[here] = M[here]!;
        took[here] = 1;
      } else {
        D[here] = skipped;
      }
    }
  }

  // The best run of the last needle character — *not* D[m][n]. Gaps are only
  // gaps between matched characters: text before the match, and text after it,
  // cost nothing. Reading the answer off D would charge for the tail, which
  // makes the same word score worse for appearing early in a long sentence than
  // late in a short one — a ranking that has nothing to do with the query.
  let score = NEG;
  let end = 0;
  for (let j = 1; j <= n; j += 1) {
    if (M[m * W + j]! > score) {
      score = M[m * W + j]!;
      end = j;
    }
  }
  if (score === NEG) return null;

  // Walk the crumbs back from that last matched character. `inRun` means the
  // step we just took was the tail of a contiguous run, so the previous needle
  // char is pinned to the previous haystack char and there is no choice to
  // re-make; it starts true because `end` is a match by construction.
  const indices: number[] = [];
  let i = m;
  let j = end;
  let inRun = true;
  while (i > 0 && j > 0) {
    const here = i * W + j;
    if (inRun || took[here]) {
      indices.push(j - 1);
      inRun = ran[here] === 1;
      i -= 1;
      j -= 1;
    } else {
      j -= 1;
    }
  }
  indices.reverse();
  return { score, indices };
}

/** A whole word of the haystack that the needle nearly spells. */
export interface NearWord {
  /** Edits (insert / delete / substitute) between the needle and that word. */
  distance: number;
  /** Where the word starts, and how long it is — the highlight is the word. */
  start: number;
  length: number;
}

/** Levenshtein distance, abandoned as soon as it is certain to exceed `max`. */
function editDistance(a: string, b: string, max: number): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > max) return max + 1;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    const cur = new Array<number>(n + 1);
    cur[0] = i;
    let best = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (cur[j]! < best) best = cur[j]!;
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[n]!;
}

/** How wrong a word may be spelled and still be recognised, by its length. */
function budget(length: number): number {
  if (length >= 7) return 2;
  if (length >= 4) return 1;
  return 0;
}

/**
 * The word in `haystack` that `needle` most nearly spells, within a length-based
 * edit budget — or null when nothing comes close.
 *
 * This is the half of "fuzzy" that a subsequence cannot do. Dropping a letter
 * ("helthcare") leaves a subsequence and is already found; typing the wrong one
 * ("edukation") does not, and no amount of scoring recovers it, because the k
 * simply is not there. Short words get no budget at all: at three characters an
 * edit is a different word.
 */
export function nearestWord(needle: string, haystack: string): NearWord | null {
  const max = budget(needle.length);
  if (max === 0) return null;
  const q = needle.toLowerCase();
  let best: NearWord | null = null;
  for (const m of haystack.toLowerCase().matchAll(/[a-z0-9]+/g)) {
    const word = m[0];
    const d = editDistance(q, word, max);
    if (d > max) continue;
    if (!best || d < best.distance) best = { distance: d, start: m.index!, length: word.length };
    if (best.distance === 0) break;
  }
  return best;
}

/** The indices a whole-word hit covers, for highlighting. */
export function wordIndices(near: NearWord): number[] {
  return Array.from({ length: near.length }, (_, k) => near.start + k);
}

/**
 * Merge highlight runs from several needles over one haystack into ascending,
 * de-duplicated indices — one word of the query may land before another's.
 */
export function mergeIndices(runs: readonly number[][]): number[] {
  const seen = new Set<number>();
  for (const run of runs) for (const i of run) seen.add(i);
  return [...seen].sort((a, b) => a - b);
}

/** Ascending indices grouped into contiguous [start, end) spans, for rendering. */
export function toSpans(indices: readonly number[]): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  for (const i of indices) {
    const last = spans[spans.length - 1];
    if (last && last[1] === i) last[1] = i + 1;
    else spans.push([i, i + 1]);
  }
  return spans;
}
