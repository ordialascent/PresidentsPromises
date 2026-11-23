import { useEffect, useRef, useState } from 'react';
import type { CorpusTerm } from './model.js';
import { LATEST_TERMS, latestTermKeys, scopePreset, scopeSpan } from './model.js';

/**
 * Which terms the board covers: the latest few (the default), all of them, or
 * a hand-picked set from a checklist. The switch opens with a fixed segment
 * naming the span, so the reader always knows what the charts and counts are
 * about.
 */
export function TermScope({
  terms,
  scope,
  onScope,
}: {
  /** Every term in the corpus, oldest first. */
  terms: CorpusTerm[];
  scope: ReadonlySet<string>;
  onScope: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const preset = scopePreset(scope, terms);
  const latestN = Math.min(LATEST_TERMS, terms.length);

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

  const toggle = (key: string) => {
    const next = new Set(scope);
    if (next.has(key)) {
      if (next.size === 1) return; // keep at least one term
      next.delete(key);
    } else next.add(key);
    onScope(next);
  };

  return (
    <div className="scope" ref={ref} role="group" aria-label="Terms shown">
      <div className="kind-switch">
        <span className="scope-span" aria-live="polite">
          {scope.size === 1 ? '1 term' : `${scope.size} terms`} · {scopeSpan(scope, terms)}
        </span>
        <button
          type="button"
          data-on={preset === 'latest'}
          aria-pressed={preset === 'latest'}
          onClick={() => onScope(latestTermKeys(terms))}
        >
          Latest {latestN}
        </button>
        <button
          type="button"
          data-on={preset === 'all'}
          aria-pressed={preset === 'all'}
          onClick={() => onScope(new Set(terms.map((t) => t.key)))}
        >
          All {terms.length}
        </button>
        <button
          type="button"
          data-on={preset === 'custom'}
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => setOpen((o) => !o)}
        >
          {preset === 'custom' ? `${scope.size} picked` : 'Choose'}
          <span className="fb-caret" aria-hidden="true">
            ▾
          </span>
        </button>
      </div>
      {open && (
        <div className="fb-menu scope-menu" role="group" aria-label="Choose terms">
          <ul>
            {[...terms].reverse().map((t) => {
              const checked = scope.has(t.key);
              const last = checked && scope.size === 1;
              return (
                <li key={t.key}>
                  <label className="fb-option" data-empty={last}>
                    <input type="checkbox" checked={checked} disabled={last} onChange={() => toggle(t.key)} />
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
