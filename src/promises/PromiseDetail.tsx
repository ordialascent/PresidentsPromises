import { QUALITY_META, VERDICT_PLACEHOLDER, type CorpusPromise } from './model.js';

/**
 * One promise opened up: every time it was made, quoted and cited, and what can
 * (or cannot) be said about keeping it. Opens inline under its row in the list.
 */
export function PromiseDetail({
  promise,
  onClose,
}: {
  promise: CorpusPromise;
  onClose: () => void;
}) {
  const verdict = VERDICT_PLACEHOLDER[promise.quality];

  return (
    <div className="pc-detail" data-q={promise.quality}>
      <div className="pc-detail-top">
        <span className="pc-detail-tier" data-q={promise.quality}>
          {QUALITY_META[promise.quality].label}
        </span>
        <span className="pc-detail-theme">{promise.theme}</span>
        {promise.occurrences.length > 1 && (
          <span className="pc-detail-count">promised {promise.occurrences.length}×</span>
        )}
        <button
          type="button"
          className="pc-detail-close"
          onClick={onClose}
          aria-label="Close promise detail"
        >
          ✕
        </button>
      </div>
      <div className="pc-detail-title">{promise.restatement}</div>
      {promise.occurrences.map((o, k) => (
        <div className="pc-detail-occ" key={`${o.source.kind}-${k}`}>
          <blockquote className="pc-detail-quote">“{o.quote}”</blockquote>
          <div className="pc-detail-context">
            <span className="pc-detail-speaker">{o.source.speaker}</span>
            {o.source.year != null && (
              <>
                <span className="pc-detail-dot">·</span>
                <span>{o.source.year}</span>
              </>
            )}
            <span className="pc-detail-dot">·</span>
            <span className="pc-detail-event">{o.source.event}</span>
            <span className="pc-detail-medium">{o.source.medium}</span>
          </div>
          {(o.ref || o.source.url) && (
            <div className="pc-detail-cite">
              {o.ref && <span className="pc-detail-ref">{o.ref}</span>}
              {o.source.url && (
                <a href={o.source.url} target="_blank" rel="noreferrer">
                  {o.source.publisher || 'source'} ↗
                </a>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Kept-or-broken lives here once the scoring pass exists; for now the
          tier decides whether there is anything to wait for. */}
      <hr className="pc-detail-rule" />
      <div className="pc-verdict" data-q={promise.quality}>
        <div className="pc-verdict-head">
          <span className="pc-verdict-mark" data-q={promise.quality} aria-hidden="true">
            {verdict.mark}
          </span>
          <span className="pc-verdict-label">{verdict.label}</span>
        </div>
        <p className="pc-verdict-note">{verdict.note}</p>
      </div>
    </div>
  );
}
