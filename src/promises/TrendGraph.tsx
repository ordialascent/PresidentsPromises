import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { countAxis, trendPoints, type CorpusTerm, type Kind } from './model.js';

const HEIGHT = 200;
// No side padding: the plot runs edge to edge, flush with the settings bar
// above it, and the axis numbers sit inside it, just above their gridlines.
const PAD = { top: 12, right: 0, bottom: 38, left: 0 };

type Line = 'kept' | 'broken' | 'other';
const LINES: { key: Line; label: string }[] = [
  { key: 'kept', label: 'kept' },
  { key: 'broken', label: 'broken' },
  { key: 'other', label: 'other' },
];
/** Paint order: where lines cross, other sits at the back and broken in front. */
const DRAW_ORDER: Line[] = ['other', 'kept', 'broken'];

/**
 * The board at a glance: one column per term, oldest on the left. The shaded
 * area is how many promises each term made that can be checked (verifiable);
 * the lines are how those turned out: kept, broken, and everything else
 * (partly kept, indeterminate, under review, pending). Counts, not shares, so
 * a term that promised more stands taller. Ambitions never get verdicts, so
 * for them only the area is drawn.
 */
export function TrendGraph({ terms, kind }: { terms: CorpusTerm[]; kind: Kind }) {
  const points = useMemo(() => trendPoints(terms), [terms]);
  const withVerdicts = kind === 'promise';
  const noun = kind === 'promise' ? 'promises' : 'ambitions';

  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth || 640);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (points.length === 0) return null;

  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = plotW / points.length;
  const { top, step } = countAxis(Math.max(...points.map((p) => p.verifiable)));
  const x = (i: number) => PAD.left + band * (i + 0.5);
  const y = (n: number) => PAD.top + plotH - (n / top) * plotH;
  const base = y(0);

  // The area runs flat to the outer edges, so the first and last terms read
  // as wide as the others.
  const areaTop = points.map((p, i) => `${x(i)},${y(p.verifiable)}`);
  const area = [
    `${PAD.left},${base}`,
    `${PAD.left},${y(points[0].verifiable)}`,
    ...areaTop,
    `${PAD.left + plotW},${y(points[points.length - 1].verifiable)}`,
    `${PAD.left + plotW},${base}`,
  ].join(' ');
  const edge = [
    `${PAD.left},${y(points[0].verifiable)}`,
    ...areaTop,
    `${PAD.left + plotW},${y(points[points.length - 1].verifiable)}`,
  ].join(' ');

  const ticks: number[] = [];
  for (let n = 0; n <= top; n += step) ticks.push(n);

  // Wide bands carry the name and the years; narrow ones only the first year.
  const wide = band >= 76;

  const summary = points
    .map((p) =>
      withVerdicts
        ? `${p.label}: ${p.verifiable} verifiable, ${p.kept} kept, ${p.broken} broken, ${p.other} other`
        : `${p.label}: ${p.verifiable} verifiable`,
    )
    .join('; ');

  return (
    <div className="tg" ref={ref}>
      <svg
        className="tg-svg"
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={`Verifiable ${noun} per term${withVerdicts ? ' and how they turned out' : ''}. ${summary}.`}
      >
        {points.map((p, i) =>
          i % 2 === 1 ? (
            <rect key={p.key} className="tg-band" x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} />
          ) : null,
        )}
        {ticks.map((n) => (
          <g key={n}>
            <line className="tg-grid" x1={PAD.left} x2={PAD.left + plotW} y1={y(n)} y2={y(n)} />
            {n > 0 && (
              <text className="tg-tick" x={PAD.left + 2} y={y(n) - 4}>
                {n}
              </text>
            )}
          </g>
        ))}

        <polygon className="tg-area" points={area} />
        <polyline className="tg-area-edge" points={edge} />

        {withVerdicts &&
          DRAW_ORDER.map((key) => (
            <g key={key} className="tg-line" data-line={key}>
              {points.length > 1 && <polyline points={points.map((p, i) => `${x(i)},${y(p[key])}`).join(' ')} />}
              {points.map((p, i) => (
                <circle key={p.key} cx={x(i)} cy={y(p[key])} r={3} />
              ))}
            </g>
          ))}

        {points.map((p, i) => (
          <g key={p.key}>
            <text className="tg-term" x={x(i)} y={base + 15} textAnchor="middle">
              {wide ? p.surname : `’${String(p.from).slice(-2)}`}
            </text>
            {wide && (
              <text className="tg-years" x={x(i)} y={base + 29} textAnchor="middle">
                {p.termLabel}
              </text>
            )}
            {/* the whole column carries the term's numbers as a hint */}
            <rect className="tg-hit" x={PAD.left + band * i} y={PAD.top} width={band} height={plotH + PAD.bottom}>
              <title>
                {`${p.label} (${p.termLabel})\n${p.verifiable} verifiable ${noun}` +
                  (withVerdicts
                    ? '\n' + LINES.map((l) => `${p[l.key]} ${l.label}`).join(' · ')
                    : '')}
              </title>
            </rect>
          </g>
        ))}
      </svg>
    </div>
  );
}
