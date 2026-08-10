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

// Human-readable label for a source kind, used in the compact source tag.
const KIND_LABEL = { acceptance: 'acceptance speech', inaugural: 'inaugural address' };

// Build the rich source (the promise's "context") from a source doc's own
// front-matter, so who/when/where/medium always come from the document that
// actually carries the promise.
function buildSource(dir, stem, kind, year) {
  const fm = parseFrontMatter(readFileSync(join(dir, `${stem}.md`), 'utf8'));
  return {
    kind,
    medium: fm.type || 'speech',
    speaker: fm.name || '',
    event: fm.title || '',
    year: Number.isFinite(year) ? year : null,
    date: fm.date_published || '',
    publisher: fm.source_publisher || '',
    url: fm.source_url || '',
    label: `${year} ${KIND_LABEL[kind] || kind}`,
  };
}

const terms = [];
for (const name of readdirSync(CORPUS)) {
  const dir = join(CORPUS, name);
  if (!statSync(dir).isDirectory()) continue;
  const m = name.match(/^(\d{4})-(\d{4}) (.+)$/);
  if (!m) continue;
  const [, fromStr, toStr, surname] = m;
  const files = readdirSync(dir);

  // Every source document in the term is "<year>-<kind>.md" (e.g. an acceptance
  // speech and an inaugural address). Each pairs with its own promises file, so
  // a promise's ¶ref is unambiguous and its source is the document it lives in.
  const sourceDocs = files
    .map((f) => {
      const sm = f.match(/^(\d{4})-([a-z]+)\.md$/);
      return sm ? { stem: f.slice(0, -3), year: Number(sm[1]), kind: sm[2] } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.year - b.year || a.kind.localeCompare(b.kind));
  if (!sourceDocs.length) continue;

  const promises = [];
  for (const doc of sourceDocs) {
    const source = buildSource(dir, doc.stem, doc.kind, doc.year);
    // Promises paired with this doc: "<stem>.promises.yaml"; the acceptance doc
    // keeps the legacy flat "promises.yaml".
    const pf =
      (files.includes(`${doc.stem}.promises.yaml`) && `${doc.stem}.promises.yaml`) ||
      (doc.kind === 'acceptance' && files.includes('promises.yaml') && 'promises.yaml') ||
      null;
    if (!pf) continue;
    for (const p of parsePromises(readFileSync(join(dir, pf), 'utf8'))) {
      if (!QUALITIES.includes(p.measurable)) {
        throw new Error(`${name}/${pf}: ${p.id} has bad measurable ${JSON.stringify(p.measurable)}`);
      }
      promises.push({
        id: p.id,
        theme: p.theme ?? 'other',
        restatement: p.restatement ?? p.id,
        quality: p.measurable,
        source,
        ref: p.ref ?? '',
        quote: p.quote ?? '',
      });
    }
  }

  // Term identity (the tuple + its bar label) is anchored on the acceptance year.
  const acceptance = sourceDocs.find((d) => d.kind === 'acceptance') ?? sourceDocs[0];
  const speechYear = acceptance ? acceptance.year : null;
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
