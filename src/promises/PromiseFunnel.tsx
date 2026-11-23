import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  QUALITIES,
  QUALITY_META,
  VERDICT_META,
  VERDICT_STATUSES,
  summarize,
  trackRecords,
  type CorpusTerm,
  type Kind,
  type Quality,
  type VerdictValue,
} from './model.js';

type Status = VerdictValue | 'review';
export type Scale = 'count' | 'percent';

/** Narrowest segment, in pixels, that still carries its number. */
const LABEL_MIN_PX = 18;

/**
 * Where each row ends, as a share of the drawing's width. In `count` both rows
 * share one scale (the term with the most promises fills the width), so the
 * verdict row sits exactly under the checkable part it judges. In `percent`
 * every row fills the width, so lengths are shares and the numbers carry the
 * absolute counts.
 */
export function rowWidths(
  scale: Scale,
  total: number,
  checkable: number,
  maxTotal: number,
): { top: number; checkableEnd: number; bottom: number } {
  if (total === 0) return { top: 0, checkableEnd: 0, bottom: 0 };
  if (scale === 'percent') return { top: 1, checkableEnd: checkable / total, bottom: 1 };
  const m = Math.max(1, maxTotal);
  return { top: total / m, checkableEnd: checkable / m, bottom: checkable / m };
}

function legendHint(value: string, name: string, picked: ReadonlySet<string>): string {
  if (!picked.has(value)) {
    return picked.size === 0 ? `Show only ${name} promises` : `Add ${name} promises`;
  }
  return picked.size === 1 ? 'Show every promise again' : `Remove ${name} promises`;
}

/**
 * Promises and what became of them, one block per term. The top row is every
 * promise the term made, by verifiability. Only high and medium promises can
 * be checked, so only they get a verdict: the bottom row is their track
 * record, and a light fan joins it to the checkable part above. Low promises,
 * too vague to check, visibly never reach the bottom row.
 *
 * The chart owns no filter. Each legend toggles the list's filter for what it
 * names (the tier legend the tier, the verdict legend the verdict); a
 * top block sets the list's term and tier, a bottom block its term and
 * verdict (clicking the same block again clears it). Blocks the list's
 * filters leave out are dimmed. Ambitions never get verdicts, so for them only
 * the top row is drawn.
 */
