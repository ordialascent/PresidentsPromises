import type { TargetRule } from '../types.js';

/** Derive the target value from a baseline value and a rule. Pure. */
export function deriveTarget(baselineValue: number, rule: TargetRule): number {
  switch (rule.kind) {
    case 'halve':
      return baselineValue / 2;
    case 'reduceByPercent':
      return baselineValue * (1 - rule.percent / 100);
    case 'reduceToAbsolute':
      return rule.value;
  }
}
