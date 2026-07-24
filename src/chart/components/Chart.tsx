import * as React from 'react';
import type { Period, ScopePreset, SeriesPoint, YScaleMode } from '../types.js';
import type { Derivation } from '../logic/deriveVerdict.js';
import { linearScale, niceTicks } from '../logic/scale.js';
import { pointsInWindow, yDomain } from '../logic/resolve.js';

export interface ChartProps {
  series: SeriesPoint[];
  periods?: Period[];
  currentWindow: ScopePreset;
  defaultWindow: ScopePreset;
  yMode: YScaleMode;
  baseline: { value: number; x: number; decoupled: boolean };
  derivation: Derivation;
  formatValue: (n: number) => string;
  formatX: (x: number) => string;
}

const W = 860;
const H = 440;
const M = { top: 30, right: 88, bottom: 42, left: 68 };

export function Chart(props: ChartProps): React.ReactElement {
  const { series, periods, currentWindow, defaultWindow, yMode, baseline, derivation } = props;
  const { formatValue, formatX } = props;
  const { target, observed, outcome, deadlineX } = derivation;

  const plotLeft = M.left;
  const plotRight = W - M.right;
  const plotTop = M.top;
  const plotBottom = H - M.bottom;

  const x = linearScale([currentWindow.xMin, currentWindow.xMax], [plotLeft, plotRight]);
  const extra = [baseline.value, target, ...(observed !== null ? [observed] : [])];
  const [yMin, yMax] = yDomain(series, currentWindow, defaultWindow, yMode, extra);
  const y = linearScale([yMin, yMax], [plotBottom, plotTop]);

  const inWindow = pointsInWindow(series, currentWindow).sort((a, b) => a.x - b.x);
  const linePath = inWindow
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.x).toFixed(2)} ${y(p.y).toFixed(2)}`)
    .join(' ');

  const yTicks = niceTicks(yMin, yMax, 5);
  const xTicks =
    inWindow.length > 0 && inWindow.length <= 14
      ? inWindow.map((p) => p.x)
      : niceTicks(currentWindow.xMin, currentWindow.xMax, 8).filter(
          (t) => t >= currentWindow.xMin && t <= currentWindow.xMax,
        );

  const showZero = yMin < 0 && yMax > 0;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const bx = clamp(x(baseline.x), plotLeft, plotRight);
  const by = y(baseline.value);
  const dx = clamp(x(deadlineX), plotLeft, plotRight);
  const ty = y(target);
  const oy = observed !== null ? y(observed) : null;

  return (
    <svg
      className="ag-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Parametric target chart"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* period bands, drawn behind everything, alternating emphasis */}
      <g>
        {(periods ?? []).map((band, i) => {
          const x0 = clamp(x(band.x0), plotLeft, plotRight);
          const x1 = clamp(x(band.x1), plotLeft, plotRight);
          if (x1 <= plotLeft || x0 >= plotRight || x1 - x0 < 0.5) return null;
          return (
            <g key={`${band.label}-${i}`}>
              <rect
                className={i % 2 === 0 ? 'ag-band-a' : 'ag-band-b'}
                x={x0}
                y={plotTop}
                width={x1 - x0}
                height={plotBottom - plotTop}
              />
              <text className="ag-band-label" x={(x0 + x1) / 2} y={plotTop - 8} textAnchor="middle">
                {band.label}
              </text>
            </g>
          );
        })}
      </g>

      {/* y gridlines */}
      <g className="ag-axis">
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line className="ag-grid" x1={plotLeft} x2={plotRight} y1={y(t)} y2={y(t)} />
            <text x={plotLeft - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
              {formatValue(t)}
            </text>
          </g>
        ))}
        {showZero && <line className="ag-zero" x1={plotLeft} x2={plotRight} y1={y(0)} y2={y(0)} />}
      </g>

      {/* x ticks */}
      <g className="ag-axis">
        {xTicks.map((t) => (
          <text key={`x${t}`} x={x(t)} y={plotBottom + 16} textAnchor="middle">
            {formatX(t)}
          </text>
        ))}
      </g>

      {/* series */}
      <path className="ag-series-line" d={linePath} />
      {inWindow.length <= 40 &&
        inWindow.map((p) => (
          <circle key={`p${p.x}`} className="ag-series-dot" cx={x(p.x)} cy={y(p.y)} r={2.4} />
        ))}

      {/* target chord (dashed) from baseline to target */}
      <line className="ag-target-chord" x1={bx} y1={by} x2={dx} y2={ty} />

      {/* actual chord (solid) + gap bar, only when there is an observation */}
      {oy !== null && (
        <>
          <line className="ag-actual-chord" x1={bx} y1={by} x2={dx} y2={oy} />
          <line className="ag-gap" data-outcome={outcome} x1={dx} y1={ty} x2={dx} y2={oy} />
        </>
      )}

      {/* deadline guide when there is no observation */}
      {oy === null && (
        <g>
          <line
            x1={dx}
            x2={dx}
            y1={plotTop}
            y2={plotBottom}
            stroke="var(--ag-dim)"
            strokeDasharray="3 4"
            opacity={0.6}
          />
          <text className="ag-mark-label ag-mark-label-dim" x={dx + 6} y={plotTop + 12}>
            no observation
          </text>
        </g>
      )}

      {/* start dot */}
      <circle
        className="ag-dot-start"
        data-decoupled={baseline.decoupled}
        cx={bx}
        cy={by}
        r={4}
      />
      <text className="ag-mark-label" x={bx - 8} y={by - 8} textAnchor="end">
        {formatValue(baseline.value)}
        {baseline.decoupled ? ' *' : ''}
      </text>

      {/* target dot */}
      <circle className="ag-dot-target" cx={dx} cy={ty} r={4} />
      <text className="ag-mark-label" x={dx + 8} y={ty} dominantBaseline="middle">
        {formatValue(target)}
      </text>

      {/* actual dot */}
      {oy !== null && (
        <>
          <circle className="ag-dot-actual" data-outcome={outcome} cx={dx} cy={oy} r={4} />
          <text className="ag-mark-label" x={dx + 8} y={oy} dominantBaseline="middle">
            {formatValue(observed as number)}
          </text>
        </>
      )}
    </svg>
  );
}
