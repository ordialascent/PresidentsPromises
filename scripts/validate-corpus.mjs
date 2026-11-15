#!/usr/bin/env node
/**
 * Validate the corpus against the extraction protocol (corpus/PROTOCOL.md).
 *
 * Checks every term directory under corpus/:
 *   - source documents: front-matter, numbering, debate `speaker_label`;
 *   - screening ledgers (`<year>-<kind>.screening.yaml`): every row resolves,
 *     every trigger-matched sentence has a row (recall is checkable), debate
 *     rows stay inside the president's turns;
 *   - promises.yaml written under the protocol (`protocol: 1`): the full record
 *     schema, refs, exact quotes, links, and the ledger <-> promise cross-check;
 *   - promises.yaml in the legacy format: unique ids and resolvable refs as
 *     errors; quote mismatches as warnings until the term is re-extracted.
 *
 * Usage:  npm run validate         (exit 1 on any error; warnings are printed)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';

export const THEMES = [
  'economy', 'taxes', 'budget', 'trade', 'energy', 'environment',
  'health', 'education', 'immigration', 'defense', 'foreign-policy',
  'crime-justice', 'retirement', 'government', 'rights', 'infrastructure',
  'veterans', 'welfare',
];
export const KINDS = ['promise', 'ambition'];
export const TYPES = ['action', 'outcome', 'ongoing'];
export const LEVELS = ['high', 'medium', 'low'];
export const EXTRACTION = ['clear', 'probable', 'contested'];
export const LINK_KINDS = ['repeats', 'refines', 'shared'];
export const DECISIONS = ['include', 'others', 'past', 'describe', 'conditional', 'attack', 'ceremony'];

/** The trigger lexicon from PROTOCOL.md §1, as whole-word, case-insensitive patterns. */
export const TRIGGERS = {
  firm: [
    "I will", "I'll", 'we will', "we'll", 'I am going to', "I'm going to",
    'we are going to', "we're going to", 'I shall', 'we shall',
    'my administration will', 'my plan will', 'as president, I', 'on day one',
    'I pledge', 'I promise', 'I commit', 'I vow', 'my pledge', 'my promise', 'commitment',
    "I'm not going to", 'I am not going to', "we're not going to", 'we are not going to',
    "I won't", "we won't", "I'm gonna", "we're gonna",
  ],
  soft: [
    'we must', 'we need to', 'we have to', 'we should', 'I want to', 'I hope to',
    'I intend to', 'I plan to', "I'd like to",
    'I want', 'we want', "I don't want", 'I would like', 'we ought to',
    'there needs to be', 'there ought to be', 'there has to be',
  ],
};
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TRIGGER_RE = new RegExp(
  `\\b(?:${[...TRIGGERS.firm, ...TRIGGERS.soft].map(escape).join('|')})\\b`,
  'i',
);

/** Straighten typographic apostrophes so "I’ll" matches "I'll". */
const straighten = (s) => s.replace(/[‘’ʼ]/g, "'");
/** Whitespace-normalised, apostrophe-straightened text for quote comparison. */
export const normalise = (s) => straighten(String(s)).replace(/\s+/g, ' ').trim();

/** Does a sentence contain a trigger phrase? Returns the matched phrase or null. */
export function triggerOf(sentence) {
  const m = straighten(sentence).match(TRIGGER_RE);
  return m ? m[0] : null;
}

/**
 * Parse a numbered source document.
 * Returns { fm, paragraphs: Map<number, { speaker, sentences: string[] }> }.
 */
export function parseSource(md) {
  const fm = {};
  const fmMatch = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) Object.assign(fm, parseYaml(fmMatch[1]) ?? {});
  const paragraphs = new Map();
  let current = null;
  for (const line of md.slice(fmMatch ? fmMatch[0].length : 0).split(/\r?\n/)) {
    const h = line.match(/^## ¶(\d+)(?:\s+—\s*(.*))?\s*$/);
    if (h) {
      current = { speaker: (h[2] ?? '').trim(), sentences: [] };
      paragraphs.set(Number(h[1]), current);
      continue;
    }
    const s = line.match(/^(\d+)\.\s+(.*)$/);
    if (s && current) current.sentences[Number(s[1]) - 1] = s[2];
  }
  return { fm, paragraphs };
}

/**
 * Resolve a ref ("¶14.2", "¶24.1-24.2", "¶2.5-3.1") against a parsed source.
 * Returns { sentences: [{ p, s, speaker, text }], text } or { error }.
 */
