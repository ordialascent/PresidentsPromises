import { CORPUS_TERMS } from '../content/promises.generated.js';
import {
  CHECKS,
  CHECK_META,
  VERDICT_META,
  VERDICT_STATUSES,
  methodRows,
  type Check,
  type VerdictValue,
} from '../promises/model.js';
import { EXCLUSIONS, THEMES } from './method.js';

const REPO = 'https://github.com/ordialascent/PresidentsPromises';
const PROTOCOL_URL = `${REPO}/blob/main/corpus/PROTOCOL.md`;
const CORPUS_URL = `${REPO}/tree/main/corpus`;

const ROWS = methodRows(CORPUS_TERMS);

/** Where the line between verifiable and unverifiable falls (corpus/PROTOCOL.md §4). */
const CHECK_RULE: Record<Check, string> = {
  verifiable:
    'Object and record are clear, and the words fix what counts as kept, or leave at most one judgement call. That call is written down on the promise. Every verifiable promise gets a verdict.',
  unverifiable:
    'The object or the record is missing, or checking it would need more than one judgement call. It never gets a verdict.',
};
const FIRST = CORPUS_TERMS[0];
const LAST = CORPUS_TERMS[CORPUS_TERMS.length - 1];

/** When each verdict is given (corpus/PROTOCOL.md §6). */
const VERDICT_RULE: Record<VerdictValue | 'review', string> = {
  kept: 'The criterion was met by the deadline. For a promise about conduct, it held for the whole term.',
  partly: 'Met only in part: some of the object, a smaller amount, or only for a limited time. The verdict says which part is missing.',
  broken: 'Not met by the deadline, or the opposite was done.',
  indeterminate: 'The record does not settle it: the evidence is missing or conflicts. The verdict says what is missing.',
  review: 'A provisional verdict whose deciding figure is being confirmed against the official record.',
  pending: 'The term is still running and the criterion is not yet met. Reviewed when the deadline passes.',
};

/**
 * How a sentence in a speech becomes a promise on the board, and how that
 * promise is rated. This is the reader's version of corpus/PROTOCOL.md: the
 * same rules, in the same order, with the protocol linked for the full text.
 * The table of counts is computed from the corpus, so it can never drift from
 * what the board shows.
 */
