import { CORPUS_TERMS } from '../content/promises.generated.js';
import { METHOD_META, QUALITY_META, verdictFor, type CorpusPromise } from './model.js';

/** Every record by id, so a link can name what it points at. */
const BY_ID = new Map(
  CORPUS_TERMS.flatMap((t) => [...t.promises, ...t.ambitions]).map((p) => [p.id, p]),
);

const LINK_LABEL: Record<string, string> = {
  refines: 'Sharpens',
  repeats: 'Repeats',
  shared: 'Also promised by another president',
};

const TYPE_LABEL: Record<string, string> = {
  action: 'Action: kept by a discrete act',
  outcome: 'Outcome: kept by a state of the world',
  ongoing: 'Ongoing: kept by conduct throughout the term',
};

/** The protocol's description of one record: how it was read, and how it could be checked. */
function ProtocolFacts({ promise }: { promise: CorpusPromise }) {
  const f = promise.protocol;
  if (!f) return null;
  const v = f.verifiability;
  const rows: [string, React.ReactNode][] = [
    ['Type', TYPE_LABEL[f.type] ?? f.type],
    [
      'Deadline',
      f.deadline.stated ? (
        <>
          “{f.deadline.stated}” → {f.deadline.applied}
        </>
      ) : (
        <>{f.deadline.applied} (end of term)</>
      ),
    ],
    ['Verifiability', QUALITY_META[promise.quality].label],
  ];
  if (v.object) rows.push(['Object', v.object]);
  if (v.record) rows.push(['Record', v.record]);
  if (v.criterion) rows.push(['Criterion', v.criterion]);
  if (v.ambiguity) rows.push(['Judgement call', v.ambiguity]);
  if (f.uncertainty.extraction !== 'clear') {
    rows.push([
      'Extraction',
      <>
        {f.uncertainty.extraction}
        {f.uncertainty.note ? `: ${f.uncertainty.note}` : ''}
      </>,
    ]);
  }
  for (const l of f.links) {
    rows.push([LINK_LABEL[l.kind] ?? l.kind, BY_ID.get(l.to)?.restatement ?? l.to]);
  }
  return (
    <dl className="pc-facts">
      {rows.map(([k, val], i) => (
        <div className="pc-facts-row" key={`${k}-${i}`}>
          <dt>{k}</dt>
          <dd>{val}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One promise opened up: every time it was made, quoted and cited, and what can
 * (or cannot) be said about keeping it.
 *
 * It only ever opens directly beneath its own row, and that row carries the
 * tier, the topic and the recurrence as tags — so this panel does not repeat
 * them. It starts at the promise and goes straight to the evidence.
 */
export function PromiseDetail({
  promise,
  onClose,
}: {
  promise: CorpusPromise;
  onClose: () => void;
}) {
  const verdict = verdictFor(promise);

  return (
    <div className="pc-detail" data-q={promise.quality}>
      <div className="pc-detail-top">
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

      <hr className="pc-detail-rule" />
      {promise.protocol ? (
        <ProtocolFacts promise={promise} />
      ) : (
        <p className="pc-detail-legacy">{METHOD_META.legacy.note}</p>
      )}

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