export function resolveRef(source, ref) {
  const m = String(ref).match(/^¶(\d+)\.(\d+)(?:-(?:(\d+)\.)?(\d+))?$/);
  if (!m) return { error: `malformed ref "${ref}"` };
  const p1 = Number(m[1]);
  const s1 = Number(m[2]);
  const p2 = m[4] ? (m[3] ? Number(m[3]) : p1) : p1;
  const s2 = m[4] ? Number(m[4]) : s1;
  if (p2 < p1 || (p2 === p1 && s2 < s1)) return { error: `ref "${ref}" runs backwards` };
  const out = [];
  for (let p = p1; p <= p2; p += 1) {
    const para = source.paragraphs.get(p);
    if (!para) return { error: `ref "${ref}": no paragraph ¶${p}` };
    const from = p === p1 ? s1 : 1;
    const to = p === p2 ? s2 : para.sentences.length;
    for (let s = from; s <= to; s += 1) {
      const text = para.sentences[s - 1];
      if (text === undefined) return { error: `ref "${ref}": no sentence ¶${p}.${s}` };
      out.push({ p, s, speaker: para.speaker, text });
    }
  }
  return { sentences: out, text: out.map((x) => x.text).join(' ') };
}

/** Is `quote` a contiguous part of `span` (whitespace normalised)? */
export const quoteFits = (quote, span) => {
  const q = normalise(quote);
  return q.length > 0 && normalise(span).includes(q);
};

const key = (p, s) => `${p}.${s}`;
const isDate = (v) =>
  (v instanceof Date && !Number.isNaN(v.getTime())) ||
  (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v));
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * Validate one term. `files` maps a file name to its text, so tests can pass
 * fixtures and the CLI passes the directory's contents. `allIds` is the set of
 * promise ids across the whole corpus (links may cross terms).
 * Returns { errors: string[], warnings: string[] }.
 */
