import { Fragment, useEffect, useRef, useState } from 'react';
import { PromiseDetail } from './PromiseDetail.js';
import { toSpans } from './fuzzy.js';
import { QUALITY_META } from './model.js';
import type { PromiseHit } from './search.js';

/** A filter the reader switched on elsewhere on the board, and can switch off here. */
export interface FilterChip {
  key: string;
  /** What the chip reads, e.g. "topic: health" or "Obama 2008 · Partial". */
  label: string;
  onClear: () => void;
}

/** `text` with the matched characters wrapped, so a fuzzy hit shows its work. */
function Marked({ text, indices }: { text: string; indices: readonly number[] }) {
  if (indices.length === 0) return <>{text}</>;
  const spans = toSpans(indices);
  const out: React.ReactNode[] = [];
  let at = 0;
  for (const [start, end] of spans) {
    if (start > at) out.push(<Fragment key={`t${at}`}>{text.slice(at, start)}</Fragment>);
    out.push(<mark key={`m${start}`}>{text.slice(start, end)}</mark>);
    at = end;
  }
  if (at < text.length) out.push(<Fragment key={`t${at}`}>{text.slice(at)}</Fragment>);
  return <>{out}</>;
}

/**
 * Every promise the current filters leave, searchable as you type.
 *
 * This replaces the old flow, where the promises existed only inside a bar
 * block and a click was the only way to see any of them. The list is now the
 * standing view — it starts complete — and the chart, the donut and the tier
 * legend are ways of narrowing it. Nothing here filters anything; the board
 * owns every filter, so the same click means the same thing in all three views.
 */
export function PromiseList({
  hits,
  total,
  query,
  onQuery,
  filters,
  onClearFilters,
}: {
  hits: PromiseHit[];
  /** Promises in the whole corpus — the denominator of "showing n of N". */
  total: number;
  query: string;
  onQuery: (q: string) => void;
  filters: FilterChip[];
  onClearFilters: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  // The detail opens *under* its row, so on a long list it can land below the
  // fold with nothing on screen to say the click did anything. Bring its top
  // edge in — `nearest`, so an already-visible panel doesn't jump.
  const detailRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (openId) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [openId]);

  const filtered = filters.length > 0 || query.trim() !== '';

  return (
    <div className="pl">
      <div className="pl-search">
        <span className="pl-search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          className="pl-search-input"
          type="search"
          value={query}
          placeholder="Search"
          aria-label="Search promises"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && query !== '') {
              e.preventDefault();
              onQuery('');
            }
          }}
        />
        {query !== '' && (
          <button
            type="button"
            className="pl-search-clear"
            onClick={() => onQuery('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      <div className="pl-status">
        <span className="pl-count">
          <strong>{hits.length}</strong> of {total} promises
        </span>
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            className="pl-filter"
            onClick={f.onClear}
            title={`Remove this filter: ${f.label}`}
          >
            {f.label}
            <span className="pl-filter-x" aria-hidden="true">
              ✕
            </span>
          </button>
        ))}
        {filtered && (
          <button type="button" className="pl-reset" onClick={onClearFilters}>
            Show all
          </button>
        )}
      </div>

      {hits.length === 0 ? (
        <p className="pl-empty">
          No promises match. Loosen the search, or{' '}
          <button type="button" className="pl-link" onClick={onClearFilters}>
            show all {total}
          </button>
          .
        </p>
      ) : (
        <ul className="pl-rows">
          {hits.map((hit) => {
            const p = hit.row.promise;
            const open = openId === p.id;
            return (
              <li key={p.id} className="pl-item">
                <button
                  type="button"
                  className="pl-row"
                  data-open={open}
                  aria-expanded={open}
                  onClick={() => setOpenId((cur) => (cur === p.id ? null : p.id))}
                >
                  <span className="pl-row-who">
                    <Marked
                      text={
                        hit.row.speechYear == null
                          ? hit.row.surname
                          : `${hit.row.surname} ${hit.row.speechYear}`
                      }
                      indices={hit.who}
                    />
                  </span>
                  <span className="pl-row-theme">
                    <Marked text={p.theme} indices={hit.theme} />
                  </span>
                  <span className="pl-row-text">
                    <Marked text={p.restatement} indices={hit.restatement} />
                    <span className="pl-row-meta">
                      <span className="pl-row-q" data-q={p.quality}>
                        {QUALITY_META[p.quality].label}
                      </span>
                      {p.occurrences.length > 1 && (
                        <span className="pl-row-n">promised {p.occurrences.length}×</span>
                      )}
                      {hit.quoteOnly && <span className="pl-row-n">matched in the quote</span>}
                    </span>
                  </span>
                </button>
                {open && (
                  <div className="pl-detail" ref={detailRef}>
                    <PromiseDetail promise={p} onClose={() => setOpenId(null)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
