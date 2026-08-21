import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PromiseDetail } from './PromiseDetail.js';
import { toSpans } from './fuzzy.js';
import { QUALITY_META, VERDICT_PLACEHOLDER } from './model.js';
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
 *
 * Opening a promise makes it the subject: the row goes to the top of the
 * screen, the rest of the list gets out of the way, and the detail opens
 * directly underneath it. Clicking it again puts the list back — including the
 * reader's place in it, which is why the scroll offset is saved on the way in.
 * The alternative, an expander between the rows, shoves every promise below it
 * down the page while the reader is still scanning them.
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

  // The open promise, resolved against what the filters currently leave. While
  // one is open it is the *only* row rendered, so the list can't be scrolled or
  // clicked past it — the way out is the same row again, or the panel's ✕.
  const openHit = hits.find((h) => h.row.promise.id === openId) ?? null;
  const shown = openHit ? [openHit] : hits;

  const rowRef = useRef<HTMLLIElement | null>(null);
  // Where the reader was before the list collapsed, so closing gives it back.
  const restore = useRef<number | null>(null);

  const toggle = (id: string) => {
    setOpenId((cur) => {
      if (cur === id) return null;
      restore.current = window.scrollY;
      return id;
    });
  };

  // A filter can take the open promise out from under the reader. Close it —
  // but don't restore the old offset, because they moved the ground themselves.
  useEffect(() => {
    if (openId && !hits.some((h) => h.row.promise.id === openId)) {
      restore.current = null;
      setOpenId(null);
    }
  }, [hits, openId]);

  // Both moves are jumps, not glides, and deliberately so: hiding the list
  // collapses the page from the whole corpus to one row, so the browser has
  // already clamped the scroll before we get here. Animating from there reads
  // as a stutter — two movements for one click — where a jump reads as one.
  useLayoutEffect(() => {
    if (openId) {
      rowRef.current?.scrollIntoView({ block: 'start' });
    } else if (restore.current != null) {
      window.scrollTo({ top: restore.current });
      restore.current = null;
    }
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
        {openHit ? (
          <button type="button" className="pl-back" onClick={() => setOpenId(null)}>
            ← all {hits.length} promises
          </button>
        ) : (
          <span className="pl-count">
            <strong>{hits.length}</strong> of {total} promises
          </span>
        )}
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
          {shown.map((hit) => {
            const p = hit.row.promise;
            const open = openId === p.id;
            return (
              <li key={p.id} ref={open ? rowRef : undefined}>
                <button
                  type="button"
                  className="pl-row"
                  data-open={open}
                  aria-expanded={open}
                  onClick={() => toggle(p.id)}
                >
                  <span className="pl-row-head">
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
                  </span>

                  <span className="pl-row-text">
                    <Marked text={p.restatement} indices={hit.restatement} />
                  </span>

                  <span className="pl-row-foot">
                    {/* The reading leads the row, once there is one. Grey for
                        every tier today because none of these is a verdict —
                        only a statement of whether one can be reached. */}
                    <span className="pl-tag pl-tag-verdict" data-q={p.quality}>
                      {VERDICT_PLACEHOLDER[p.quality].tag}
                    </span>
                    {hit.quoteOnly && <span className="pl-row-n">matched in the quote</span>}
                    {/* What kind of promise it is, held together at the right
                        end so the two never separate across a wrap */}
                    <span className="pl-row-kind">
                      <span className="pl-tag" data-q={p.quality}>
                        {QUALITY_META[p.quality].label}
                      </span>
                      {p.occurrences.length > 1 && (
                        <span
                          className="pl-tag pl-tag-n"
                          title={`promised ${p.occurrences.length}×`}
                        >
                          ×{p.occurrences.length}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {openHit && (
        <div className="pl-detail">
          <PromiseDetail promise={openHit.row.promise} onClose={() => setOpenId(null)} />
        </div>
      )}
    </div>
  );
}
