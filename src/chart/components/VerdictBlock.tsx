import * as React from 'react';
import type { Outcome } from '../types.js';
import { describeDerivation, type Derivation } from '../logic/deriveVerdict.js';

export interface OutcomeLabels {
  met: string;
  missed: string;
  indeterminate: string;
}

export const DEFAULT_OUTCOME_LABELS: OutcomeLabels = {
  met: 'TARGET REACHED',
  missed: 'TARGET MISSED',
  indeterminate: 'NO OBSERVATION',
};

// A shape glyph per outcome so the reading survives without colour.
const GLYPH: Record<Outcome, string> = {
  met: '✓',
  missed: '✕',
  indeterminate: '—',
};

export interface VerdictBlockProps {
  derivation: Derivation;
  formatValue: (n: number) => string;
  labels?: OutcomeLabels;
}

export function VerdictBlock(props: VerdictBlockProps): React.ReactElement {
  const labels = props.labels ?? DEFAULT_OUTCOME_LABELS;
  const { outcome } = props.derivation;
  return (
    <div className="ag-verdict">
      <span className="ag-badge" data-outcome={outcome}>
        <span className="ag-badge-glyph" aria-hidden="true">
          {GLYPH[outcome]}
        </span>
        {labels[outcome]}
      </span>
      <span className="ag-math">{describeDerivation(props.derivation, props.formatValue)}</span>
    </div>
  );
}
