import * as React from 'react';

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

export function Slider(props: {
  label: string;
  valueText: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  accent?: 'series' | 'decoupled' | 'target';
  valueDecoupled?: boolean;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <div className="ag-knob">
      <div className="ag-knob-head">
        <span className="ag-knob-label">{props.label}</span>
        <span className="ag-knob-value" data-decoupled={props.valueDecoupled ?? false}>
          {props.valueText}
        </span>
      </div>
      <input
        className="ag-slider"
        type="range"
        data-accent={props.accent ?? 'series'}
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        disabled={props.disabled}
        aria-label={props.label}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </div>
  );
}

export interface Chip {
  label: string;
  value: number;
  source?: string;
}

export function ChipRow(props: {
  chips: Chip[];
  activeValue: number;
  onPick: (value: number) => void;
  accent?: 'series' | 'decoupled';
}): React.ReactElement {
  return (
    <div className="ag-chips">
      {props.chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          className="ag-chip"
          data-accent={props.accent ?? 'series'}
          data-on={Math.abs(chip.value - props.activeValue) < EPS}
          onClick={() => props.onPick(chip.value)}
          title={chip.source}
        >
          {chip.label}
          {chip.source ? <span className="ag-chip-source"> · {chip.source}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function DecoupleToggle(props: {
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
