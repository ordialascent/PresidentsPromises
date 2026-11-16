import { useMemo } from 'react';
import { CORPUS_TERMS } from '../content/promises.generated.js';
import { VERDICT_META, VERDICT_STATUSES, trackRecords } from './model.js';

/**
 * Each president's verdicts in one row: a bar split by verdict, and the
 * counts. Only high and medium promises get a verdict, so the bar's length is
 * the term's verifiable promises, not all of them. Under-review verdicts are
 * counted apart until their figure is confirmed, and pending ones (term still
 * running) are never counted as kept or broken.
 */
export function TrackRecord() {
  const rows = useMemo(() => trackRecords(CORPUS_TERMS), []);
  const widest = Math.max(...rows.map((r) => r.verifiable), 1);

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
            <th scope="col" className="tr-n" title="Kept as a share of kept, partly and broken">
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
                <div
                  className="tr-bar"
                  style={{ width: `${(r.verifiable / widest) * 100}%` }}
                  role="img"
                  aria-label={VERDICT_STATUSES.map((s) => `${r.counts[s]} ${VERDICT_META[s].label.toLowerCase()}`).join(', ')}
                >
                  {VERDICT_STATUSES.map((s) =>
                    r.counts[s] ? (
                      <span
                        key={s}
                        className="tr-seg"
                        data-v={s}
                        style={{ flexGrow: r.counts[s] }}
                        title={`${r.counts[s]} ${VERDICT_META[s].label.toLowerCase()}`}
                      />
                    ) : null,
                  )}
                </div>
              </td>
              {VERDICT_STATUSES.map((s) => (
                <td key={s} className="tr-n" data-zero={r.counts[s] === 0}>
                  {r.counts[s]}
                </td>
              ))}
              <td className="tr-n tr-share">
                {r.settled ? `${Math.round((r.counts.kept / r.settled) * 100)}%` : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tr-note">
        High and medium promises only. <em>Kept</em> is the share of kept among kept, partly and
        broken; under-review, indeterminate and pending verdicts are left out of it. Open any
        promise below for its verdict and evidence.{' '}
        <a href="#method">How verdicts are reached</a>
      </p>
    </div>
  );
}
