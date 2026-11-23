import { useEffect, useRef, useState } from 'react';
import type { CorpusTerm, Kind } from './model.js';
import { LATEST_TERMS, latestTermKeys, scopePreset, scopeSpan } from './model.js';
import type { Scale } from './PromiseFunnel.js';

/**
 * The board's three settings in one bar: which terms it covers, which kind of
 * record it shows, and how the chart measures its bars. Terms opens a menu
 * (all, the latest few, or any hand-picked set: ticking terms selects Custom,
 * and a set that equals a preset snaps back to it); the other two flip between
 * their two values on each click.
 */
export function BoardSettings({
  terms,
  scope,
  onScope,
  kind,
  kindLabel,
  kindCount,
  kindHint,
  onKind,
  scale,
  onScale,
}: {
  /** Every term in the corpus, oldest first. */
  terms: CorpusTerm[];
  scope: ReadonlySet<string>;
  onScope: (next: Set<string>) => void;
  kind: Kind;
  kindLabel: (k: Kind) => string;
  kindCount: (k: Kind) => number;
  kindHint: (k: Kind) => string;
  onKind: (k: Kind) => void;
  scale: Scale;
  onScale: (s: Scale) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const preset = scopePreset(scope, terms);
  const latestN = Math.min(LATEST_TERMS, terms.length);
  const otherKind: Kind = kind === 'promise' ? 'ambition' : 'promise';
  const otherScale: Scale = scale === 'count' ? 'percent' : 'count';

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggleTerm = (key: string) => {
    const next = new Set(scope);
    if (next.has(key)) {
      if (next.size === 1) return; // keep at least one term
      next.delete(key);
    } else next.add(key);
    onScope(next);
  };
  const pickPreset = (next: Set<string>) => {
    onScope(next);
    setOpen(false);
  };

  return (
    <div className="settings" ref={ref}>
      <div className="kind-switch" role="group" aria-label="Settings">
        <span className="settings-title">Settings</span>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="true"
          title="Choose which terms the board covers"
          onClick={() => setOpen((o) => !o)}
        >
          Terms
          <span className="kind-switch-n">{scopeSpan(scope, terms)}</span>
          <span className="fb-caret" aria-hidden="true">
            ▾
          </span>
        </button>
        <button type="button" title={`Switch to ${kindLabel(otherKind).toLowerCase()}. ${kindHint(otherKind)}`} onClick={() => onKind(otherKind)}>
          {kindLabel(kind)}
          <span className="kind-switch-n">{kindCount(kind)}</span>
          <span className="settings-flip" aria-hidden="true">
            ⇄
          </span>
        </button>
        <button
          type="button"
          title={
            otherScale === 'count'
              ? 'Switch to count: one scale for every bar, longer means more promises'
              : 'Switch to percent: every bar fills the width, lengths are shares'
          }
          onClick={() => onScale(otherScale)}
        >
          {scale === 'count' ? 'Count' : 'Percent'}
          <span className="settings-flip" aria-hidden="true">
            ⇄
          </span>
        </button>
      </div>
      {open && (
        <div className="fb-menu settings-menu" role="group" aria-label="Choose terms">
          <ul>
            <li>
              <label className="fb-option">
                <input type="radio" checked={preset === 'all'} onChange={() => pickPreset(new Set(terms.map((t) => t.key)))} />
                <span className="fb-option-label">All</span>
                <span className="fb-option-n">{terms.length} terms</span>
              </label>
            </li>
            <li>
              <label className="fb-option">
                <input type="radio" checked={preset === 'latest'} onChange={() => pickPreset(latestTermKeys(terms))} />
                <span className="fb-option-label">Latest {latestN}</span>
                <span className="fb-option-n">{latestN} terms</span>
              </label>
            </li>
            <li>
              {/* Not a choice of its own: it lights up when the ticks below match neither preset. */}
              <label className="fb-option" data-auto="true" data-empty={preset !== 'custom'}>
                <input type="radio" checked={preset === 'custom'} readOnly tabIndex={-1} aria-disabled="true" />
                <span className="fb-option-label">Custom</span>
                <span className="fb-option-n">{preset === 'custom' ? `${scope.size} ${scope.size === 1 ? 'term' : 'terms'}` : 'tick terms below'}</span>
              </label>
            </li>
          </ul>
          <ul className="settings-terms">
            {[...terms].reverse().map((t) => {
              const checked = scope.has(t.key);
              const last = checked && scope.size === 1;
              return (
                <li key={t.key}>
                  <label className="fb-option" data-empty={last}>
                    <input type="checkbox" checked={checked} disabled={last} onChange={() => toggleTerm(t.key)} />
                    <span className="fb-option-label">{t.label}</span>
                    <span className="fb-option-n">{t.termLabel}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