export function validateTerm(termName, files, allIds = new Set()) {
  const errors = [];
  const warnings = [];
  const err = (where, msg) => errors.push(`${termName}/${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${termName}/${where}: ${msg}`);

  // ---- sources ------------------------------------------------------------
  const sources = {}; // kind -> { file, parsed, label }
  for (const [file, text] of Object.entries(files)) {
    const m = file.match(/^(\d{4})-([a-z]+)\.md$/);
    if (!m) continue;
    const parsed = parseSource(text);
    const kind = m[2];
    for (const f of ['name', 'title', 'date_published', 'source_url']) {
      if (!parsed.fm[f]) err(file, `front-matter is missing "${f}"`);
    }
    if (!parsed.paragraphs.size) err(file, 'no numbered paragraphs');
    let label = null;
    if (kind === 'debate') {
      label = parsed.fm.speaker_label;
      if (!nonEmpty(label)) {
        err(file, 'debate front-matter is missing "speaker_label"');
      } else if (![...parsed.paragraphs.values()].some((p) => p.speaker === label)) {
        err(file, `speaker_label "${label}" matches no paragraph`);
      }
    }
    sources[kind] = { file, parsed, label, year: m[1] };
  }

  /** Is every sentence of a resolved ref inside the president's turns? */
  const inTurns = (src, resolved) =>
    !src.label || resolved.sentences.every((x) => x.speaker === src.label);

  // ---- screening ledgers --------------------------------------------------
  const ledgers = {}; // kind -> { file, rows: [{ ref, decision, promises, keys }] }
  for (const [file, text] of Object.entries(files)) {
    const m = file.match(/^(\d{4})-([a-z]+)\.screening\.yaml$/);
    if (!m) continue;
    const kind = m[2];
    const src = sources[kind];
    if (!src || src.year !== m[1]) {
      err(file, `no source document ${m[1]}-${kind}.md`);
      continue;
    }
    let doc;
    try {
      doc = parseYaml(text);
    } catch (e) {
      err(file, `YAML: ${e.message.split('\n')[0]}`);
      continue;
    }
    if (doc?.source !== `${m[1]}-${kind}`) err(file, `"source" must be "${m[1]}-${kind}"`);
    if (doc?.protocol !== 1) err(file, '"protocol" must be 1');
    const rows = Array.isArray(doc?.rows) ? doc.rows : [];
    if (!rows.length) err(file, 'no rows');
    const covered = new Map(); // sentence key -> row ref
    const ledger = { file, rows: [] };
    for (const row of rows) {
      const where = `${file} ${row?.ref ?? '(no ref)'}`;
      const resolved = resolveRef(src.parsed, row?.ref);
      if (resolved.error) {
        err(file, resolved.error);
        continue;
      }
      if (!DECISIONS.includes(row.decision)) err(where, `unknown decision "${row.decision}"`);
      const ids = row.promises ?? [];
      if (row.decision === 'include' && (!Array.isArray(ids) || !ids.length)) {
        err(where, 'an include row must list its promises');
      }
      if (row.decision !== 'include' && ids.length) err(where, 'only include rows list promises');
      if (!inTurns(src, resolved)) err(where, `outside the turns of "${src.label}"`);
      const keys = resolved.sentences.map((x) => key(x.p, x.s));
      for (const k of keys) {
        if (covered.has(k)) err(where, `¶${k} is already covered by row ${covered.get(k)}`);
        covered.set(k, row.ref);
      }
      ledger.rows.push({ ref: row.ref, decision: row.decision, promises: ids, keys });
    }
    // Recall: every trigger-matched sentence in scope needs a row.
    for (const [p, para] of src.parsed.paragraphs) {
      if (src.label && para.speaker !== src.label) continue;
      para.sentences.forEach((text, i) => {
        if (text === undefined) return;
        const hit = triggerOf(text);
        if (hit && !covered.has(key(p, i + 1))) {
          err(file, `¶${p}.${i + 1} matches "${hit}" but has no ledger row`);
        }
      });
    }
    ledgers[kind] = ledger;
  }

  // ---- promises.yaml ------------------------------------------------------
  const ptext = files['promises.yaml'];
  if (ptext === undefined) return { errors, warnings };
  let pdoc;
  try {
    pdoc = parseYaml(ptext);
  } catch (e) {
    err('promises.yaml', `YAML: ${e.message.split('\n')[0]}`);
    return { errors, warnings };
  }
  const promises = Array.isArray(pdoc?.promises) ? pdoc.promises : [];
  const strict = pdoc?.protocol === 1;
  const seen = new Set();

  // Each occurrence: { in, ref, quote } — legacy single-source promises carry a
  // top-level ref/quote that points at the acceptance speech.
  const occurrencesOf = (p) =>
    Array.isArray(p.sources) && p.sources.length
      ? p.sources
      : p.ref
        ? [{ in: 'acceptance', ref: p.ref, quote: p.quote }]
        : [];

  for (const p of promises) {
    const id = p?.id;
    const where = `promises.yaml ${id ?? '(no id)'}`;
    if (!nonEmpty(id)) {
      err('promises.yaml', 'a promise has no id');
      continue;
    }
    if (seen.has(id)) err(where, 'duplicate id');
    seen.add(id);

    const occ = occurrencesOf(p);
    if (!occ.length) err(where, 'no sources');
    for (const o of occ) {
      const src = sources[o.in];
      if (!src) {
        err(where, `no "${o.in}" source document in this term`);
        continue;
      }
      const resolved = resolveRef(src.parsed, o.ref);
      if (resolved.error) {
        err(where, resolved.error);
        continue;
      }
      if (!quoteFits(o.quote ?? '', resolved.text)) {
        (strict ? err : warn)(where, `quote is not a contiguous part of ${o.in} ${o.ref}`);
      }
      if (!inTurns(src, resolved)) {
        (strict ? err : warn)(where, `${o.in} ${o.ref} is outside the turns of "${src.label}"`);
      }
    }
    if (!strict) continue;

    // Full protocol-1 record.
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) err(where, 'id must be lowercase-kebab');
    if (!KINDS.includes(p.kind)) err(where, `kind must be one of ${KINDS.join('/')}`);
    if (!nonEmpty(p.restatement)) err(where, 'missing restatement');
    if (!TYPES.includes(p.type)) err(where, `type must be one of ${TYPES.join('/')}`);
    if (!THEMES.includes(p.theme)) err(where, `theme "${p.theme}" is not in the list`);
    if (p.group !== undefined && !nonEmpty(p.group)) err(where, 'group must be a non-empty string');
    if (!p.deadline || !('stated' in p.deadline)) err(where, 'deadline.stated is required (null if none)');
    if (!isDate(p.deadline?.applied)) err(where, 'deadline.applied must be a YYYY-MM-DD date');
    const v = p.verifiability ?? {};
    if (!LEVELS.includes(v.level)) err(where, `verifiability.level must be one of ${LEVELS.join('/')}`);
    if (v.level === 'high' || v.level === 'medium') {
      for (const f of ['object', 'record', 'criterion']) {
        if (!nonEmpty(v[f])) err(where, `a ${v.level} promise needs verifiability.${f}`);
      }
    }
    if (v.level === 'medium' && !nonEmpty(v.ambiguity)) {
      err(where, 'a medium promise needs verifiability.ambiguity (its judgement call)');
    }
    const u = p.uncertainty ?? {};
    if (!EXTRACTION.includes(u.extraction)) {
      err(where, `uncertainty.extraction must be one of ${EXTRACTION.join('/')}`);
    } else if (u.extraction !== 'clear' && !nonEmpty(u.note)) {
      err(where, `uncertainty "${u.extraction}" needs a note`);
    }
    if (!Array.isArray(p.links)) err(where, 'links must be a list (empty if none)');
    for (const l of p.links ?? []) {
      if (!LINK_KINDS.includes(l?.kind)) err(where, `link kind must be one of ${LINK_KINDS.join('/')}`);
      if (!allIds.has(l?.to) && !promises.some((q) => q?.id === l?.to)) {
        err(where, `link to unknown promise "${l?.to}"`);
      }
    }
  }

  if (!strict) {
    if (Object.keys(ledgers).length) {
      warn('promises.yaml', 'legacy format: ledger <-> promise cross-checks are skipped until re-extraction');
    }
    return { errors, warnings };
  }

  // ---- ledger <-> promises (protocol 1 only) ------------------------------
  for (const kind of Object.keys(sources)) {
    if (!ledgers[kind]) err(`${sources[kind].file}`, 'a re-extracted term needs a screening ledger for every source');
  }
  const byId = new Map(promises.map((p) => [p.id, p]));
  for (const [kind, ledger] of Object.entries(ledgers)) {
    for (const row of ledger.rows) {
      if (row.decision !== 'include') continue;
      for (const pid of row.promises) {
        const p = byId.get(pid);
        if (!p) {
          err(`${ledger.file} ${row.ref}`, `names unknown promise "${pid}"`);
          continue;
        }
        const cites = occurrencesOf(p).some((o) => o.in === kind && o.ref === row.ref);
        if (!cites) err(`${ledger.file} ${row.ref}`, `"${pid}" does not cite ${kind} ${row.ref}`);
      }
    }
  }
  for (const p of promises) {
    for (const o of occurrencesOf(p)) {
      const ledger = ledgers[o.in];
      if (!ledger) continue;
      const row = ledger.rows.find((r) => r.ref === o.ref);
      if (!row || row.decision !== 'include' || !row.promises.includes(p.id)) {
        err(`promises.yaml ${p.id}`, `${o.in} ${o.ref} has no include row naming this promise`);
      }
    }
  }
  return { errors, warnings };
}

