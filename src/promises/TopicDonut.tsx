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
 * multi-select — every lit slice is in the filter the parent applies to
 * everything below it, and an empty selection means all of them. The donut and
 * the chips are two views of the same set. Slices carry no topic-specific
 * colour (topics aren't a coloured dimension here) — meaning is arc length +
 * the highlight.
 *
 * `topics` is the whole corpus, always: topics are the top of the filter
 * hierarchy, so no tier, block or search below can re-count or re-order them.
 * The donut a reader picks from is the donut they keep.
 */
export function TopicDonut({
  topics,
  total,
  countWidth,
  selected,
  onToggle,
}: {
  topics: TopicCount[];
  total: number;
  /** Digits to pad each chip's count to, so a chip's width never changes. */
  countWidth: number;
  selected: ReadonlySet<string>;
  onToggle: (theme: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  // precompute slice angles, starting at 12 o'clock
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

        <div className="tp-legend">
          {topics.map((t) => (
            <button
              key={t.theme}
              type="button"
              className="tp-chip"
              aria-pressed={selected.has(t.theme)}
              data-active={hovered === t.theme || selected.has(t.theme)}
              data-selected={selected.has(t.theme)}
              onMouseEnter={() => setHovered(t.theme)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onToggle(t.theme)}
            >
              {t.theme}
              <span className="tp-chip-n">{String(t.count).padStart(countWidth, '0')}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
