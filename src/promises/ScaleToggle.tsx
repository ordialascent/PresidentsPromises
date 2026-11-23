import type { Scale } from './PromiseFunnel.js';

/** How the chart's bars are measured: one shared count scale, or shares of each term. */
export function ScaleToggle({ scale, onScale }: { scale: Scale; onScale: (s: Scale) => void }) {
  return (
    <div className="kind-switch" role="group" aria-label="Chart scale">
      {(['count', 'percent'] as Scale[]).map((m) => (
        <button
          key={m}
          type="button"
          data-on={scale === m}
          aria-pressed={scale === m}
          title={
            m === 'count'
              ? 'One scale for every bar: longer means more promises'
              : 'Every bar fills the width: lengths are shares'
          }
          onClick={() => onScale(m)}
        >
          {m === 'count' ? 'Count' : 'Percent'}
        </button>
      ))}
    </div>
  );
}