/** Read every term directory under `corpusDir` and validate it. */
export function validateCorpus(corpusDir) {
  const terms = [];
  for (const name of readdirSync(corpusDir).sort()) {
    const dir = join(corpusDir, name);
    if (!statSync(dir).isDirectory() || !/^\d{4}-\d{4} /.test(name)) continue;
    const files = {};
    for (const f of readdirSync(dir)) {
      if (/\.(md|yaml)$/.test(f)) files[f] = readFileSync(join(dir, f), 'utf8');
    }
    terms.push({ name, files });
  }
  const allIds = new Set();
  for (const t of terms) {
    try {
      for (const p of parseYaml(t.files['promises.yaml'] ?? '')?.promises ?? []) {
        if (p?.id) allIds.add(p.id);
      }
    } catch {
      /* reported per term */
    }
  }
  const errors = [];
  const warnings = [];
  for (const t of terms) {
    const r = validateTerm(t.name, t.files, allIds);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }
  return { errors, warnings, terms: terms.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const corpus = join(dirname(fileURLToPath(import.meta.url)), '..', 'corpus');
  const { errors, warnings, terms } = validateCorpus(corpus);
  for (const w of warnings) console.warn(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  console.log(
    `${relative(process.cwd(), corpus) || 'corpus'}: ${terms} terms, ` +
      `${errors.length} errors, ${warnings.length} warnings`,
  );
  process.exit(errors.length ? 1 : 0);
}
