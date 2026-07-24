import type { Outcome } from '../chart/index.js';
import { formatUSD, readAt } from '../content/deficit.js';
import type { PromiseSpec, Topic } from '../content/types.js';

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
 * Every defensible reading of one promise, shown at once so the flip is visible
 * no matter where the interactive knobs sit. The product does not pick one.
 * Rows are the promise's baseline candidates; columns its deadline candidates.
 */
export function ReadingGrid({ topic, promise }: { topic: Topic; promise: PromiseSpec }) {
  const deadlines = promise.deadlineCandidates;
  return (
    <div className="grid" role="table" aria-label="Every reading of this promise">
      <div className="grid-cell grid-corner" role="columnheader">
        baseline &nbsp;\&nbsp; deadline
      </div>
      {deadlines.map((d) => (
        <div className="grid-cell grid-head" role="columnheader" key={d.label}>
          {d.label}
        </div>
      ))}

      {promise.baselineCandidates.map((b) => (
        <ReadingRow key={b.label} topic={topic} promise={promise} baselineLabel={b.label} baselineValue={b.value} />
      ))}
    </div>
  );
}

function ReadingRow(props: {
  topic: Topic;
  promise: PromiseSpec;
  baselineLabel: string;
  baselineValue: number;
}) {
  return (
    <>
      <div className="grid-cell grid-head" role="rowheader">
        {props.baselineLabel}
      </div>
      {props.promise.deadlineCandidates.map((d) => {
        const r = readAt(props.topic, props.promise, props.baselineValue, d.x, d.label);
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
