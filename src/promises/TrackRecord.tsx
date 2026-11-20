import { useMemo } from 'react';
import {
  VERDICT_META,
  VERDICT_STATUSES,
  trackRecords,
  type CorpusTerm,
  type VerdictValue,
} from './model.js';

type Status = VerdictValue | 'review';

/**
 * Each president's verdicts in one row: a bar split by verdict, and the
 * counts. Only high and medium promises get a verdict, so the bar's length is
 * the term's verifiable promises, not all of them. Under-review verdicts are
 * counted apart until their figure is confirmed, and pending ones (term still
 * running) are never counted as kept or broken. While a term has pending
 * verdicts its kept share covers only what is decided so far, so it is marked
 * as provisional and says how many verdicts it rests on.
 *
 * It always counts the whole corpus. A click on a bar section or a count sets
 * the list's term and verdict filters to that cell; clicking it again clears
 * them. `lit` says which cells the list's filters currently cover, or is null
 * when they don't narrow by term or verdict.
 */
export function TrackRecord({
  terms,
  lit,
  picked,
  onSelect,
}: {
  terms: CorpusTerm[];
  lit: ((termKey: string, s: Status) => boolean) | null;
  /** Whether this exact cell, and nothing else, is what the filters hold. */
  picked: (termKey: string, s: Status) => boolean;
  onSelect: (termKey: string, s: Status) => void;
}) {
  const rows = useMemo(() => trackRecords(terms), [terms]);
  const widest = Math.max(...rows.map((r) => r.verifiable), 1);
  const isOn = picked;
  const pick = onSelect;

  if (rows.every((r) => r.verifiable === 0)) {
    return (
      <p className="tr-note">
        No verdicts in this selection: only high and medium promises get one.
      </p>
    );
  }

  return (
    <div className="tr">
      <ul className="tr-legend" aria-label="Verdicts">
        {VERDICT_STATUSES.map((s) => (
          <li key={s} title={VERDICT_META[s].blurb}>
            <span className="tr-swatch" data-v={s} aria-hidden="true" />
            {VERDICT_META[s].label}
          </li>
        ))}
      </ul>
      <table className="tr-table">
        <thead>
          <tr>
            <th scope="col">Term</th>
            <th scope="col" className="tr-bar-col">
              <span className="sr-only">Verdicts</span>
            </th>
            {VERDICT_STATUSES.map((s) => (
              <th scope="col" key={s} className="tr-n" title={VERDICT_META[s].label}>
                <span className="tr-swatch" data-v={s} aria-hidden="true" />
                <span className="sr-only">{VERDICT_META[s].label}</span>
              </th>
            ))}
            <th scope="col" className="tr-n" title="Kept as a share of kept, partly and broken. Under review, indeterminate and pending are left out. High and medium promises only.">
              Kept
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">
                {r.label}
                <span className="tr-term">{r.termLabel}</span>
              </th>
              <td className="tr-bar-col">
                <div className="tr-bar" style={{ width: `${(r.verifiable / widest) * 100}%` }}>
                  {VERDICT_STATUSES.map((s) =>
                    r.counts[s] ? (
                      <button
                        type="button"
                        key={s}
                        className="tr-seg"
                        data-v={s}
                        data-on={isOn(r.key, s)}
                        data-dim={lit != null && !lit(r.key, s)}
                        aria-pressed={isOn(r.key, s)}
                        style={{ flexGrow: r.counts[s] }}
                        title={`${r.label}: ${r.counts[s]} ${VERDICT_META[s].label.toLowerCase()}`}
                        aria-label={`${r.label}: show the ${r.counts[s]} ${VERDICT_META[s].label.toLowerCase()}`}
                        onClick={() => pick(r.key, s)}
                      />
                    ) : null,
                  )}
                </div>
              </td>
              {VERDICT_STATUSES.map((s) => (
                <td key={s} className="tr-n" data-zero={r.counts[s] === 0}>
                  {r.counts[s] ? (
                    <button
                      type="button"
                      className="tr-n-btn"
                      data-on={isOn(r.key, s)}
                      aria-pressed={isOn(r.key, s)}
                      aria-label={`${r.label}: show the ${r.counts[s]} ${VERDICT_META[s].label.toLowerCase()}`}
                      onClick={() => pick(r.key, s)}
                    >
                      {r.counts[s]}
                    </button>
                  ) : (
                    0
                  )}
                </td>
              ))}
              <td
                className="tr-n tr-share"
                data-provisional={r.counts.pending > 0}
                title={
                  r.counts.pending > 0
                    ? `So far: ${r.counts.kept} kept of ${r.settled} decided. ${r.counts.pending} of ${r.verifiable} are still pending, so this share can change a lot by the end of the term.`
                    : undefined
                }
              >
                {r.settled ? `${Math.round((r.counts.kept / r.settled) * 100)}%` : '–'}
                {r.counts.pending > 0 && (
                  <span className="tr-share-sub">
                    so far
                    <br />
                    {r.settled} of {r.verifiable}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.some((r) => r.counts.pending > 0) && (
        <p className="tr-note">
          For a term still running, the kept share covers only the verdicts decided so far. These are
          mostly quick actions taken early in the term; promises that take longer are still pending, so
          the share is provisional and not comparable with finished terms until the term ends.
        </p>
      )}
    </div>
  );
}
