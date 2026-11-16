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
 * Every promises.yaml is written under corpus/PROTOCOL.md (`protocol: 1`). Its
 * records carry `kind` (promise | ambition), `type` and a verifiability
 * `level`; the app gets the protocol description under `protocol`, promises
 * and ambitions in separate lists, and the level as the record's tier
 * (`quality`). Run `npm run validate` first; this script trusts the shape.
 *
 * Re-run after editing the corpus:  npm run build:corpus
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CORPUS = join(ROOT, 'corpus');
const OUT = join(ROOT, 'src', 'content', 'promises.generated.ts');

const QUALITIES = ['high', 'medium', 'low'];
/** Screening decisions (corpus/PROTOCOL.md §2), in the order the methodology page lists them. */
const DECISIONS = ['include', 'others', 'past', 'describe', 'conditional', 'attack', 'ceremony'];
const KIND_LABEL = {
  acceptance: 'acceptance speech',
  inaugural: 'inaugural address',
  debate: 'debate',
};
/** The protocol-1 description of a record, as the app shows it (absent keys dropped). */
function protocolFields(p) {
  const v = p.verifiability ?? {};
  const str = (x) => (x == null ? null : String(x));
  return {
    type: p.type,
    group: str(p.group),
    deadline: { stated: str(p.deadline?.stated), applied: String(p.deadline?.applied ?? '') },
    verifiability: {
      level: v.level,
      object: str(v.object),
      record: str(v.record),
      criterion: str(v.criterion),
      ambiguity: str(v.ambiguity),
    },
    uncertainty: { extraction: p.uncertainty?.extraction ?? 'clear', note: str(p.uncertainty?.note) },
    links: (p.links ?? []).map((l) => ({ kind: l.kind, to: l.to })),
  };
}
/** A verdict record as the app shows it (PROTOCOL.md §6). */
function verdictFields(v) {
  const str = (x) => (x == null ? null : String(x));
  return {
    verdict: v.verdict,
    asOf: String(v.as_of),
    summary: String(v.summary ?? ''),
    attempt: str(v.attempt),
    review: str(v.review),
    evidence: (v.evidence ?? []).map((e) => ({
      what: String(e.what),
      url: String(e.url),
      publisher: String(e.publisher),
      date: str(e.date),
      secondary: e.secondary === true,
    })),
    uncertainty: { verdict: v.uncertainty?.verdict ?? 'clear', note: str(v.uncertainty?.note) },
  };
}
const unquote = (s) => s.replace(/^["'](.*)["']$/, '$1');

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
  // The acceptance speech gives the term its headline year.
  const acceptance = docs.acceptance || Object.values(docs).sort((a, b) => a.year - b.year)[0];

  const ptext = files.includes('promises.yaml') ? readFileSync(join(dir, 'promises.yaml'), 'utf8') : '';
  const pdoc = ptext ? parseYaml(ptext) : { protocol: 1, promises: [] };
  if (pdoc?.protocol !== 1) throw new Error(`${name}/promises.yaml: must declare \`protocol: 1\``);
  // Verdicts (PROTOCOL.md §6) live in their own file; each attaches to its promise.
  const vtext = files.includes('verdicts.yaml') ? readFileSync(join(dir, 'verdicts.yaml'), 'utf8') : '';
  const verdictById = new Map(
    (vtext ? parseYaml(vtext)?.verdicts ?? [] : []).map((v) => [v.promise, verdictFields(v)]),
  );
  const all = (pdoc.promises ?? []).map((p) => {
    const quality = p.verifiability?.level;
    if (!QUALITIES.includes(quality)) {
      throw new Error(`${name}/${p.id}: bad verifiability level ${JSON.stringify(quality)}`);
    }
    const occurrences = (p.sources ?? []).map((s) => {
      const src = docs[s.in];
      if (!src) throw new Error(`${name}/${p.id}: no "${s.in}" source document in this term`);
      return { source: src, ref: String(s.ref ?? ''), quote: String(s.quote ?? '') };
    });
    if (!occurrences.length) throw new Error(`${name}/${p.id}: no sources`);
    return {
      id: p.id,
      kind: p.kind,
      theme: p.theme,
      restatement: p.restatement,
      quality,
      occurrences,
      protocol: protocolFields(p),
      verdict: verdictById.get(p.id) ?? null,
    };
  });
  // How every screened sentence was decided, summed over the term's ledgers:
  // the methodology page shows this so recall can be read, not just trusted.
  const screening = Object.fromEntries(DECISIONS.map((d) => [d, 0]));
  let added = 0;
  for (const f of files.filter((x) => x.endsWith('.screening.yaml')).sort()) {
    for (const row of parseYaml(readFileSync(join(dir, f), 'utf8'))?.rows ?? []) {
      if (!(row.decision in screening)) throw new Error(`${name}/${f} ${row.ref}: bad decision ${row.decision}`);
      screening[row.decision] += 1;
      if (row.added) added += 1;
    }
  }

  const promises = all.filter((p) => p.kind === 'promise');
  const ambitions = all.filter((p) => p.kind === 'ambition');

  const speechYear = acceptance ? acceptance.year : null;
  terms.push({
    key: name,
    surname,
    from: Number(fromStr),
    to: Number(toStr),
    termLabel: `${fromStr}–${toStr}`,
    speechYear,
    label: speechYear ? `${surname} ${speechYear}` : surname,
    screening,
    screenedAdded: added,
    promises,
    ambitions,
  });
}

terms.sort((a, b) => a.from - b.from || (a.speechYear ?? 0) - (b.speechYear ?? 0));

const total = terms.reduce((n, t) => n + t.promises.length, 0);
const ambitionTotal = terms.reduce((n, t) => n + t.ambitions.length, 0);
const occ = terms.reduce((n, t) => n + t.promises.reduce((k, p) => k + p.occurrences.length, 0), 0);
const banner =
  '// AUTO-GENERATED by scripts/build-corpus.mjs from corpus/*/promises.yaml and verdicts.yaml.\n' +
  '// Do not edit by hand — edit the corpus and run `npm run build:corpus`.\n';

const body = `${banner}
/** Verifiability tier (corpus/PROTOCOL.md §4): the record's verifiability level. */
export type Quality = 'high' | 'medium' | 'low';

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

/** A firm commitment ("we will") or a wish/obligation ("we must"). Only promises get verdicts. */
export type Kind = 'promise' | 'ambition';

/** The protocol-1 description of a record. */
export interface ProtocolFields {
  type: 'action' | 'outcome' | 'ongoing';
  group: string | null;
  deadline: { stated: string | null; applied: string };
  verifiability: {
    level: 'high' | 'medium' | 'low';
    object: string | null;
    record: string | null;
    criterion: string | null;
    ambiguity: string | null;
  };
  uncertainty: { extraction: 'clear' | 'probable' | 'contested'; note: string | null };
  links: { kind: 'repeats' | 'refines' | 'shared'; to: string }[];
}

/** The verdict on a promise (corpus/PROTOCOL.md §6). */
export type VerdictValue = 'kept' | 'partly' | 'broken' | 'pending' | 'indeterminate';

/** One piece of evidence a verdict cites. */
export interface VerdictEvidence {
  what: string;
  url: string;
  publisher: string;
  date: string | null;
  /** A secondary source (news, encyclopaedia), used only where no primary record shows it. */
  secondary: boolean;
}

export interface Verdict {
  verdict: VerdictValue;
  /** When the verdict was last checked (ISO date). */
  asOf: string;
  summary: string;
  /** How far the president got, for a broken promise. */
  attempt: 'none' | 'initiated' | 'passed-chamber' | null;
  /** What must still be confirmed; set means the verdict is provisional ("under review"). */
  review: string | null;
  evidence: VerdictEvidence[];
  uncertainty: { verdict: 'clear' | 'probable' | 'contested'; note: string | null };
}

export interface CorpusPromise {
  id: string;
  kind: Kind;
  theme: string;
  restatement: string;
  quality: Quality;
  /** Every time this commitment was made (>= 1). Length is the recurrence. */
  occurrences: PromiseOccurrence[];
  protocol: ProtocolFields;
  /** The verdict, for high and medium promises once judged; otherwise null. */
  verdict: Verdict | null;
}

/** A screening-ledger decision: include, or the reason a candidate was left out. */
export type Decision = ${DECISIONS.map((d) => `'${d}'`).join(' | ')};

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
  /** Screened candidate sentences by decision, over all of the term's sources. */
  screening: Record<Decision, number>;
  /** How many of those were added by reading, without a trigger word. */
  screenedAdded: number;
  /** Firm commitments: the chart's subject. */
  promises: CorpusPromise[];
  /** Soft commitments: wishes and obligations. Never get a verdict. */
  ambitions: CorpusPromise[];
}

/** Every term with its aggregated promise set, oldest first. */
export const CORPUS_TERMS: CorpusTerm[] = ${JSON.stringify(terms, null, 2)};

/** Total distinct promises across the corpus (sanity anchor for tests). */
export const CORPUS_PROMISE_COUNT = ${total};

/** Total ambitions across the corpus. */
export const CORPUS_AMBITION_COUNT = ${ambitionTotal};

/** Total promise occurrences (utterances) across the corpus. */
export const CORPUS_OCCURRENCE_COUNT = ${occ};
`;

writeFileSync(OUT, body);
console.log(
  `wrote ${OUT}\n  ${terms.length} terms, ${total} promises, ${ambitionTotal} ambitions, ${occ} occurrences ` +
    `(${terms.map((t) => `${t.label}:${t.promises.length}`).join(', ')})`,
);
