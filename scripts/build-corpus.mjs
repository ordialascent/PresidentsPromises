#!/usr/bin/env node
/**
 * Generate src/content/promises.generated.ts from the corpus.
 *
 * One promises.yaml per term aggregates every promise that term made, across all
 * of its source documents (acceptance speech, inaugural address, …). A promise
 * is the unit — the *commitment* — and it carries a list of `occurrences`: where
 * and when it was said (which document, the ¶ref into it, and that document's
 * verbatim quote). A commitment made in two sources is ONE promise with two
 * occurrences, so the chart counts distinct promises, not utterances, and the
 * occurrence count is the "how often was this promised" signal.
 *
 * Corpus YAML shape (a controlled subset):
 *   - id / theme / restatement / measurable            (+ scoring blocks, ignored)
 *   - single-source (legacy): top-level `ref` + `quote` → the acceptance speech
 *   - multi-source: a `sources:` list of { in: <kind>, ref, quote }
 *
 * Dependency-free by design: a small indentation-aware scanner reads exactly the
 * fields above (no YAML library, no install, no network). Re-run after editing
 * the corpus:  npm run build:corpus
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CORPUS = join(ROOT, 'corpus');
const OUT = join(ROOT, 'src', 'content', 'promises.generated.ts');

const QUALITIES = ['full', 'partial', 'no'];
const KIND_LABEL = { acceptance: 'acceptance speech', inaugural: 'inaugural address' };
const unquote = (s) => s.replace(/^["'](.*)["']$/, '$1');
const isBlock = (v) => /^[>|]-?$/.test(v) || v === '';

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

/**
 * Parse promises.yaml into promise objects: { id, theme, restatement, measurable,
 * ref?, quote?, sources?: [{ in, ref, quote }] }. Nested scoring blocks
 * (metric / threshold / …) are simply skipped — only the app projection is read.
 */
function parsePromises(text) {
  const lines = text.split(/\r?\n/);
  const n = lines.length;
  const out = [];
  let i = 0;

  // Join a folded (">") block scalar whose body is indented deeper than `indent`.
  const readFolded = (indent, start) => {
    const re = new RegExp(`^ {${indent + 1},}(\\S.*)$`);
    const buf = [];
    let j = start;
    while (j < n) {
      const mm = lines[j].match(re);
      if (!mm) break;
      buf.push(mm[1].trim());
      j += 1;
    }
    return [buf.join(' ').replace(/\s+/g, ' ').trim(), j];
  };

  while (i < n) {
    const idm = lines[i].match(/^ {2}- id:\s*(.+?)\s*$/);
    if (!idm) {
      i += 1;
      continue;
    }
    const p = { id: unquote(idm[1]) };
    i += 1;
    // consume the promise body until the next "- " item or a column-0 line
    while (i < n && !/^ {2}- /.test(lines[i]) && !/^\S/.test(lines[i])) {
      const line = lines[i];

      let m = line.match(/^ {4}(theme|restatement|measurable|ref):\s*(.+?)\s*$/);
      if (m) {
        p[m[1]] = unquote(m[2]);
        i += 1;
        continue;
      }
      m = line.match(/^ {4}quote:\s*(.*)$/);
      if (m) {
        const rest = m[1].trim();
        if (isBlock(rest)) {
          const [q, ni] = readFolded(4, i + 1);
          p.quote = q;
          i = ni;
        } else {
          p.quote = unquote(rest);
          i += 1;
        }
        continue;
      }
      if (/^ {4}sources:\s*$/.test(line)) {
        i += 1;
        p.sources = [];
        while (i < n && /^ {6}- /.test(lines[i])) {
          const entry = {};
          const set = (key, val) => {
            if (key === 'quote' && isBlock(val)) {
              const [q, ni] = readFolded(8, i + 1);
              entry.quote = q;
              i = ni;
            } else {
              entry[key] = unquote(val);
              i += 1;
            }
          };
          const head = lines[i].match(/^ {6}- (\w+):\s*(.*)$/);
          if (head) set(head[1], head[2].trim());
          else i += 1;
          while (i < n && /^ {8}\w+:/.test(lines[i])) {
            const fm = lines[i].match(/^ {8}(\w+):\s*(.*)$/);
            set(fm[1], fm[2].trim());
          }
          p.sources.push(entry);
        }
        continue;
      }
      // scoring blocks and their sub-lines, blanks, etc. — ignored
      i += 1;
    }
    out.push(p);
  }
  return out;
}