export function PromiseFunnel({
  terms,
  kind,
  scale,
  pickedTiers,
  onToggleTier,
  pickedVerdicts,
  onToggleVerdict,
  tierLit,
  tierPicked,
  onSelectTier,
  verdictLit,
  verdictPicked,
  onSelectVerdict,
}: {
  terms: CorpusTerm[];
  kind: Kind;
  scale: Scale;
  pickedTiers: ReadonlySet<string>;
  onToggleTier: (quality: Quality) => void;
  pickedVerdicts: ReadonlySet<string>;
  onToggleVerdict: (status: Status) => void;
  tierLit: ((termKey: string, q: Quality) => boolean) | null;
  tierPicked: (termKey: string, q: Quality) => boolean;
  onSelectTier: (termKey: string, q: Quality) => void;
  verdictLit: ((termKey: string, s: Status) => boolean) | null;
  verdictPicked: (termKey: string, s: Status) => boolean;
  onSelectVerdict: (termKey: string, s: Status) => void;
}) {
  const withVerdicts = kind === 'promise';

  const summaries = useMemo(() => summarize(terms), [terms]);
  const records = useMemo(() => new Map(trackRecords(terms).map((r) => [r.key, r])), [terms]);
  const maxTotal = Math.max(1, ...summaries.map((s) => s.total));
  const totals = useMemo(() => {
    const c: Record<Quality, number> = { high: 0, medium: 0, low: 0 };
    for (const s of summaries) for (const q of QUALITIES) c[q] += s.counts[q];
    return c;
  }, [summaries]);
  const verdictTotals = useMemo(() => {
    const c = Object.fromEntries(VERDICT_STATUSES.map((v) => [v, 0])) as Record<Status, number>;
    for (const r of records.values()) for (const v of VERDICT_STATUSES) c[v] += r.counts[v];
    return c;
  }, [records]);

  // The drawing's width decides which segments are wide enough for a number.
  const ref = useRef<HTMLDivElement>(null);
  const [rowPx, setRowPx] = useState(600);
  useLayoutEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.pf-bars');
    if (!el) return;
    const measure = () => setRowPx(el.clientWidth || 600);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [summaries.length]);

  const noun = kind === 'promise' ? 'promises' : 'ambitions';
  const anyPending = withVerdicts && [...records.values()].some((r) => r.counts.pending > 0);

  return (
    <div className="pf" ref={ref}>
      <ol className="pf-terms">
        {summaries.map((t) => {
          const r = records.get(t.key);
          const checkable = t.counts.high + t.counts.medium;
          const w = rowWidths(scale, t.total, checkable, maxTotal);
          const judged = r ? VERDICT_STATUSES.reduce((n, s) => n + r.counts[s], 0) : 0;
          const showVerdicts = withVerdicts && r != null && judged > 0;
          const keptShare = r && r.settled ? `${Math.round((r.counts.kept / r.settled) * 100)}%` : '–';
          const pending = r?.counts.pending ?? 0;
          const x = w.checkableEnd * 100;
          const xb = w.bottom * 100;
          return (
            <li key={t.key} className="pf-term">
              <div className="pf-who">
                <span className="pf-name">{t.label}</span>
                <span className="pf-span">{t.termLabel}</span>
                <span className="pf-n">
                  {t.total} {noun}
                  {withVerdicts && <> · {checkable} checkable</>}
                </span>
                {showVerdicts && (
                  <span
                    className="pf-kept"
                    data-provisional={pending > 0}
                    title={
                      pending > 0
                        ? `So far: ${r!.counts.kept} kept of ${r!.settled} decided. ${pending} of ${r!.verifiable} are still pending, so this share can change a lot by the end of the term.`
                        : 'Kept as a share of kept, partly and broken. Under review, indeterminate and pending are left out.'
                    }
                  >
                    {keptShare} <small>kept{pending > 0 ? ' so far' : ''}</small>
                  </span>
                )}
              </div>
              <div className="pf-bars">
                <div className="pf-row" style={{ width: `${w.top * 100}%` }}>
                  {QUALITIES.map((q) => {
                    const n = t.counts[q];
                    if (!n) return null;
                    const px = (n / t.total) * w.top * rowPx;
                    return (
                      <button
                        type="button"
                        key={q}
                        className="pf-seg"
                        data-q={q}
                        data-on={tierPicked(t.key, q)}
                        data-dim={tierLit != null && !tierLit(t.key, q)}
                        aria-pressed={tierPicked(t.key, q)}
                        style={{ flexGrow: n }}
                        title={`${t.label} · ${QUALITY_META[q].label}: ${n}`}
                        aria-label={`${t.label}: show the ${n} ${QUALITY_META[q].label.toLowerCase()} ${noun}`}
                        onClick={() => onSelectTier(t.key, q)}
                      >
                        {px >= LABEL_MIN_PX ? n : ''}
                      </button>
                    );
                  })}
                </div>
                {showVerdicts && (
                  <>
                    <svg className="pf-fan" viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true">
                      <polygon points={`0,0 ${x},0 ${xb},22 0,22`} />
                      <line x1="0.2" y1="0" x2="0.2" y2="22" />
                      <line x1={x} y1="0" x2={xb} y2="22" />
                    </svg>
                    <div className="pf-row" style={{ width: `${w.bottom * 100}%` }}>
                      {VERDICT_STATUSES.map((s) => {
                        const n = r!.counts[s];
                        if (!n) return null;
                        const px = (n / judged) * w.bottom * rowPx;
                        const label = VERDICT_META[s].label.toLowerCase();
                        return (
                          <button
                            type="button"
                            key={s}
                            className="pf-seg"
                            data-v={s}
                            data-on={verdictPicked(t.key, s)}
                            data-dim={verdictLit != null && !verdictLit(t.key, s)}
                            aria-pressed={verdictPicked(t.key, s)}
                            style={{ flexGrow: n }}
                            title={`${t.label}: ${n} ${label}`}
                            aria-label={`${t.label}: show the ${n} ${label}`}
                            onClick={() => onSelectVerdict(t.key, s)}
                          >
                            {px >= LABEL_MIN_PX ? <span>{n}</span> : ''}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="pc-legend" role="group" aria-label="Filter by verifiability">
        {QUALITIES.map((q) => (
          <button
            key={q}
            type="button"
            className="pc-legend-item"
            data-picked={pickedTiers.has(q)}
            aria-pressed={pickedTiers.has(q)}
            onClick={() => onToggleTier(q)}
            title={legendHint(q, QUALITY_META[q].label.toLowerCase(), pickedTiers)}
          >
            <span className="pc-swatch" data-q={q} />
            {QUALITY_META[q].label}
            <span className="pc-legend-n">{totals[q]}</span>
          </button>
        ))}
      </div>
      {withVerdicts && (
        <div className="pc-legend" role="group" aria-label="Filter by verdict (high and medium promises only)">
          {VERDICT_STATUSES.map((v) => {
            const name = VERDICT_META[v].label.toLowerCase();
            return (
              <button
                key={v}
                type="button"
                className="pc-legend-item"
                data-picked={pickedVerdicts.has(v)}
                aria-pressed={pickedVerdicts.has(v)}
                onClick={() => onToggleVerdict(v)}
                title={`${VERDICT_META[v].label}: ${VERDICT_META[v].blurb}. ${legendHint(v, name, pickedVerdicts)}.`}
              >
                <span className="pc-swatch" data-v={v} />
                {VERDICT_META[v].label}
                <span className="pc-legend-n">{verdictTotals[v]}</span>
              </button>
            );
          })}
        </div>
      )}

      {withVerdicts && (
        <p className="tr-note">
          Only high and medium promises can be checked, so only they get a verdict (bottom row of each
          term). Kept share = kept ÷ (kept + partly + broken).
          {anyPending &&
            ' For a term still running it covers only the verdicts decided so far, mostly quick actions taken early in the term, so it is provisional and not comparable with finished terms until the term ends.'}
        </p>
      )}
    </div>
  );
}
