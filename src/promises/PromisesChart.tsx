import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  QUALITIES,
  QUALITY_META,
  deltaBetween,
  summarize,
  type CorpusTerm,
  type Quality,
  type TermSummary,
} from './model.js';

type Mode = 'absolute' | 'percent';

// Geometry in CSS pixels: the chart is drawn at the width of its container,
// one user unit per pixel, so labels keep their CSS size on every screen. When
// the container is too narrow for every term at MIN_STEP, the chart keeps that
// step and scrolls sideways instead of shrinking.
const DEFAULT_W = 860;
const PLOT_H = 340;
const PAD_TOP = 20;
const PAD_BOTTOM = 54; // room for the x-axis label rows
const MAX_BAR_W = 84;
const MIN_STEP = 64; // narrowest column that still fits a surname and a delta label

export interface Geometry {
  /** Width of the drawing; wider than the container when it has to scroll. */
  width: number;
  step: number;
  barW: number;
}

export function geometry(containerWidth: number, n: number): Geometry {
  const count = Math.max(1, n);
  const step = Math.max(MIN_STEP, containerWidth / count);
  const barW = Math.min(MAX_BAR_W, Math.round(step * 0.62));
  return { width: step * count, step, barW };
}

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

function layout(summaries: TermSummary[], mode: Mode, geo: Geometry): BarLayout[] {
  const maxTotal = Math.max(1, ...summaries.map((s) => s.total));
  const { step, barW: BAR_W } = geo;
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

/**
 * What the next click on this category does. Nothing picked means all of them,
 * so the first click narrows to one and a later click adds to the set — and
 * releasing the last one picked returns to all, which is worth saying before
 * the click rather than after.
 */
function legendHint(q: Quality, picked: ReadonlySet<string>): string {
  const name = QUALITY_META[q].label.toLowerCase();
  if (!picked.has(q)) {
    return picked.size === 0 ? `Show only ${name} promises` : `Add ${name} promises`;
  }
  return picked.size === 1 ? 'Show every category again' : `Remove ${name} promises`;
}

/**
 * The chart always draws the whole corpus of the current kind; it owns no
 * filter. The tier legend toggles the list's tier filter, and a block sets the
 * list's term and tier filters to that one cell (clicking it again clears
 * them). Blocks the list's filters leave out are dimmed.
 */
export function PromisesChart({
  terms,
  pickedTiers,
  onToggleTier,
  lit,
  picked,
  onSelect,
}: {
  terms: CorpusTerm[];
  /** The tiers the list is filtered to, which is what the legend lights. */
  pickedTiers: ReadonlySet<string>;
  onToggleTier: (quality: Quality) => void;
  /** Which blocks the list's filters cover; null when they don't narrow by term or tier. */
  lit: ((termKey: string, q: Quality) => boolean) | null;
  /** Whether this exact block, and nothing else, is what the filters hold. */
  picked: (termKey: string, q: Quality) => boolean;
  onSelect: (termKey: string, q: Quality) => void;
}) {
  const [mode, setMode] = useState<Mode>('absolute');

  const totals = useMemo(() => {
    const c: Record<Quality, number> = { high: 0, medium: 0, low: 0 };
    for (const t of terms) for (const p of t.promises) c[p.quality] += 1;
    return c;
  }, [terms]);

  const summaries = useMemo(() => summarize(terms), [terms]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(DEFAULT_W);
  // Which sides have more to scroll to; each gets a soft edge.
  const [more, setMore] = useState({ left: false, right: false });
  const checkEnd = () => {
    const el = scrollRef.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setMore((m) => (m.left === left && m.right === right ? m : { left, right }));
  };
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      setContainerW(el.clientWidth || DEFAULT_W);
      checkEnd();
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => geometry(containerW, summaries.length), [containerW, summaries.length]);
  const bars = useMemo(() => layout(summaries, mode, geo), [summaries, mode, geo]);
  // Newest terms first: when the chart is wider than its box, open it scrolled
  // to the right end, and again whenever the terms or the width change.
  const termKeys = terms.map((t) => t.key).join('|');
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
    checkEnd();
  }, [geo.width, termKeys]);
  const BAR_W = geo.barW;
  const height = PAD_TOP + PLOT_H + PAD_BOTTOM;

  return (
    <div className="pc">
      <div className="pc-bar-top">
        <div className="pc-legend" role="group" aria-label="Filter by tier">
          {QUALITIES.map((q) => (
            <button
              key={q}
              type="button"
              className="pc-legend-item"
              data-picked={pickedTiers.has(q)}
              aria-pressed={pickedTiers.has(q)}
              onClick={() => onToggleTier(q)}
              title={legendHint(q, pickedTiers)}
            >
              <span className="pc-swatch" data-q={q} />
              {QUALITY_META[q].label}
              <span className="pc-legend-n">{totals[q]}</span>
            </button>
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

      <div
        ref={scrollRef}
        className="pc-scroll"
        data-more-left={more.left}
        data-more-right={more.right}
        onScroll={checkEnd}
      >
      <svg
        className="pc-svg"
        width={geo.width}
        height={height}
        viewBox={`0 0 ${geo.width} ${height}`}
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
          <g key={bar.summary.key} className="pc-bar">
            {bar.segs.map((s) => {
              const on = picked(bar.summary.key, s.quality);
              const dim = lit != null && !lit(bar.summary.key, s.quality);
              if (s.count === 0) return null;
              return (
                <g key={s.quality} className="pc-seg-g">
                  <rect
                    className="pc-seg"
                    data-q={s.quality}
                    data-on={on}
                    data-dim={dim}
                    x={s.x}
                    y={s.y}
                    width={s.w}
                    height={s.h}
                    onClick={() => onSelect(bar.summary.key, s.quality)}
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
      </div>
    </div>
  );
}