const terms = [];
for (const name of readdirSync(CORPUS)) {
  const dir = join(CORPUS, name);
  if (!statSync(dir).isDirectory()) continue;
  const m = name.match(/^(\d{4})-(\d{4}) (.+)$/);
  if (!m) continue;
  const [, fromStr, toStr, surname] = m;
  const files = readdirSync(dir);

  // Every source document in the term is "<year>-<kind>.md"; read each one's
  // front-matter into the rich source (a promise occurrence's context).
  const docs = {};
  for (const f of files) {
    const sm = f.match(/^(\d{4})-([a-z]+)\.md$/);
    if (!sm) continue;
    const kind = sm[2];
    const year = Number(sm[1]);
    const fm = parseFrontMatter(readFileSync(join(dir, f), 'utf8'));
    docs[kind] = {
      kind,
      medium: fm.type || 'speech',
      speaker: fm.name || '',
      event: fm.title || '',
      year,
      date: fm.date_published || '',
      publisher: fm.source_publisher || '',
      url: fm.source_url || '',
      label: `${year} ${KIND_LABEL[kind] || kind}`,
    };
  }
  if (!Object.keys(docs).length) continue;
  // The acceptance speech is the default source and the term's headline year.
  const acceptance = docs.acceptance || Object.values(docs).sort((a, b) => a.year - b.year)[0];

  const raw = files.includes('promises.yaml')
    ? parsePromises(readFileSync(join(dir, 'promises.yaml'), 'utf8'))
    : [];
  const promises = raw.map((p) => {
    if (!QUALITIES.includes(p.measurable)) {
      throw new Error(`${name}/${p.id}: bad measurable ${JSON.stringify(p.measurable)}`);
    }
    let occurrences;
    if (p.sources && p.sources.length) {
      occurrences = p.sources.map((s) => {
        const src = docs[s.in];
        if (!src) throw new Error(`${name}/${p.id}: no "${s.in}" source document in this term`);
        return { source: src, ref: s.ref ?? '', quote: s.quote ?? '' };
      });
    } else {
      occurrences = [{ source: acceptance, ref: p.ref ?? '', quote: p.quote ?? '' }];
    }
    return {
      id: p.id,
      theme: p.theme ?? 'other',
      restatement: p.restatement ?? p.id,
      quality: p.measurable,
      occurrences,
    };
  });

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
const occ = terms.reduce((n, t) => n + t.promises.reduce((k, p) => k + p.occurrences.length, 0), 0);
const banner =
  '// AUTO-GENERATED by scripts/build-corpus.mjs from corpus/*/promises.yaml.\n' +
  '// Do not edit by hand — edit the corpus and run `npm run build:corpus`.\n';

const body = `${banner}
export type Quality = 'full' | 'partial' | 'no';

/** Where and how a promise was made — the "context". A term's source documents
 *  (acceptance speech, inaugural address, …) each supply one; generalised so
 *  debates, interviews, or written statements slot in as new kind/medium values. */
export interface PromiseSource {
  /** e.g. "acceptance" | "inaugural" (future: "debate", "interview", …). */
  kind: string;
  /** The medium — "speech" today; e.g. "debate", "interview", "press release". */
  medium: string;
  /** Who made the promise. */
  speaker: string;
  /** The occasion, e.g. the speech title / venue. */
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

/** One time a promise was made: the source, the ¶ref into it, and its quote. */
export interface PromiseOccurrence {
  source: PromiseSource;
  ref: string;
  quote: string;
}

export interface CorpusPromise {
  id: string;
  theme: string;
  restatement: string;
  quality: Quality;
  /** Every time this commitment was made (>= 1). Length is the recurrence. */
  occurrences: PromiseOccurrence[];
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
  /** Election/acceptance-speech year the term is anchored on. */
  speechYear: number | null;
  /** Short bar label, e.g. "Obama 2008". */
  label: string;
  promises: CorpusPromise[];
}

/** Every term with its aggregated promise set, oldest first. */
export const CORPUS_TERMS: CorpusTerm[] = ${JSON.stringify(terms, null, 2)};

/** Total distinct promises across the corpus (sanity anchor for tests). */
export const CORPUS_PROMISE_COUNT = ${total};

/** Total promise occurrences (utterances) across the corpus. */
export const CORPUS_OCCURRENCE_COUNT = ${occ};
`;

writeFileSync(OUT, body);
console.log(
  `wrote ${OUT}\n  ${terms.length} terms, ${total} promises, ${occ} occurrences ` +
    `(${terms.map((t) => `${t.label}:${t.promises.length}`).join(', ')})`,
);
