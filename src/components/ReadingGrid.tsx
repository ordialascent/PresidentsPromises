import type { Outcome } from 'ambiguity-graphs';
import { baselineChoices, deadlineChoices, formatUSD, readAt } from '../claim/obamaDeficit2009.js';

const BADGE: Record<Outcome, string> = {
  met: 'MET',
  missed: 'MISSED',
  indeterminate: 'NO OBS.',
};
const GLYPH: Record<Outcome, string> = {
  met: '✓',
  missed: '✕',
  indeterminate: '—',
};

/**
 * The four defensible readings, shown at once so the flip is visible no matter
 * where the interactive knobs happen to sit. Three read missed, one reads met;
 * the single met cell is (recorded FY2009 baseline, FY2013 deadline). The
 * product does not pick one.
 */
export function ReadingGrid() {
  return (
    <div className="grid" role="table" aria-label="The four readings">
      <div className="grid-cell grid-corner" role="columnheader">
        baseline &nbsp;\&nbsp; deadline
      </div>
      {deadlineChoices.map((d) => (
        <div className="grid-cell grid-head" role="columnheader" key={d.label}>
          {d.label}
        </div>
      ))}

      {baselineChoices.map((b) => (
        <ReadingRow key={b.label} baselineLabel={b.label} baselineValue={b.value} />
      ))}
    </div>
  );
}

function ReadingRow(props: { baselineLabel: string; baselineValue: number }) {
  return (
    <>
      <div className="grid-cell grid-head" role="rowheader">
        {props.baselineLabel}
      </div>
      {deadlineChoices.map((d) => {
        const r = readAt(props.baselineValue, d.x, d.label);
        return (
          <div className="grid-cell grid-reading" role="cell" key={d.label} data-outcome={r.outcome}>
            <span className="grid-badge" data-outcome={r.outcome}>
              <span aria-hidden="true">{GLYPH[r.outcome]}</span> {BADGE[r.outcome]}
            </span>
            <span className="grid-math">
              target {formatUSD(r.target)} · @{d.label}{' '}
              {r.observed === null ? '—' : formatUSD(r.observed)}
              {r.observed !== null && r.distance !== null
                ? ` · ${r.distanceWord} ${formatUSD(r.distance)}`
                : ''}
            </span>
          </div>
        );
      })}
    </>
  );
}
