import * as React from 'react';
import type { ParametricTargetClaim } from '../types.js';
import { deriveVerdict } from '../logic/deriveVerdict.js';
import { observedAt } from '../logic/resolve.js';
import { ensureStyles, themeToStyle, type Theme } from '../theme.js';
import { Chart } from './Chart.js';
import { VerdictBlock, type OutcomeLabels } from './VerdictBlock.js';
import {
  CheckboxToggle,
  PresetButtons,
  SegmentedToggle,
  ValueSlider,
  YearSlider,
} from './Knobs.js';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface ParametricTargetProps {
  claim: ParametricTargetClaim;
  theme?: Theme;
  outcomeLabels?: OutcomeLabels;
  /** Label for the checkbox that overrides the baseline with a custom value. */
  customLabel?: string;
  className?: string;
}

export function ParametricTarget(props: ParametricTargetProps): React.ReactElement {
  const { claim } = props;
  const formatValue = claim.formatValue ?? ((n: number) => String(Math.round(n)));
  const formatX = claim.formatX ?? ((n: number) => String(Math.round(n)));

  React.useEffect(() => {
    ensureStyles();
  }, []);

  const [scopeIndex, setScopeIndex] = React.useState(0);
  const [startX, setStartX] = React.useState(Math.round(claim.defaultStartX));
  const [deadlineX, setDeadlineX] = React.useState(Math.round(claim.defaultDeadlineX));
  const [customStart, setCustomStart] = React.useState(false);
  const [customValue, setCustomValue] = React.useState(
    claim.customValuePresets?.[0]?.value ?? claim.valueBounds.min,
  );

  const currentWindow = claim.scopePresets[scopeIndex] ?? claim.scopePresets[0];
  const defaultWindow = claim.scopePresets[0];
  if (!currentWindow || !defaultWindow) {
    throw new Error('parametric-target: claim.scopePresets must not be empty');
  }

  // Selectable years are the series years inside the current view window: a
  // narrow (scoped) window couples the sliders to the term ±1y; the wide window
  // uncouples them across the whole range.
  const yearsInWindow = claim.series
    .map((p) => p.x)
    .filter((x) => x >= currentWindow.xMin - 1e-6 && x <= currentWindow.xMax + 1e-6);
  const minYear = yearsInWindow.length ? Math.min(...yearsInWindow) : Math.round(currentWindow.xMin);
  const maxYear = yearsInWindow.length ? Math.max(...yearsInWindow) : Math.round(currentWindow.xMax);

  // Keep the year knobs inside the window and at least one year apart when the
  // scope changes.
  React.useEffect(() => {
    const d = clamp(deadlineX, minYear + 1, maxYear);
    const s = clamp(startX, minYear, d - 1);
    setStartX(s);
    setDeadlineX(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeIndex]);

  const safeDeadlineX = clamp(deadlineX, minYear + 1, maxYear);
  const safeStartX = clamp(startX, minYear, safeDeadlineX - 1);

  // The recorded value at the baseline year, unless overridden by a custom one.
  const valueAtYear = (x: number): number => {
    const exact = observedAt(claim.series, x);
    if (exact !== null) return exact;
    let best: number | null = null;
    let bestDist = Infinity;
    for (const p of claim.series) {
      const d = Math.abs(p.x - x);
      if (d < bestDist) {
        bestDist = d;
        best = p.y;
      }
    }
    return best ?? claim.valueBounds.min;
  };
  const baselineValue = customStart ? customValue : valueAtYear(safeStartX);

  const derivation = deriveVerdict({
    series: claim.series,
    baselineValue,
    deadlineX: safeDeadlineX,
    deadlineLabel: formatX(safeDeadlineX),
    targetRule: claim.targetRule,
    comparator: claim.comparator,
  });

  const onStart = (v: number) => setStartX(clamp(Math.round(v), minYear, safeDeadlineX - 1));
  const onEnd = (v: number) => setDeadlineX(clamp(Math.round(v), safeStartX + 1, maxYear));

  const scopeOptions = claim.scopePresets.map((p, i) => ({ label: p.label, value: String(i) }));

  return (
    <div
      className={`ag-root${props.className ? ` ${props.className}` : ''}`}
      style={themeToStyle(props.theme)}
    >
      <div className="ag-topbar">
        <SegmentedToggle
          ariaLabel="View window"
          options={scopeOptions}
          value={String(scopeIndex)}
          onChange={(v) => setScopeIndex(Number(v))}
        />
      </div>

      <div className="ag-card">
        <Chart
          series={claim.series}
          periods={claim.periods}
          currentWindow={currentWindow}
          defaultWindow={defaultWindow}
          yMode="auto"
          baseline={{ value: baselineValue, x: safeStartX, decoupled: customStart }}
          derivation={derivation}
          formatValue={formatValue}
          formatX={formatX}
        />
        <div className="ag-legend">
          <span>
            <span className="ag-swatch" style={{ borderTopColor: 'var(--ag-series)' }} /> series
          </span>
          <span>
            <span
              className="ag-swatch"
              style={{ borderTopColor: 'var(--ag-target)', borderTopStyle: 'dashed' }}
            />{' '}
            target chord
          </span>
          <span>
            <span className="ag-swatch" style={{ borderTopColor: 'var(--ag-actual)' }} /> actual chord
          </span>
          <span>
            <span
              className="ag-swatch"
              style={{ borderTop: 'none', width: 14, height: 12, background: 'rgba(255,255,255,0.06)' }}
            />{' '}
            period band
          </span>
        </div>
      </div>

      <VerdictBlock derivation={derivation} formatValue={formatValue} labels={props.outcomeLabels} />

      <div className="ag-controls">
        <div>
          <YearSlider
            label="start · baseline year"
            min={minYear}
            max={safeDeadlineX - 1}
            value={safeStartX}
            onChange={onStart}
            marks={claim.startMarks ?? []}
            formatX={formatX}
            accent="series"
          />
          <div className="ag-knob-value ag-baseline-readout" data-decoupled={customStart}>
            baseline = {formatValue(baselineValue)}
            {customStart ? ' *' : ` · recorded ${formatX(safeStartX)}`}
          </div>

          {(claim.customValuePresets?.length ?? 0) > 0 && (
            <CheckboxToggle
              checked={customStart}
              onChange={setCustomStart}
              label={props.customLabel ?? 'custom start value (override the recorded figure)'}
            />
          )}
          {customStart && (
            <>
              <ValueSlider
                label="custom start value"
                valueText={formatValue(customValue)}
                min={claim.valueBounds.min}
                max={claim.valueBounds.max}
                value={customValue}
                onChange={setCustomValue}
                accent="decoupled"
              />
              {claim.customValuePresets && claim.customValuePresets.length > 0 && (
                <PresetButtons
                  presets={claim.customValuePresets}
                  activeValue={customValue}
                  onPick={setCustomValue}
                  formatValue={formatValue}
                />
              )}
            </>
          )}
        </div>

        <div>
          <YearSlider
            label="end · deadline year"
            min={safeStartX + 1}
            max={maxYear}
            value={safeDeadlineX}
            onChange={onEnd}
            marks={claim.deadlineMarks ?? []}
            formatX={formatX}
            accent="target"
          />
        </div>

        {claim.periodNote && <p className="ag-note">{claim.periodNote}</p>}
      </div>
    </div>
  );
}
