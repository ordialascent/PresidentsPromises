import { useEffect, useMemo, useState } from 'react';
import {
  QUALITIES,
  QUALITY_META,
  deltaBetween,
  filterByTiers,
  summarize,
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

/**
 * The tier filter is owned by the page, not by this chart: the topic donut
 * counts the same promises, so both views have to read one shared set.
 */
export function PromisesChart({
  terms,
  activeTiers,
  onToggleTier,
}: {
  terms: CorpusTerm[];
  activeTiers: ReadonlySet<Quality>;
  onToggleTier: (quality: Quality) => void;
}) {
  const [mode, setMode] = useState<Mode>('absolute');
  const [selected, setSelected] = useState<Selection | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // A change of `terms` means the topic filter changed — drop the block
  // selection (so the list can't point at a now-empty tier) and the open promise.
  useEffect(() => {
    setSelected(null);
    setOpenId(null);
  }, [terms]);

  // Toggling a tier off in the legend hides it from the bars; keep any block
  // selection only while its tier is still shown.
  useEffect(() => {
    setSelected((cur) => (cur && activeTiers.has(cur.quality) ? cur : null));
  }, [activeTiers]);

  // Legend counts are the tier totals (unfiltered by tier) so a hidden tier can
  // always be toggled back on; the bars themselves show only the active tiers.
  const totals = useMemo(() => {
    const c: Record<Quality, number> = { full: 0, partial: 0, no: 0 };
    for (const t of terms) for (const p of t.promises) c[p.quality] += 1;
    return c;
  }, [terms]);

  const shownTerms = useMemo(() => filterByTiers(terms, activeTiers), [terms, activeTiers]);
  const summaries = useMemo(() => summarize(shownTerms), [shownTerms]);
  const bars = useMemo(() => layout(summaries, mode), [summaries, mode]);

  const selectedBar = selected && bars.find((b) => b.summary.key === selected.termKey);
  const selectedList =
    selectedBar && selected
      ? selectedBar.summary.promises.filter((p) => p.quality === selected.quality)
      : [];
  const openPromise = selectedList.find((p) => p.id === openId) ?? null;

  return (
    <div className="pc">
      <div className="pc-bar-top">
        <div className="pc-legend" role="group" aria-label="Filter by tier">
          {QUALITIES.map((q) => (
            <button
              key={q}
              type="button"
              className="pc-legend-item"
              data-on={activeTiers.has(q)}
              aria-pressed={activeTiers.has(q)}
              onClick={() => onToggleTier(q)}
              title={`Show or hide ${QUALITY_META[q].label.toLowerCase()} promises`}
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
                    onClick={() => {
                      // clicking a block resets any open promise detail
                      setOpenId(null);
                      setSelected(on ? null : { termKey: bar.summary.key, quality: s.quality });
                    }}
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

      {openPromise && (
        <div className="pc-detail" data-q={openPromise.quality}>
          <div className="pc-detail-top">
            <span className="pc-detail-tier" data-q={openPromise.quality}>
              {QUALITY_META[openPromise.quality].label}
            </span>
            <span className="pc-detail-theme">{openPromise.theme}</span>
            {openPromise.occurrences.length > 1 && (
              <span className="pc-detail-count">
                promised {openPromise.occurrences.length}×
              </span>
            )}
            <button type="button" className="pc-detail-close" onClick={() => setOpenId(null)}>
              ✕
            </button>
          </div>
          <div className="pc-detail-title">{openPromise.restatement}</div>
          {openPromise.occurrences.map((o, k) => (
            <div className="pc-detail-occ" key={`${o.source.kind}-${k}`}>
              <blockquote className="pc-detail-quote">“{o.quote}”</blockquote>
              <div className="pc-detail-context">
                <span className="pc-detail-speaker">{o.source.speaker}</span>
                {o.source.year != null && (
                  <>
                    <span className="pc-detail-dot">·</span>
                    <span>{o.source.year}</span>
                  </>
                )}
                <span className="pc-detail-dot">·</span>
                <span className="pc-detail-event">{o.source.event}</span>
                <span className="pc-detail-medium">{o.source.medium}</span>
              </div>
              {(o.ref || o.source.url) && (
                <div className="pc-detail-cite">
                  {o.ref && <span className="pc-detail-ref">{o.ref}</span>}
                  {o.source.url && (
                    <a href={o.source.url} target="_blank" rel="noreferrer">
                      {o.source.publisher || 'source'} ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
                  data-open={openId === p.id}
                  onClick={() => setOpenId((cur) => (cur === p.id ? null : p.id))}
                >
                  <span className="pc-promise-theme">{p.theme}</span>
                  <span className="pc-promise-text">
                    {p.restatement}
                    {p.occurrences.length > 1 && (
                      <span className="pc-promise-src">promised {p.occurrences.length}×</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
