import { useState } from 'react';
import type { TopicCount } from './model.js';

// Donut geometry (SVG user units; viewBox scales to container).
const SIZE = 200;
const C = SIZE / 2;
const R_OUTER = 86;
const R_INNER = 54;

function polar(r: number, angle: number): [number, number] {
  return [C + r * Math.cos(angle), C + r * Math.sin(angle)];
}

function arcPath(a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(R_OUTER, a0);
  const [x1, y1] = polar(R_OUTER, a1);
  const [x2, y2] = polar(R_INNER, a1);
  const [x3, y3] = polar(R_INNER, a0);
  return `M${x0} ${y0} A${R_OUTER} ${R_OUTER} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${R_INNER} ${R_INNER} 0 ${large} 0 ${x3} ${y3} Z`;
}

/**
 * Topic proportions as a donut plus a synced clickable legend. Selecting a
 * topic is a filter the parent applies to the bar chart; the donut and chips
 * are two views of the same selection. Slices carry no topic-specific colour
 * (topics aren't a coloured dimension here) — meaning is arc length + the
 * highlight on hover/selection.
 *
 * `topics` and `total` are whatever the parent's tier filter leaves, so hiding
 * a tier re-proportions the donut; `scope` names the tiers being counted when
 * they are not all of them.
 */
export function TopicDonut({
  topics,
  total,
  scope,
  selected,
  onSelect,
}: {
  topics: TopicCount[];
  total: number;
  scope: string | null;
  selected: string | null;
  onSelect: (theme: string | null) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const active = hovered ?? selected;

  // precompute slice angles, starting at 12 o'clock
  const whole = Math.max(1, total);
  let cursor = -Math.PI / 2;
  const slices = topics.map((t, i) => {
    const a0 = cursor;
    const a1 = a0 + (t.count / whole) * Math.PI * 2;
    cursor = a1;
    return { ...t, a0, a1, i };
  });

  const shown = active ? topics.find((t) => t.theme === active) : null;
  const centerLabel = shown ? shown.theme : selected ? selected : 'All topics';
  const centerCount = shown ? shown.count : total;
  const centerPct = Math.round((centerCount / whole) * 100);

  const toggle = (theme: string) => onSelect(theme === selected ? null : theme);

  return (
    <div className="tp">
      <div className="tp-head">
        <span className="tp-eyebrow">Topics</span>
        {scope && <span className="tp-scope">{scope} only</span>}
        {selected && (
          <button type="button" className="tp-clear" onClick={() => onSelect(null)}>
            showing “{selected}” · clear ✕
          </button>
        )}
      </div>

      <div className="tp-body">
        <svg
          className="tp-svg"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label="Promise share by topic"
        >
          {slices.map((s) => {
            const isActive = active === s.theme;
            const dim = active != null && !isActive;
            return (
              <path
                key={s.theme}
                className="tp-slice"
                data-parity={s.i % 2}
                data-active={isActive}
                data-dim={dim}
                d={arcPath(s.a0, s.a1)}
                onMouseEnter={() => setHovered(s.theme)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => toggle(s.theme)}
              >
                <title>
                  {s.theme}: {s.count} ({Math.round((s.count / whole) * 100)}%)
                </title>
              </path>
            );
          })}
          <text className="tp-center-n" x={C} y={C - 4}>
            {centerCount}
          </text>
          <text className="tp-center-l" x={C} y={C + 14}>
            {centerLabel}
          </text>
          <text className="tp-center-p" x={C} y={C + 28}>
            {centerPct}%
          </text>
        </svg>

        <div className="tp-legend">
          {topics.map((t) => (
            <button
              key={t.theme}
              type="button"
              className="tp-chip"
              data-active={active === t.theme}
              data-selected={selected === t.theme}
              onMouseEnter={() => setHovered(t.theme)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => toggle(t.theme)}
            >
              {t.theme}
              <span className="tp-chip-n">{t.count}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
