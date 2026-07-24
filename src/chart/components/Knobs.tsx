import * as React from 'react';
import type { YearMark } from '../types.js';

const EPS = 1e-6;
const THUMB = 14; // px; must match the thumb width in theme.ts

export interface SegOption {
  label: string;
  value: string;
}

export function SegmentedToggle(props: {
  options: SegOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}): React.ReactElement {
  return (
    <div className="ag-toggle" role="group" aria-label={props.ariaLabel}>
      {props.options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          data-on={opt.value === props.value}
          aria-pressed={opt.value === props.value}
          onClick={() => props.onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

type Accent = 'series' | 'decoupled' | 'target';
const accentVar = (a: Accent): string =>
  a === 'decoupled' ? '--ag-decoupled' : a === 'target' ? '--ag-target' : '--ag-series';

// Position along the track that lines up with the thumb *centre*, accounting
// for the thumb width (so ticks sit under the thumb, not a few px off).
const along = (frac: number): string => `calc(${frac} * (100% - ${THUMB}px) + ${THUMB / 2}px)`;

function trackStyle(frac: number, accent: Accent): React.CSSProperties {
  const v = accentVar(accent);
  const at = along(frac);
  return {
    ['--ag-accent' as unknown as string]: `var(${v})`,
    background: `linear-gradient(90deg, var(${v}) 0, var(${v}) ${at}, var(--ag-border) ${at}, var(--ag-border) 100%)`,
  } as React.CSSProperties;
}

/**
 * A slider over integer years, with event markers rendered as ticks aligned to
 * the thumb and as a clickable legend below. The value readout is on its own
 * line so an annotation can't reflow the label while dragging.
 */
export function YearSlider(props: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  marks: YearMark[];
  formatX: (x: number) => string;
  accent?: 'series' | 'target';
}): React.ReactElement {
  const { min, max, value, marks, formatX } = props;
  const span = max - min || 1;
  const frac = (x: number) => Math.max(0, Math.min(1, (x - min) / span));
  const onMark = marks.find((m) => Math.abs(m.x - value) < EPS);
  const valueText = onMark ? `${formatX(value)} · ${onMark.label}` : formatX(value);
  const visibleMarks = marks.filter((m) => m.x >= min - EPS && m.x <= max + EPS);

  return (
    <div className="ag-knob">
      <div className="ag-knob-head">
        <span className="ag-knob-label">{props.label}</span>
        <span className="ag-knob-value">{valueText}</span>
      </div>
      <div className="ag-slider-wrap">
        <input
          className="ag-slider"
          type="range"
          style={trackStyle(frac(value), props.accent ?? 'series')}
          min={min}
          max={max}
          step={1}
          value={value}
          aria-label={props.label}
          onChange={(e) => props.onChange(Number(e.target.value))}
        />
        <div className="ag-marks" aria-hidden="true">
          {visibleMarks
            // Hide a tick once the thumb reaches it — it's redundant there, and
            // it sidesteps the sub-pixel misalignment between thumb and tick.
            .filter((m) => Math.abs(m.x - value) >= EPS)
            .map((m) => (
              <span key={m.x} className="ag-mark-tick" style={{ left: along(frac(m.x)) }} />
            ))}
        </div>
      </div>
      {visibleMarks.length > 0 && (
        <div className="ag-mark-legend">
          {visibleMarks.map((m) => (
            <button
              key={m.x}
              type="button"
              className="ag-marker"
              data-on={Math.abs(m.x - value) < EPS}
              onClick={() => props.onChange(m.x)}
            >
              {formatX(m.x)}: {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A plain value slider (used for the custom baseline value). */
export function ValueSlider(props: {
  label: string;
  valueText: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  accent?: 'series' | 'decoupled' | 'target';
}): React.ReactElement {
  const span = props.max - props.min || 1;
  const step = span / 500 || 1;
  const frac = Math.max(0, Math.min(1, (props.value - props.min) / span));
  const accent = props.accent ?? 'series';
  return (
    <div className="ag-knob">
      <div className="ag-knob-head">
        <span className="ag-knob-label">{props.label}</span>
        <span className="ag-knob-value" data-decoupled={accent === 'decoupled'}>
          {props.valueText}
        </span>
      </div>
      <div className="ag-slider-wrap">
        <input
          className="ag-slider"
          type="range"
          style={trackStyle(frac, accent)}
          min={props.min}
          max={props.max}
          step={step}
          value={props.value}
          aria-label={props.label}
          onChange={(e) => props.onChange(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

export function CheckboxToggle(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}): React.ReactElement {
  return (
    <label className="ag-decouple">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      {props.label}
    </label>
  );
}

export interface Preset {
  label: string;
  value: number;
}

export function PresetButtons(props: {
  presets: Preset[];
  activeValue: number;
  onPick: (value: number) => void;
  formatValue: (n: number) => string;
}): React.ReactElement {
  return (
    <div className="ag-chips">
      {props.presets.map((p) => (
        <button
          key={p.label}
          type="button"
          className="ag-chip"
          data-accent="decoupled"
          data-on={Math.abs(p.value - props.activeValue) < EPS}
          onClick={() => props.onPick(p.value)}
        >
          set to {p.label}
          <span className="ag-chip-source"> · {props.formatValue(p.value)}</span>
        </button>
      ))}
    </div>
  );
}
