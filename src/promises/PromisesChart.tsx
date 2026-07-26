import { useEffect, useMemo, useState } from 'react';
import {
  QUALITIES,
  QUALITY_META,
  deltaBetween,
  summarize,
  type CorpusPromise,
  type CorpusTerm,
  type Quality,
  type TermSummary,
} from './model.js';

type Mode = 'absolute' | 'percent';

// Geometry in SVG user units; the viewBox scales to the container width.
const VB_W = 960;
const PLOT_H = 340;
const PAD_TOP = 20;
const PAD_BOTTOM = 54; // room for the x-axis label rows
const BAR_W = 84;

interface SegBox {
  quality: Quality;
  count: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

interface BarLayout {
  summary: TermSummary;
  x: number;
  segs: SegBox[];
}

function layout(summaries: TermSummary[], mode: Mode): BarLayout[] {
  const maxTotal = Math.max(1, ...summaries.map((s) => s.total));
  const n = summaries.length;
  const step = VB_W / n;
  const baseY = PAD_TOP + PLOT_H;

  return summaries.map((summary, i) => {
    const x = i * step + (step - BAR_W) / 2;
    // percent view: each bar fills PLOT_H; count view: scaled to the tallest bar.
    const denom = mode === 'percent' ? Math.max(1, summary.total) : maxTotal;

    let cursor = baseY; // stack upward from the baseline
    const segs: SegBox[] = [];
    for (const quality of QUALITIES) {
      const count = summary.counts[quality];
      const h = (count / denom) * PLOT_H;
      const y = cursor - h;
      segs.push({ quality, count, x, y, w: BAR_W, h, cx: x + BAR_W / 2, cy: y + h / 2 });
      cursor = y;
    }
    return { summary, x, segs };
  });
}

function fmtDelta(value: number, mode: Mode): string {
  if (mode === 'percent') {
    const r = Math.round(value);
    return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r)}`;
  }
  return `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value)}`;
}

interface Selection {
  termKey: string;
  quality: Quality;
}

export function PromisesChart({
  terms,
  onOpenPromise,
}: {
  terms: CorpusTerm[];
  onOpenPromise?: (promise: CorpusPromise, term: TermSummary) => void;
}) {
  const [mode, setMode] = useState<Mode>('absolute');
  const [selected, setSelected] = useState<Selection | null>(null);

  // A change of `terms` means the topic filter changed — drop any open block
  // selection so the list panel can't point at a now-empty tier.
  useEffect(() => setSelected(null), [terms]);

  const summaries = useMemo(() => summarize(terms), [terms]);
  const bars = useMemo(() => layout(summaries, mode), [summaries, mode]);
  const totals = useMemo(() => {
    const c: Record<Quality, number> = { full: 0, partial: 0, no: 0 };
    for (const s of summaries) for (const q of QUALITIES) c[q] += s.counts[q];
    return c;
  }, [summaries]);

  const selectedBar = selected && bars.find((b) => b.summary.key === selected.termKey);
  const selectedList =
    selectedBar && selected
      ? selectedBar.summary.promises.filter((p) => p.quality === selected.quality)
      : [];
  // Show a per-promise source tag only once a term actually draws on more than
  // one source; while everything is from the acceptance speech it stays hidden.
  const showSource =
    !!selectedBar && new Set(selectedBar.summary.promises.map((p) => p.source.label)).size > 1;

  return (
    <div className="pc">
      <div className="pc-bar-top">
        <div className="pc-legend">
          {QUALITIES.map((q) => (
            <span key={q} className="pc-legend-item">
              <span className="pc-swatch" data-q={q} />
              {QUALITY_META[q].label}
              <span className="pc-legend-n">{totals[q]}</span>
            </span>
          ))}
        </div>
        <div className="pc-toggle" role="group" aria-label="Chart scale">
          {(['absolute', 'percent'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              data-on={mode === m}
              onClick={() => setMode(m)}
            >
              {m === 'absolute' ? 'Count' : 'Percent'}
            </button>
          ))}
        </div>
      </div>

      <svg
        className="pc-svg"
        viewBox={`0 0 ${VB_W} ${PAD_TOP + PLOT_H + PAD_BOTTOM}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Promises by president, stacked by measurability tier"
      >
        {/* connectors between adjacent bars, per tier */}
        {bars.slice(1).map((bar, i) => {
          const prev = bars[i]!;
          const d = deltaBetween(prev.summary, bar.summary);
          return QUALITIES.map((q) => {
            const a = prev.segs.find((s) => s.quality === q)!;
            const b = bar.segs.find((s) => s.quality === q)!;
            if (a.count === 0 && b.count === 0) return null;
            const x1 = a.x + a.w;
            const x2 = b.x;
            const mx = (x1 + x2) / 2;
            const my = (a.cy + b.cy) / 2;
            const delta = mode === 'percent' ? d[q].points : d[q].count;
            return (
              <g key={`${bar.summary.key}-${q}`} className="pc-link" data-q={q}>
                <line x1={x1} y1={a.cy} x2={x2} y2={b.cy} />
                <text x={mx} y={my - 4} className="pc-link-label" data-sign={Math.sign(delta)}>
                  {fmtDelta(delta, mode)}
                </text>
              </g>
            );
          });
        })}

        {/* bars */}
        {bars.map((bar) => (
          <g key={bar.summary.key}>
            {bar.segs.map((s) => {
              const on =
                selected?.termKey === bar.summary.key && selected?.quality === s.quality;
              if (s.count === 0) return null;
              return (
                <g key={s.quality} className="pc-seg-g">
                  <rect
                    className="pc-seg"
                    data-q={s.quality}
                    data-on={on}
                    x={s.x}
                    y={s.y}
                    width={s.w}
                    height={s.h}
                    onClick={() =>
                      setSelected(
                        on ? null : { termKey: bar.summary.key, quality: s.quality },
                      )
                    }
                  >
                    <title>
                      {bar.summary.label} · {QUALITY_META[s.quality].label}: {s.count}
                    </title>
                  </rect>
                  {s.h >= 16 && (
                    <text className="pc-seg-n" data-q={s.quality} x={s.cx} y={s.cy} dy="0.32em">
                      {mode === 'percent'
                        ? `${Math.round((s.count / Math.max(1, bar.summary.total)) * 100)}%`
                        : s.count}
                    </text>
                  )}
                </g>
              );
            })}
            {/* x labels */}
            <text className="pc-x-name" x={bar.x + BAR_W / 2} y={PAD_TOP + PLOT_H + 20}>
              {bar.summary.surname}
            </text>
            <text className="pc-x-sub" x={bar.x + BAR_W / 2} y={PAD_TOP + PLOT_H + 36}>
              {bar.summary.speechYear ?? bar.summary.termLabel}
            </text>
            <text className="pc-x-total" x={bar.x + BAR_W / 2} y={PAD_TOP + PLOT_H + 50}>
              n={bar.summary.total}
            </text>
          </g>
        ))}
      </svg>

      {selected && selectedBar ? (
        <div className="pc-list">
          <div className="pc-list-head">
            <span>
              <strong>{selectedBar.summary.label}</strong> ·{' '}
              <span className="pc-list-q" data-q={selected.quality}>
                {QUALITY_META[selected.quality].label}
              </span>{' '}
              <span className="pc-list-sub">{QUALITY_META[selected.quality].blurb}</span>
            </span>
            <button type="button" className="pc-list-close" onClick={() => setSelected(null)}>
              ✕
            </button>
          </div>
          <ul>
            {selectedList.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="pc-promise"
                  onClick={() => onOpenPromise?.(p, selectedBar.summary)}
                >
                  <span className="pc-promise-theme">{p.theme}</span>
                  <span className="pc-promise-text">
                    {p.restatement}
                    {showSource && <span className="pc-promise-src">{p.source.label}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="pc-hint">
          Click any block to list its promises. Connecting lines show the tier-by-tier change
          from one president to the next ({mode === 'percent' ? 'percentage points' : 'count'}).
        </p>
      )}
    </div>
  );
}
