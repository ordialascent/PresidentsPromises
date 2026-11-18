import { useEffect, useRef, useState } from 'react';

export interface FacetOption {
  value: string;
  label: string;
  /** Rows this option would show, given the other facets. */
  count: number;
}

export interface FacetControl {
  key: string;
  /** The dropdown's name, e.g. "Topic". */
  label: string;
  options: FacetOption[];
  picked: ReadonlySet<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
}

/** "Topic", "Topic: health", or "Topic: health +2". */
function summary(c: FacetControl): string {
  if (c.picked.size === 0) return c.label;
  const first = c.options.find((o) => c.picked.has(o.value));
  const name = first?.label ?? [...c.picked][0];
  return c.picked.size === 1 ? `${c.label}: ${name}` : `${c.label}: ${name} +${c.picked.size - 1}`;
}

/**
 * One row of multi-select dropdowns that narrow the list, and a "Show all"
 * that clears them. Within a dropdown the picks are alternatives; across
 * dropdowns they narrow together. Each option shows how many rows it would
 * leave given the other dropdowns, and an option at zero is greyed out but
 * stays where it is, so the menu never reshuffles under the cursor.
 */
export function FilterBar({
  controls,
  active,
  onClearAll,
}: {
  controls: FacetControl[];
  /** Whether anything (a filter or the search) is narrowing the list. */
  active: boolean;
  onClearAll: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  // A click anywhere outside the bar, or Escape, closes the open menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="fb" ref={barRef} role="group" aria-label="Filters">
      {controls.map((c) => {
        const isOpen = open === c.key;
        const on = c.picked.size > 0;
        return (
          <div className="fb-facet" key={c.key}>
            <button
              type="button"
              className="fb-button"
              data-on={on}
              aria-expanded={isOpen}
              aria-haspopup="true"
              onClick={() => setOpen(isOpen ? null : c.key)}
            >
              <span className="fb-button-text">{summary(c)}</span>
              <span className="fb-caret" aria-hidden="true">
                ▾
              </span>
            </button>
            {isOpen && (
              <div className="fb-menu" role="group" aria-label={c.label}>
                <ul>
                  {c.options.map((o) => {
                    const checked = c.picked.has(o.value);
                    const empty = o.count === 0 && !checked;
                    return (
                      <li key={o.value}>
                        <label className="fb-option" data-empty={empty}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={empty}
                            onChange={() => c.onToggle(o.value)}
                          />
                          <span className="fb-option-label">{o.label}</span>
                          <span className="fb-option-n">{o.count}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {on && (
                  <button type="button" className="fb-menu-clear" onClick={c.onClear}>
                    Clear {c.label.toLowerCase()}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      {active && (
        <button type="button" className="fb-reset" onClick={onClearAll}>
          Show all
        </button>
      )}
    </div>
  );
}
