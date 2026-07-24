export type {
  Provenance,
  SeriesPoint,
  BaselineCandidate,
  DeadlineCandidate,
  TargetRule,
  Comparator,
  Period,
  ScopePreset,
  KnobBounds,
  YScaleMode,
  Outcome,
  ParametricTargetClaim,
} from './types.js';

export { deriveTarget } from './logic/deriveTarget.js';
export {
  deriveVerdict,
  describeDerivation,
  describeRule,
  type Derivation,
  type DerivationInput,
} from './logic/deriveVerdict.js';
export { observedAt, pointsInWindow, yDomain } from './logic/resolve.js';
export { linearScale, niceTicks, type LinearScale } from './logic/scale.js';

export { ParametricTarget, type ParametricTargetProps } from './components/ParametricTarget.js';
export {
  VerdictBlock,
  DEFAULT_OUTCOME_LABELS,
  type VerdictBlockProps,
  type OutcomeLabels,
} from './components/VerdictBlock.js';

export { agStyles, themeToStyle, type Theme, type ThemeVar } from './theme.js';
