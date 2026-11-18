import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PromiseDetail } from './PromiseDetail.js';
import { toSpans } from './fuzzy.js';
import { QUALITY_META, verdictFor } from './model.js';
import type { PromiseHit } from './search.js';

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
 * standing view — it starts complete — and the filter bar under the search
 * box narrows it. Nothing here filters anything; the board owns every filter,
 * so a click on a chart and a pick in the filter bar set the same state.
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
  filterBar,
  onClearFilters,
  noun = 'promises',
}: {
  hits: PromiseHit[];
  /** Records of this kind in the whole corpus — the denominator of "showing n of N". */
  total: number;
  /** What the records are called: "promises" or "ambitions". */
  noun?: string;
  query: string;
  onQuery: (q: string) => void;
  /** The filter bar, drawn between the search box and the list. */
  filterBar: React.ReactNode;
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
          aria-label={`Search ${noun}`}
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

      {filterBar}

      <div className="pl-status">
        {openHit ? (
          <button type="button" className="pl-back" onClick={() => setOpenId(null)}>
            ← all {hits.length} {noun}
          </button>
        ) : (
          <span className="pl-count">
            <strong>{hits.length}</strong> of {total} {noun}
          </span>
        )}
      </div>

      {hits.length === 0 ? (
        <p className="pl-empty">
          No {noun} match. Loosen the search, or{' '}
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
                    {/* The reading leads the row: the verdict, coloured, or
                        in grey why there is none. */}
                    <span className="pl-verdict" data-q={p.quality} data-v={verdictFor(p).status}>
                      {verdictFor(p).tag}
                    </span>
                    {hit.quoteOnly && <span className="pl-row-n">matched in the quote</span>}
                    {/* What kind of promise it is, held together at the right
                        end so the two never separate across a wrap */}
                    <span className="pl-row-kind">
                      <span className="pl-meta">{p.protocol.type}</span>
                      <span className="pl-tier" data-q={p.quality}>
                        {QUALITY_META[p.quality].label}
                      </span>
                      {p.occurrences.length > 1 && (
                        <span className="pl-mult" title={`promised ${p.occurrences.length}×`}>
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
