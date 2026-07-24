/**
 * Theming is expressed as CSS custom properties with generic, role-based
 * names. Defaults are baked in so the component renders correctly on its own;
 * a consumer can override any role by passing `theme` or by setting the same
 * variables further up the tree. None of these names carry domain meaning.
 */

export type ThemeVar =
  | 'bg'
  | 'panel'
  | 'ink'
  | 'dim'
  | 'border'
  | 'series'
  | 'target'
  | 'actual'
  | 'met'
  | 'missed'
  | 'decoupled'
  | 'fontMono'
  | 'fontSans';

export type Theme = Partial<Record<ThemeVar, string>>;

const VAR_NAME: Record<ThemeVar, string> = {
  bg: '--ag-bg',
  panel: '--ag-panel',
  ink: '--ag-ink',
  dim: '--ag-dim',
  border: '--ag-border',
  series: '--ag-series',
  target: '--ag-target',
  actual: '--ag-actual',
  met: '--ag-met',
  missed: '--ag-missed',
  decoupled: '--ag-decoupled',
  fontMono: '--ag-font-mono',
  fontSans: '--ag-font-sans',
};

export function themeToStyle(theme: Theme | undefined): Record<string, string> {
  const style: Record<string, string> = {};
  if (!theme) return style;
  for (const key of Object.keys(theme) as ThemeVar[]) {
    const value = theme[key];
    if (value != null) style[VAR_NAME[key]] = value;
  }
  return style;
}

export const AG_STYLE_ID = 'parametric-target-styles';

