#!/usr/bin/env node
/**
 * Generate src/content/promises.generated.ts from the corpus.
 *
 * Reads every `corpus/<start>-<end> <name>/promises.yaml`, pulls the fields the
 * app needs from each promise (id, theme, restatement, measurable, source, and
 * the verbatim quote + its ¶ref), and attaches the referenced paragraph(s) from
 * the numbered speech as on-demand context. The full four-dimension scoring
 * stays in the corpus; this is the curated projection the app consumes.
 *
 * Dependency-free by design: corpus fields are single-line and indented at a
 * fixed depth (promise item at 2 spaces, its fields at 4, folded quote bodies
 * at 6), so a small indentation-aware scanner is enough — no YAML parser, no
 * install, no network. Re-run after editing the corpus:  npm run build:corpus
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CORPUS = join(ROOT, 'corpus');
const OUT = join(ROOT, 'src', 'content', 'promises.generated.ts');

const QUALITIES = ['full', 'partial', 'no'];
const unquote = (s) => s.replace(/^["'](.*)["']$/, '$1');

/** Parse promises.yaml into {id, theme, restatement, measurable, source, ref,
 *  quote}. `quote` is a folded scalar: its 6-space body lines join with spaces. */
function parsePromises(yamlText) {
  const out = [];
  let cur = null;
  let quoting = false;
  let quoteBuf = [];
  const flushQuote = () => {
    if (cur && quoteBuf.length) cur.quote = quoteBuf.join(' ').replace(/\s+/g, ' ').trim();
    quoting = false;
    quoteBuf = [];
  };
  for (const line of yamlText.split(/\r?\n/)) {
    const start = line.match(/^ {2}- id:\s*(.+?)\s*$/);
    if (start) {
      flushQuote();
      if (cur) out.push(cur);
      cur = { id: unquote(start[1]) };
      continue;
    }
    if (!cur) continue;
    if (quoting) {
      if (/^ {6}\S/.test(line)) {
        quoteBuf.push(line.trim());
        continue;
      }
      flushQuote(); // a shallower line ends the folded block; fall through to parse it
    }
    const q = line.match(/^ {4}quote:\s*(.*)$/);
    if (q) {
      const rest = q[1].trim();
      if (rest === '>' || rest === '|' || rest === '>-' || rest === '|-' || rest === '') {
        quoting = true;
        quoteBuf = [];
      } else {
        cur.quote = unquote(rest);
      }
      continue;
    }
    const field = line.match(/^ {4}(theme|restatement|measurable|source|ref):\s*(.+?)\s*$/);
    if (field) cur[field[1]] = unquote(field[2]);
  }
  flushQuote();
  if (cur) out.push(cur);
  return out;
}

/** Parse a source document's YAML front-matter into a flat key -> value map. */
function parseFrontMatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = unquote(kv[2].trim());
  }
  return fm;
}

