import { CHECKS, CHECK_META, OTHER_STATUSES, VERDICT_META, type Check, type VerdictValue } from './model.js';

type Status = VerdictValue | 'review';

function hint(name: string, picked: boolean, others: number): string {
  if (!picked) return others === 0 ? `Show only ${name}` : `Add ${name}`;
  return others === 0 ? 'Show every promise again' : `Remove ${name}`;
}

/**
 * One key for both pictures: the graph above it and the bars below it.
 * Verifiable and unverifiable split each term's promises; kept, broken and
 * other (partly kept, indeterminate, under review, pending) say how the
 * verifiable ones turned out. Every chip also filters the list; "Other" picks
 * or clears its four together. Ambitions never get verdicts, so they show only
 * the first two.
 */
export function BoardLegend({
  withVerdicts,
  checkCounts,
  verdictCounts,
  pickedChecks,
  onToggleCheck,
  pickedVerdicts,
  onToggleVerdict,
  onSetVerdicts,
}: {
  withVerdicts: boolean;
  checkCounts: Record<Check, number>;
  verdictCounts: Record<Status, number>;
  pickedChecks: ReadonlySet<string>;
  onToggleCheck: (c: Check) => void;
  pickedVerdicts: ReadonlySet<string>;
  onToggleVerdict: (s: Status) => void;
  onSetVerdicts: (next: Set<string>) => void;
}) {
  const verdictChip = (s: Status, swatch: string = s) => {
    const on = pickedVerdicts.has(s);
    const name = VERDICT_META[s].label.toLowerCase();
    return (
      <button
        key={s}
        type="button"
        className="pc-legend-item"
        data-picked={on}
        aria-pressed={on}
        onClick={() => onToggleVerdict(s)}
        title={`${VERDICT_META[s].label}: ${VERDICT_META[s].blurb}. ${hint(name, on, pickedVerdicts.size - (on ? 1 : 0))}.`}
      >
        <span className="pc-swatch" data-v={swatch} />
        {VERDICT_META[s].label}
        <span className="pc-legend-n">{verdictCounts[s]}</span>
      </button>
    );
  };

  const otherOn = OTHER_STATUSES.every((s) => pickedVerdicts.has(s));
  const otherN = OTHER_STATUSES.reduce((n, s) => n + verdictCounts[s], 0);
  const toggleOther = () => {
    const next = new Set(pickedVerdicts);
    for (const s of OTHER_STATUSES) {
      if (otherOn) next.delete(s);
      else next.add(s);
    }
    onSetVerdicts(next);
  };

  return (
    <div className="bl" role="group" aria-label="Key, and filters for the list">
      <div className="pc-legend">
        {CHECKS.map((c) => {
          const on = pickedChecks.has(c);
          return (
            <button
              key={c}
              type="button"
              className="pc-legend-item"
              data-picked={on}
              aria-pressed={on}
              onClick={() => onToggleCheck(c)}
              title={`${CHECK_META[c].label}: ${CHECK_META[c].blurb}. ${hint(CHECK_META[c].label.toLowerCase(), on, pickedChecks.size - (on ? 1 : 0))}.`}
            >
              <span className="pc-swatch" data-c={c} />
              {CHECK_META[c].label}
              <span className="pc-legend-n">{checkCounts[c]}</span>
            </button>
          );
        })}
        {withVerdicts && verdictChip('kept')}
        {withVerdicts && verdictChip('broken')}
      </div>
      {withVerdicts && (
        <div className="pc-legend">
          <div className="bl-group" data-picked={otherOn} role="group" aria-label="Other: everything not kept or broken">
            <button
              type="button"
              className="pc-legend-item bl-group-head"
              data-picked={otherOn}
              aria-pressed={otherOn}
              onClick={toggleOther}
              title={`Other: partly kept, indeterminate, under review and pending. ${otherOn ? 'Remove all four' : 'Show all four'}.`}
            >
              <span className="pc-swatch" data-v="other" />
              Other
              <span className="pc-legend-n">{otherN}</span>
            </button>
            {OTHER_STATUSES.map((s) => verdictChip(s))}
          </div>
        </div>
      )}
    </div>
  );
}