export const agStyles = `
.ag-root {
  --ag-bg: #0c1116;
  --ag-panel: #131b23;
  --ag-ink: #e6edf3;
  --ag-dim: #7d94a8;
  --ag-border: #22303c;
  --ag-series: #38bec9;
  --ag-target: #f0a202;
  --ag-actual: #ffffff;
  --ag-met: #2fbf71;
  --ag-missed: #e5484d;
  --ag-decoupled: #c084fc;
  --ag-font-mono: ui-monospace, Menlo, Monaco, "Cascadia Code", "Roboto Mono", monospace;
  --ag-font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--ag-ink);
  font-family: var(--ag-font-sans);
  display: flex;
  flex-direction: column;
  gap: 14px;
  container-type: inline-size;
}
.ag-root * { box-sizing: border-box; }
.ag-mono { font-family: var(--ag-font-mono); }

.ag-topbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}
.ag-toggle {
  display: inline-flex;
  border: 1px solid var(--ag-border);
  border-radius: 8px;
  overflow: hidden;
}
.ag-toggle button {
  font-family: var(--ag-font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 6px 12px;
  background: transparent;
  color: var(--ag-dim);
  border: 0;
  cursor: pointer;
  white-space: nowrap;
}
.ag-toggle button[data-on="true"] {
  background: var(--ag-panel);
  color: var(--ag-ink);
  box-shadow: inset 0 0 0 1px var(--ag-border);
}

.ag-card {
  background: var(--ag-panel);
  border: 1px solid var(--ag-border);
  border-radius: 14px;
  padding: 14px 12px 8px;
}
.ag-chart { width: 100%; height: auto; display: block; overflow: visible; }

.ag-band-a { fill: rgba(255,255,255,0.02); }
.ag-band-b { fill: rgba(255,255,255,0.05); }
.ag-band-label {
  fill: var(--ag-dim);
  font-family: var(--ag-font-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
}
.ag-grid { stroke: var(--ag-border); stroke-width: 1; opacity: 0.5; }
.ag-zero { stroke: var(--ag-dim); stroke-width: 1.25; opacity: 0.9; stroke-dasharray: 1 0; }
.ag-axis text {
  fill: var(--ag-dim);
  font-family: var(--ag-font-mono);
  font-size: 10px;
}
.ag-axis-note {
  fill: var(--ag-dim);
  font-family: var(--ag-font-mono);
  font-size: 9.5px;
  opacity: 0.85;
}

.ag-series-line { fill: none; stroke: var(--ag-series); stroke-width: 1.75; }
.ag-series-dot { fill: var(--ag-series); }

.ag-target-chord { stroke: var(--ag-target); stroke-width: 1.75; stroke-dasharray: 5 4; fill: none; }
.ag-actual-chord { stroke: var(--ag-actual); stroke-width: 1.75; fill: none; }

.ag-gap[data-outcome="met"] { stroke: var(--ag-met); }
.ag-gap[data-outcome="missed"] { stroke: var(--ag-missed); }
.ag-gap { stroke-width: 6; opacity: 0.55; stroke-linecap: butt; }

.ag-dot-start { fill: var(--ag-actual); }
.ag-dot-start[data-decoupled="true"] { fill: var(--ag-decoupled); }
.ag-dot-target { fill: var(--ag-target); }
.ag-dot-actual[data-outcome="met"] { fill: var(--ag-met); }
.ag-dot-actual[data-outcome="missed"] { fill: var(--ag-missed); }
.ag-mark-label {
  font-family: var(--ag-font-mono);
  font-size: 10px;
  fill: var(--ag-ink);
}
.ag-mark-label-dim { fill: var(--ag-dim); }

.ag-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-family: var(--ag-font-mono);
  font-size: 11px;
  color: var(--ag-dim);
  padding: 2px 4px 0;
}
.ag-legend span { display: inline-flex; align-items: center; gap: 6px; }
.ag-swatch { width: 16px; height: 0; border-top-width: 2px; border-top-style: solid; display: inline-block; }

.ag-verdict {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.ag-badge {
  font-family: var(--ag-font-mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid var(--ag-border);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.ag-badge[data-outcome="met"] { color: var(--ag-met); border-color: var(--ag-met); }
.ag-badge[data-outcome="missed"] { color: var(--ag-missed); border-color: var(--ag-missed); }
.ag-badge[data-outcome="indeterminate"] { color: var(--ag-dim); }
.ag-badge-glyph { font-size: 13px; line-height: 1; }
.ag-math {
  font-family: var(--ag-font-mono);
  font-size: 12.5px;
  color: var(--ag-ink);
}

.ag-controls { display: flex; flex-direction: column; gap: 14px; }
.ag-knob { display: flex; flex-direction: column; gap: 7px; }
.ag-knob-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
}
.ag-knob-label {
  font-family: var(--ag-font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ag-dim);
}
.ag-knob-value { font-family: var(--ag-font-mono); font-size: 12.5px; color: var(--ag-ink); white-space: nowrap; }
.ag-knob-value[data-decoupled="true"] { color: var(--ag-decoupled); }

.ag-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--ag-border);
  cursor: pointer;
  outline: none;
}
.ag-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -5px;
  border-radius: 50%;
  background: var(--ag-accent, var(--ag-series));
  border: 2px solid var(--ag-bg);
  box-shadow: 0 0 0 1px var(--ag-border);
  cursor: pointer;
}
.ag-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--ag-accent, var(--ag-series));
  border: 2px solid var(--ag-bg);
  box-shadow: 0 0 0 1px var(--ag-border);
  cursor: pointer;
}
.ag-slider::-moz-range-track { height: 4px; border-radius: 2px; background: transparent; }
.ag-slider:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 2px var(--ag-ink); }

.ag-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.ag-chip {
  font-family: var(--ag-font-mono);
  font-size: 11px;
  padding: 5px 9px;
  border-radius: 999px;
  border: 1px solid var(--ag-border);
  background: transparent;
  color: var(--ag-dim);
  cursor: pointer;
}
.ag-chip[data-on="true"] { color: var(--ag-ink); border-color: var(--ag-series); }
.ag-chip[data-accent="decoupled"][data-on="true"] { border-color: var(--ag-decoupled); }
.ag-chip-source { opacity: 0.7; }

.ag-decouple {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--ag-font-mono);
  font-size: 11.5px;
  color: var(--ag-dim);
  cursor: pointer;
  user-select: none;
}
.ag-decouple input { accent-color: var(--ag-decoupled); cursor: pointer; }
.ag-note { font-family: var(--ag-font-mono); font-size: 10.5px; color: var(--ag-dim); opacity: 0.85; }

.ag-slider-wrap { position: relative; }
.ag-marks { position: absolute; left: 0; right: 0; top: 50%; height: 0; pointer-events: none; }
.ag-mark-tick {
  position: absolute;
  top: -8px;
  width: 2px;
  height: 16px;
  transform: translateX(-50%);
  background: var(--ag-dim);
  opacity: 0.85;
  border-radius: 1px;
}
.ag-mark-legend { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.ag-marker {
  font-family: var(--ag-font-mono);
  font-size: 11px;
  padding: 4px 9px;
  border-radius: 999px;
  border: 1px solid var(--ag-border);
  background: transparent;
  color: var(--ag-dim);
  cursor: pointer;
}
.ag-marker[data-on="true"] { color: var(--ag-ink); border-color: var(--ag-target); }
.ag-baseline-readout { margin-top: 8px; }
`;

export function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(AG_STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = AG_STYLE_ID;
  el.textContent = agStyles;
  document.head.appendChild(el);
}
