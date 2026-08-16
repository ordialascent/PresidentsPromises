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
 * Topic proportions as a donut plus a synced clickable legend. Topics are
 * multi-select — every lit slice is in the filter the parent applies to the bar
 * chart, and an empty selection means all of them. The donut and the chips are
 * two views of the same set. Slices carry no topic-specific colour (topics
 * aren't a coloured dimension here) — meaning is arc length + the highlight.
 *
 * `topics` and `total` are whatever the parent's tier filter leaves, so hiding
 * a tier re-proportions the donut; `scope` names the tiers being counted when
 * they are not all of them. The list arrives complete and in a fixed order,
 * including topics the filter has emptied — those hold their place at zero,
 * greyed and unpickable, so the legend never reflows under the reader.
 */
export function TopicDonut({
  topics,
  total,
  countWidth,
  scope,
  selected,
  onToggle,
}: {
  topics: TopicCount[];
  total: number;
  /** Digits to pad each chip's count to, so a chip's width never changes. */
  countWidth: number;
  scope: string | null;
  selected: ReadonlySet<string>;
  onToggle: (theme: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  // precompute slice angles, starting at 12 o'clock. A topic the tier filter has
  // emptied is still in `topics` (at zero, so the legend holds its shape) but has
  // no arc to draw — dropping it here keeps a degenerate path from painting a
  // hairline on the ring.
  const whole = Math.max(1, total);
  let cursor = -Math.PI / 2;
  const slices = topics
    .filter((t) => t.count > 0)
    .map((t) => {
      const a0 = cursor;
      const a1 = a0 + (t.count / whole) * Math.PI * 2;
      cursor = a1;
      return { ...t, a0, a1 };
    });

  // The centre reads out whatever is lit: a hovered slice previews itself, else
  // the selection sums, else the whole donut.
  const picked = topics.filter((t) => selected.has(t.theme));
  const peek = hovered != null ? topics.find((t) => t.theme === hovered) : undefined;
  const centerLabel = peek
    ? peek.theme
    : picked.length === 0
      ? 'All topics'
      : picked.length === 1
        ? picked[0]!.theme
        : `${picked.length} topics`;
  const centerCount = peek
    ? peek.count
    : picked.length === 0
      ? total
      : picked.reduce((n, t) => n + t.count, 0);
  const centerPct = Math.round((centerCount / whole) * 100);
  const lit = hovered != null || picked.length > 0;

  return (
    <div className="tp">
      <div className="tp-head">
        <span className="tp-eyebrow">Topics</span>
      </div>

      <div className="tp-body">
        <svg
          className="tp-svg"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label="Promise share by topic"
        >
          {slices.map((s) => {
            const isActive = hovered === s.theme || selected.has(s.theme);
            return (
              <path
                key={s.theme}
                className="tp-slice"
                data-active={isActive}
                data-dim={lit && !isActive}
                d={arcPath(s.a0, s.a1)}
                onMouseEnter={() => setHovered(s.theme)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onToggle(s.theme)}
              >
                <title>
                  {s.theme}: {s.count} ({Math.round((s.count / whole) * 100)}%)
                </title>
              </path>
            );
          })}
          <text className="tp-center-n" data-active={lit} x={C} y={C - 4}>
            {centerCount}
          </text>
          <text className="tp-center-l" x={C} y={C + 14}>
            {centerLabel}
          </text>
          <text className="tp-center-p" x={C} y={C + 28}>
            {centerPct}%
          </text>
        </svg>

        {/* the caption keeps its line even when there is nothing to say, so
            toggling a tier doesn't shift the legend by a row */}
        <span className="tp-scope" data-on={scope != null}>
          {scope ? `${scope} only` : ' '}
        </span>

        <div className="tp-legend">
          {topics.map((t) => {
            // nothing to filter to in the shown tiers: hold the chip's place in
            // the row, greyed and unpickable, rather than reflowing the legend
            const empty = t.count === 0;
            return (
              <button
                key={t.theme}
                type="button"
                className="tp-chip"
                disabled={empty}
                data-empty={empty}
                aria-pressed={selected.has(t.theme)}
                data-active={hovered === t.theme || selected.has(t.theme)}
                data-selected={selected.has(t.theme)}
                onMouseEnter={() => !empty && setHovered(t.theme)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onToggle(t.theme)}
                title={empty ? `no ${scope ? `${scope} ` : ''}promises on ${t.theme}` : undefined}
              >
                {t.theme}
                <span className="tp-chip-n">
                  {String(t.count).padStart(countWidth, '0')}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