const terms = [];
for (const name of readdirSync(CORPUS)) {
  const dir = join(CORPUS, name);
  if (!statSync(dir).isDirectory()) continue;
  const m = name.match(/^(\d{4})-(\d{4}) (.+)$/);
  if (!m) continue;
  const [, fromStr, toStr, surname] = m;
  const files = readdirSync(dir);
  const promisesFile = files.find((f) => f === 'promises.yaml');
  const speechFile = files.find((f) => /^\d{4}-acceptance\.md$/.test(f));
  if (!promisesFile) continue;
  const speechYear = speechFile ? Number(speechFile.slice(0, 4)) : null;
  const fm = speechFile ? parseFrontMatter(readFileSync(join(dir, speechFile), 'utf8')) : {};
  // The default source for a term is its nomination acceptance speech, described
  // by the speech's own front-matter (speaker / event / date / medium). As other
  // source types are added (debates, interviews, statements), a promise names its
  // own via a `source:` field pointing at that document; until then every promise
  // inherits this default, so the "context" (who / when / where / what medium) is
  // already carried without any per-promise annotation in today's corpus.
  const defaultSource = {
    kind: 'acceptance',
    medium: fm.type || 'speech',
    speaker: fm.name || surname,
    event: fm.title || 'Nomination acceptance speech',
    year: speechYear,
    date: fm.date_published || '',
    publisher: fm.source_publisher || '',
    url: fm.source_url || '',
    label: speechYear ? `${speechYear} acceptance speech` : 'acceptance speech',
  };
  const promises = parsePromises(readFileSync(join(dir, promisesFile), 'utf8')).map((p) => {
    if (!QUALITIES.includes(p.measurable)) {
      throw new Error(`${name}/${p.id}: bad measurable ${JSON.stringify(p.measurable)}`);
    }
    // A per-promise `source:` override names a different source; full metadata
    // for such a document will attach when those documents are added.
    const source = p.source
      ? { ...defaultSource, kind: 'other', event: p.source, label: p.source }
      : defaultSource;
    return {
      id: p.id,
      theme: p.theme ?? 'other',
      restatement: p.restatement ?? p.id,
      quality: p.measurable,
      source,
      ref: p.ref ?? '',
      quote: p.quote ?? '',
    };
  });
  terms.push({
    key: name,
    surname,
    from: Number(fromStr),
    to: Number(toStr),
    termLabel: `${fromStr}–${toStr}`,
    speechYear,
    label: speechYear ? `${surname} ${speechYear}` : surname,
    promises,
  });
}

terms.sort((a, b) => a.from - b.from || (a.speechYear ?? 0) - (b.speechYear ?? 0));

const total = terms.reduce((n, t) => n + t.promises.length, 0);
const banner =
  '// AUTO-GENERATED by scripts/build-corpus.mjs from corpus/*/promises.yaml.\n' +
  '// Do not edit by hand — edit the corpus and run `npm run build:corpus`.\n';

const body = `${banner}
export type Quality = 'full' | 'partial' | 'no';

/** The context of a promise: who said it, when, at what event, in what medium.
 *  Today always the term's nomination acceptance speech, described by that
 *  speech's front-matter — generalised so debates, interviews, or written
 *  statements slot in as new kind/medium values without reshaping. */
export interface PromiseSource {
  /** e.g. "acceptance" | "other" (future: "debate", "interview", "statement"). */
  kind: string;
  /** The medium — "speech" today; e.g. "debate", "interview", "press release". */
  medium: string;
  /** Who made the promise. */
  speaker: string;
  /** The occasion, e.g. the acceptance-speech title / venue. */
  event: string;
  /** Year the promise was made. */
  year: number | null;
  /** Full date, if known (ISO). */
  date: string;
  /** Citation publisher. */
  publisher: string;
  /** Link to the source. */
  url: string;
  /** Compact label, e.g. "2016 acceptance speech". */
  label: string;
}

export interface CorpusPromise {
  id: string;
  theme: string;
  restatement: string;
  quality: Quality;
  source: PromiseSource;
  /** Paragraph.sentence reference into the source, e.g. "¶44.1". */
  ref: string;
  /** Verbatim promise text. */
  quote: string;
}

export interface CorpusTerm {
  /** Corpus directory name, e.g. "2009-2013 Obama". Stable key. */
  key: string;
  surname: string;
  /** Inauguration year that opened the term. */
  from: number;
  /** Next inauguration year. */
  to: number;
  /** "2009–2013" — display label for the term span. */
  termLabel: string;
  /** Election/acceptance-speech year the promises were made. */
  speechYear: number | null;
  /** Short bar label, e.g. "Obama 2008". */
  label: string;
  promises: CorpusPromise[];
}

/** Every term with an extracted promise set, oldest first. */
export const CORPUS_TERMS: CorpusTerm[] = ${JSON.stringify(terms, null, 2)};

/** Total promises across the corpus (sanity anchor for tests). */
export const CORPUS_PROMISE_COUNT = ${total};
`;

writeFileSync(OUT, body);
console.log(
  `wrote ${OUT}\n  ${terms.length} terms, ${total} promises ` +
    `(${terms.map((t) => `${t.label}:${t.promises.length}`).join(', ')})`,
);
