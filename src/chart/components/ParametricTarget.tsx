import * as React from 'react';
import type { ParametricTargetClaim } from '../types.js';
import { deriveVerdict } from '../logic/deriveVerdict.js';
import { ensureStyles, themeToStyle, type Theme } from '../theme.js';
import { Chart } from './Chart.js';
import { VerdictBlock, type OutcomeLabels } from './VerdictBlock.js';
import { ChipRow, DecoupleToggle, SegmentedToggle, Slider, type Chip } from './Knobs.js';

const EPS = 1e-6;

export interface ParametricTargetProps {
  claim: ParametricTargetClaim;
  theme?: Theme;
  outcomeLabels?: OutcomeLabels;
  /** Label for the checkbox that frees the baseline from the series. */
  decoupleLabel?: string;
  className?: string;
}

export function ParametricTarget(props: ParametricTargetProps): React.ReactElement {
  const { claim } = props;
  const formatValue = claim.formatValue ?? ((n: number) => String(Math.round(n)));
  const formatX = claim.formatX ?? ((n: number) => String(n));

  React.useEffect(() => {
    ensureStyles();
  }, []);

  const coupledCandidates = claim.baselineCandidates.filter((c) => !c.stated);
  const statedCandidates = claim.baselineCandidates.filter((c) => c.stated);

  const [scopeIndex, setScopeIndex] = React.useState(0);
  const [yMode, setYMode] = React.useState(claim.yScaleMode ?? 'locked');
  const [decoupled, setDecoupled] = React.useState(false);
  const [coupledValue, setCoupledValue] = React.useState(
    coupledCandidates[0]?.value ?? claim.bounds.start.min,
  );
  const [statedValue, setStatedValue] = React.useState(
    statedCandidates[0]?.value ?? claim.bounds.start.min,
  );
  const [deadlineX, setDeadlineX] = React.useState(
    claim.deadlineCandidates[0]?.x ?? claim.bounds.end.min,
  );

  const currentWindow = claim.scopePresets[scopeIndex] ?? claim.scopePresets[0];
  const defaultWindow = claim.scopePresets[0];
  if (!currentWindow || !defaultWindow) {
    throw new Error('parametric-target: claim.scopePresets must not be empty');
  }

  const anchorX =
    claim.baselineAnchorX ??
    coupledCandidates.find((c) => c.x != null)?.x ??
    currentWindow.xMin;
  const effectiveBaseline = decoupled ? statedValue : coupledValue;
  const deadlineLabel =
    claim.deadlineCandidates.find((c) => Math.abs(c.x - deadlineX) < EPS)?.label ??
    formatX(deadlineX);

  const derivation = deriveVerdict({
    series: claim.series,
    baselineValue: effectiveBaseline,
    deadlineX,
    deadlineLabel,
    targetRule: claim.targetRule,
    comparator: claim.comparator,
  });

  const seriesMaxX = claim.series.reduce((m, p) => Math.max(m, p.x), claim.bounds.end.min);
  const endMax = claim.bounds.end.max ?? (claim.bounds.end.openEnded ? seriesMaxX + 3 : seriesMaxX);
  const startStep = (claim.bounds.start.max - claim.bounds.start.min) / 500 || 1;

  const coupledChips: Chip[] = coupledCandidates.map((c) => ({
    label: c.label,
    value: c.value,
    source: c.source,
  }));
  const statedChips: Chip[] = statedCandidates.map((c) => ({
    label: c.label,
    value: c.value,
    source: c.source,
  }));
  const deadlineChips: Chip[] = claim.deadlineCandidates.map((c) => ({
    label: c.label,
    value: c.x,
    source: c.source,
  }));

  const scopeOptions = claim.scopePresets.map((p, i) => ({ label: p.label, value: String(i) }));

  return (
    <div className={`ag-root${props.className ? ` ${props.className}` : ''}`} style={themeToStyle(props.theme)}>
      <div className="ag-topbar">
        <SegmentedToggle
          ariaLabel="View window"
          options={scopeOptions}
          value={String(scopeIndex)}
          onChange={(v) => setScopeIndex(Number(v))}
        />
        <SegmentedToggle
          ariaLabel="Vertical scale"
          options={[
            { label: 'Y · locked', value: 'locked' },
            { label: 'Y · fit', value: 'auto' },
          ]}
          value={yMode}
          onChange={(v) => setYMode(v as 'locked' | 'auto')}
        />
      </div>

      <div className="ag-card">
        <Chart
          series={claim.series}
          periods={claim.periods}
          currentWindow={currentWindow}
          defaultWindow={defaultWindow}
          yMode={yMode}
          baseline={{ value: effectiveBaseline, x: anchorX, decoupled }}
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

      <VerdictBlock
        derivation={derivation}
        formatValue={formatValue}
        labels={props.outcomeLabels}
      />

      <div className="ag-controls">
        <div>
          <Slider
            label="start · baseline"
            valueText={formatValue(coupledValue)}
            min={claim.bounds.start.min}
            max={claim.bounds.start.max}
            step={startStep}
            value={coupledValue}
            onChange={setCoupledValue}
            accent="series"
            disabled={decoupled}
          />
          {coupledChips.length > 0 && (
            <ChipRow chips={coupledChips} activeValue={coupledValue} onPick={setCoupledValue} />
          )}
          {statedCandidates.length > 0 && (
            <DecoupleToggle
              checked={decoupled}
              onChange={setDecoupled}
              label={props.decoupleLabel ?? 'decouple from series (stated value)'}
            />
          )}
          {decoupled && (
            <>
              <Slider
                label="stated value"
                valueText={formatValue(statedValue)}
                valueDecoupled
                min={claim.bounds.start.min}
                max={claim.bounds.start.max}
                step={startStep}
                value={statedValue}
                onChange={setStatedValue}
                accent="decoupled"
              />
              {statedChips.length > 0 && (
                <ChipRow
                  chips={statedChips}
                  activeValue={statedValue}
                  onPick={setStatedValue}
                  accent="decoupled"
                />
              )}
            </>
          )}
        </div>

        <div>
          <Slider
            label="end · deadline"
            valueText={deadlineLabel}
            min={claim.bounds.end.min}
            max={endMax}
            step={1}
            value={deadlineX}
            onChange={setDeadlineX}
            accent="target"
          />
          {deadlineChips.length > 0 && (
            <ChipRow chips={deadlineChips} activeValue={deadlineX} onPick={setDeadlineX} />
          )}
        </div>

        {claim.periodNote && <p className="ag-note">{claim.periodNote}</p>}
      </div>
    </div>
  );
}
