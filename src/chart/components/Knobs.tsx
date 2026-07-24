import * as React from 'react';
import type { YearMark } from '../types.js';

const EPS = 1e-6;

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

/**
 * A slider over integer years, with event markers rendered as ticks on the
 * track and as a clickable legend below. The value readout is annotated with a
 * marker's label when the slider sits on it.
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
  const pct = (x: number) => ((x - min) / span) * 100;
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
          data-accent={props.accent ?? 'series'}
          min={min}
          max={max}
          step={1}
          value={value}
          aria-label={props.label}
          onChange={(e) => props.onChange(Number(e.target.value))}
        />
        <div className="ag-marks" aria-hidden="true">
          {visibleMarks.map((m) => (
            <span key={m.x} className="ag-mark-tick" style={{ left: `${pct(m.x)}%` }} />
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
              {formatX(m.x)} · {m.label}
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
  const step = (props.max - props.min) / 500 || 1;
  return (
    <div className="ag-knob">
      <div className="ag-knob-head">
        <span className="ag-knob-label">{props.label}</span>
        <span className="ag-knob-value" data-decoupled={props.accent === 'decoupled'}>
          {props.valueText}
        </span>
      </div>
      <input
        className="ag-slider"
        type="range"
        data-accent={props.accent ?? 'series'}
        min={props.min}
        max={props.max}
        step={step}
        value={props.value}
        aria-label={props.label}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
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