export function MethodPage() {
  return (
    <div className="page method">
      <header className="masthead">
        <a className="method-back" href="#">
          ← All promises
        </a>
        <h1>How promises are chosen, rated and judged</h1>
        <p className="subtitle">
          Every promise on this site comes from the same kinds of speeches, is found by the same
          written rules and is rated on the same scale, for every president. This page explains
          those rules. The full protocol is{' '}
          <a href={PROTOCOL_URL} target="_blank" rel="noreferrer">
            published with the data
          </a>
          .
        </p>
      </header>

      <main className="method-body">
        <section>
          <h2>1. Sources</h2>
          <p>Each presidential term is read from the same three sources:</p>
          <ul>
            <li>the <strong>nomination acceptance speech</strong>,</li>
            <li>the <strong>final general-election debate</strong> (only the winner’s turns),</li>
            <li>the <strong>inaugural address</strong>.</li>
          </ul>
          <p>
            Every president gives these, so every president is read from the same kind of material.
            Interviews, rallies, summits and press releases are not used, because not every president
            has a comparable one. The texts are kept verbatim from{' '}
            <em>The American Presidency Project</em> (UC Santa Barbara), with each sentence numbered,
            so every promise can cite the exact sentence it came from.
          </p>
          <p>
            The collection covers {CORPUS_TERMS.length} terms, from {FIRST.label} ({FIRST.termLabel}) to{' '}
            {LAST.label} ({LAST.termLabel}). Earlier terms are added one at a time, back to the 1976
            election, the first since 1960 with televised debates between the nominees.
          </p>
        </section>

        <section>
          <h2>2. Finding candidates</h2>
          <p>
            Every sentence is read. A sentence becomes a <em>candidate</em> when it contains a
            commitment phrase, or when a reader sees a commitment without one.
          </p>
          <ul>
            <li>
              <strong>Firm phrases:</strong> “I will”, “we will”, “we’re going to”, “I won’t”, “on day
              one”, “I pledge”, “I promise” and similar.
            </li>
            <li>
              <strong>Soft phrases:</strong> “we must”, “we need to”, “I want to”, “we should”, “I hope
              to”, “there has to be” and similar.
            </li>
            <li>
              <strong>Added by reading:</strong> a future statement with no trigger word, such as
              “People will be able to take their HMO to court”. These are marked as added.
            </li>
          </ul>
          <p>
            Every sentence that matches a phrase gets a recorded decision, including the ones left out
            and why. A validator re-runs the phrase list and fails if any match is missing a decision,
            so nothing is skipped silently.
          </p>
        </section>

        <section>
          <h2>3. Promise, ambition, or neither</h2>
          <p>A candidate is kept when all of these hold:</p>
          <ul>
            <li><strong>Speaker:</strong> the president says it in their own voice.</li>
            <li>
              <strong>Committer:</strong> the subject is the president, their administration, or a
              “we” that includes the government they will lead.
            </li>
            <li><strong>Future:</strong> it is about something to be done after the speech.</li>
          </ul>
          <p>
            The wording then decides the kind. Firm language (“we will reform Social Security”) makes
            it a <strong>promise</strong>. Soft language (“we must reform Social Security”) makes it an{' '}
            <strong>ambition</strong>. The line is drawn by the words alone, the same way for everyone.
            Ambitions are recorded and rated, but never get a kept/broken verdict.
          </p>
          <p>Everything else is left out, with one of these reasons:</p>
          <table className="method-table">
            <thead>
              <tr>
                <th scope="col">Reason</th>
                <th scope="col">Meaning</th>
                <th scope="col">Example</th>
              </tr>
            </thead>
            <tbody>
              {EXCLUSIONS.map(([code, meaning, example]) => (
                <tr key={code}>
                  <th scope="row">{code}</th>
                  <td>{meaning}</td>
                  <td className="method-example">{example}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Vague promises are <em>not</em> left out. “We will defend our allies” is a promise; it is
            rated unverifiable. How much of a president’s language cannot be checked is part of what this site
            shows.
          </p>
        </section>

        <section>
          <h2>4. One promise, one verdict</h2>
          <p>A promise is cut so that it has one object that could get one verdict.</p>
          <ul>
            <li>
              <strong>Split:</strong> “We will reform Social Security and Medicare” becomes two
              promises, because one could be kept and the other not. Each part still shows the whole
              sentence, with its own words highlighted.
            </li>
            <li>
              <strong>Keep together:</strong> two verbs on one object that name one act stay one promise,
              as in “reform and simplify the tax code” or “repeal and replace Obamacare”. If only part is
              done, the verdict is “partly”.
            </li>
            <li><strong>Join:</strong> consecutive sentences stating one commitment are cited together.</li>
            <li>
              <strong>Merge:</strong> the same commitment said again in the same term is one promise with
              several quotes. The ×2, ×3 tag in the list counts them.
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Rating verifiability</h2>
          <p>
            Each promise is either <strong>verifiable</strong> or <strong>unverifiable</strong>. Three
            questions decide which:
          </p>
          <ul>
            <li><strong>Object:</strong> is it clear what the promise is about (a law, a programme, a quantity)?</li>
            <li>
              <strong>Record:</strong> is there a public record that shows what happened (a statute, a
              budget, an official statistic, a treaty)?
            </li>
            <li>
              <strong>Criterion:</strong> do the words fix what counts as kept: the act itself, a
              number or direction, or an observable conduct?
            </li>
          </ul>
          <table className="method-table method-levels">
            <thead>
              <tr>
                <th scope="col">Rating</th>
                <th scope="col">Rule</th>
              </tr>
            </thead>
            <tbody>
              {CHECKS.map((c) => (
                <tr key={c}>
                  <th scope="row">
                    <span className="veri-swatch method-swatch" data-c={c} aria-hidden="true" />
                    {CHECK_META[c].label}
                  </th>
                  <td>{CHECK_RULE[c]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="method-note">
            The published records keep one finer note inside “verifiable”: whether the words fix
            the criterion fully (<code>high</code>) or need the one judgement call{' '}
            (<code>medium</code>). Unverifiable promises are recorded as <code>low</code>. The site
            draws only the line that decides whether a verdict is possible.
          </p>
          <p>
            Verifiability rates the sentence, not the president. Each promise also records its{' '}
            <strong>type</strong> (an action, an outcome, or ongoing conduct), one{' '}
            <strong>topic</strong> from a fixed list, and its <strong>deadline</strong>: a date in the
            words if there is one, otherwise the end of the term. “Immediately” and “very quickly” are
            shown as said, but give no checkable date.
          </p>
          <p className="method-themes">
            Topics: {THEMES.join(' · ')}
          </p>
        </section>

        <section>
          <h2>6. Marking uncertainty</h2>
          <p>
            Language is ambiguous, so doubt is recorded, not hidden. A promise whose reading is not
            clear-cut is marked <em>probable</em> or <em>contested</em>, with a note on why: an unclear
            subject, an unclear scope, or a word like “it” that could point to more than one thing. A
            verifiable promise that needs a judgement call shows it. When a rule is unclear, the sentence is included
            and the doubt is noted, rather than quietly left out.
          </p>
          <p>
            Promises are also linked: when a president <strong>repeats</strong> a promise in a later
            term, when one promise <strong>sharpens</strong> another by adding a number or date, and
            when another president made the <strong>same</strong> commitment.
          </p>
        </section>

        <section>
          <h2>7. Kept or broken</h2>
          <p>
            Every verifiable promise gets one verdict. Unverifiable promises and ambitions never get one.
            The verdict answers one question: <strong>was the criterion met by the deadline?</strong>{' '}
            It is judged against the criterion shown with the promise, never against what the speaker
            later said the promise meant.
          </p>
          <div className="method-scroll">
            <table className="method-table">
              <tbody>
                {VERDICT_STATUSES.map((s) => (
                  <tr key={s}>
                    <th scope="row">{VERDICT_META[s].label}</th>
                    <td>{VERDICT_RULE[s]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>The same rules apply to every president:</p>
          <ul>
            <li>
              <strong>What happened, not who is to blame.</strong> A promise that needed Congress and
              did not pass is broken, even if the president fought for it. How far the president got
              is shown separately as the <em>attempt</em>: no formal step, initiated (a bill, budget
              request or order), or passed one chamber.
            </li>
            <li>
              <strong>Judged at the deadline.</strong> Later events do not change a verdict: a law
              repealed later still counts as kept, and a law passed in a later term does not count.
            </li>
            <li>
              <strong>An action counts once done.</strong> Signing, enacting or ordering is enough; its
              later effects are not part of the verdict.
            </li>
            <li>
              <strong>An outcome</strong> is judged on the official figure for the last full year or
              month before the deadline, with the series named.
            </li>
            <li>
              <strong>Partial delivery is “partly”,</strong> never rounded up to kept.
            </li>
            <li>
              A <strong>conditional</strong> promise is judged only if its condition arose.
            </li>
          </ul>
          <p>
            Every verdict cites its evidence with a link, preferring primary records (the statute, the
            Federal Register, an agency’s own data); secondary sources are marked. Doubt is marked as
            for extraction: <em>probable</em> or <em>contested</em>, with the other reading named.
          </p>
          <p>
            Some official sites cannot always be read directly. When a verdict rests on a figure that
            still has to be confirmed against such a site, it is shown as <strong>under review</strong>,
            with its provisional reading and the exact figure being checked, and it is left out of the
            kept share until confirmed.
          </p>
        </section>

        <section>
          <h2>8. The numbers</h2>
          <p>
            Every sentence screened in each term, how it was decided, and what came out. Computed from
            the published records.
          </p>
          <div className="method-scroll">
            <table className="method-table method-counts">
              <thead>
                <tr>
                  <th scope="col">Term</th>
                  <th scope="col">Screened</th>
                  <th scope="col">Included</th>
                  <th scope="col">Left out</th>
                  <th scope="col">Promises</th>
                  <th scope="col">Verifiable</th>
                  <th scope="col">Unverifiable</th>
                  <th scope="col">Ambitions</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.key}>
                    <th scope="row">{r.label}</th>
                    <td>{r.screened}</td>
                    <td>{r.included}</td>
                    <td title={r.excludedBy.map(([d, n]) => `${d}: ${n}`).join(', ')}>{r.excluded}</td>
                    <td>{r.promises}</td>
                    <td>{r.tiers.high + r.tiers.medium}</td>
                    <td>{r.tiers.low}</td>
                    <td>{r.ambitions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="method-note">
            “Screened” counts recorded decisions, one per candidate sentence. One sentence can hold
            several promises, and one promise can be said in several sentences, so the columns do not
            add up to each other. Speeches differ in length, which is why counts are best compared as
            shares, as the chart’s percent view does.
          </p>
        </section>

        <section>
          <h2>9. Known limits</h2>
          <ul>
            <li>
              Two careful readers will sometimes disagree. A second, independent reading of a sample
              is planned, and its agreement rate will be reported here. It has not been measured yet.
            </li>
            <li>
              Where the line between verifiable and unverifiable falls is the most judgement-heavy step, and is
              re-checked across all terms in regular audits.
            </li>
            <li>
              Verdicts on a term still running are mostly pending. They are reviewed when their
              deadline passes, which is the end of the term unless the promise names another date.
              Until then the term’s kept share counts only what is decided so far, mostly early, quick
              actions, so it is shown as provisional (“so far”) and should not be compared with
              finished terms.
            </li>
            <li>
              Debates differ from cycle to cycle in format and length; only the final one is used.
            </li>
          </ul>
        </section>

        <section>
          <h2>Check it yourself</h2>
          <p>
            The{' '}
            <a href={PROTOCOL_URL} target="_blank" rel="noreferrer">
              extraction protocol
            </a>
            , every{' '}
            <a href={CORPUS_URL} target="_blank" rel="noreferrer">
              source text, screening decision and promise record
            </a>{' '}
            and the validator that checks them are public. Every promise on the board cites the
            numbered sentence (for example ¶12.2: paragraph 12, sentence 2) it came from.
          </p>
        </section>
      </main>
    </div>
  );
}
