import { KINDS } from '../lib/review.js';

function Count({ value, color, kind, label, onJump }) {
  if (value == null) return <span className="lane-val muted">–</span>;
  if (!value) return <span className="lane-val muted">0</span>;
  return (
    <button type="button" className="lane-val" title={`Go to ${color}’s next ${label.toLowerCase()}`} onClick={() => onJump(kind, color)}>
      {value}
    </button>
  );
}

/** Thin strip comparing White and Black: accuracy, then blunders, only moves and sacrifices. */
export default function ReviewLane({ review, white, black, onJump }) {
  if (review.status === 'idle') return null;
  const s = review.summary;
  const acc = (side) => (s && s[side].accuracy != null ? Math.round(s[side].accuracy) : null);
  const [aw, ab] = [acc('white'), acc('black')];
  const running = review.status === 'running';
  const share = review.total ? review.done / review.total : 0;

  return (
    <section className="lane" aria-label="Game review">
      <div className="lane-row">
        <div className="lane-player">
          <span className="player" data-color="white">
            <span className="dot" />
            <span className="pname">{white}</span>
          </span>
        </div>
        <div className="lane-metrics">
          <div className="lane-metric">
            <span className={'lane-val' + (aw != null && aw >= (ab ?? 0) ? ' lead' : '')}>{aw ?? '–'}</span>
            <span className="lane-label">Accuracy</span>
            <span className={'lane-val' + (ab != null && ab >= (aw ?? 0) ? ' lead' : '')}>{ab ?? '–'}</span>
          </div>
          {Object.entries(KINDS).map(([kind, k]) => (
            <div key={kind} className="lane-metric">
              <Count value={s && s.white[kind]} color="white" kind={kind} label={k.label} onJump={onJump} />
              <span className="lane-label">
                <span className={'glyph ' + kind}>{k.glyph}</span> {k.plural}
              </span>
              <Count value={s && s.black[kind]} color="black" kind={kind} label={k.label} onJump={onJump} />
            </div>
          ))}
        </div>
        <div className="lane-player right">
          <span className="player" data-color="black">
            <span className="pname">{black}</span>
            <span className="dot" />
          </span>
        </div>
      </div>
      {running && (
        <div className="lane-status" role="status">
          <span>
            Reviewing the game… {review.done} of {review.total} positions
          </span>
          <div className="lane-progress" aria-hidden="true">
            <i style={{ width: (share * 100).toFixed(1) + '%' }} />
          </div>
        </div>
      )}
      {review.status === 'error' && (
        <div className="lane-status" role="status">
          <span>{review.error} The marks shown cover the moves reviewed so far.</span>
        </div>
      )}
    </section>
  );
}
