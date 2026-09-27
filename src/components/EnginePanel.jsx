import { MULTIPV } from '../lib/engine.js';
import { KINDS } from '../lib/review.js';
import { chessAt, fmtEval, moveNumberLabel, pvToSan, turnOf } from '../lib/chess.js';

/** Numbered SAN moves. With onPick, each move is clickable (mouse); the row itself handles the keyboard. */
function Sans({ sans, firstClass, onPick }) {
  return sans.map((m, j) => (
    <span key={j}>
      {j > 0 && ' '}
      {m.num && <span className="num">{m.num}</span>}
      <span
        className={'san' + (j === 0 && firstClass ? ' ' + firstClass : '') + (onPick ? ' pick' : '')}
        onClick={
          onPick &&
          ((e) => {
            e.stopPropagation();
            onPick(j);
          })
        }
      >
        {m.san}
      </span>
    </span>
  ));
}

function Ev({ line }) {
  if (!line) return <span className="ev">…</span>;
  return <span className={'ev ' + (line.value >= 0 ? 'w' : 'b')}>{fmtEval(line)}</span>;
}

/** The move that led here: its evaluation and whether it was one of the engine's top 5. */
function PlayedRow({ node, best, cache, mark }) {
  if (!node.parent || !node.uci) return null;
  const prevLines = cache.get(node.parent.fen) || [];
  const rank = prevLines.findIndex((l) => l && l.pv[0] === node.uci);
  const listed = rank >= 0;
  const known = prevLines.filter(Boolean).length >= Math.min(MULTIPV, chessAt(node.parent.fen).moves().length);
  const { n, black } = moveNumberLabel(node.parent.fen);
  const who = node.main ? 'Played' : 'Your move';
  const over = chessAt(node.fen).isGameOver();
  const cls = ['line', 'played'];
  if (known && !listed) cls.push('unlisted');
  if (!node.main) cls.push('mine');
  return (
    <li className={cls.join(' ')} aria-label={who}>
      <span className="rank" title={who}>▸</span>
      {best ? <Ev line={best} /> : <span className="ev">{over ? '–' : '…'}</span>}
      <span className="pv">
        <span className="who">
          {who}
          {listed && <span className="tag ok">#{rank + 1} of top 5</span>}
          {known && !listed && <span className="tag off">Not in top 5</span>}
          {mark && (
            <span className={'tag rv ' + mark}>
              {KINDS[mark].glyph} {KINDS[mark].label}
            </span>
          )}
        </span>
        <span className="num">
          {n}
          {black ? '…' : '.'}
        </span>
        <span className="san first">{node.san}</span> {best && <Sans sans={pvToSan(node.fen, best.pv, 8, false)} />}
      </span>
    </li>
  );
}

export default function EnginePanel({ node, engine, engineOn, locked, depth, onToggle, onDepth, onPlay, mark }) {
  const { lines, meta, status, error, ready, cache } = engine;
  const fen = node.fen;
  const c = chessAt(fen);
  const best = lines[0];

  let evalLabel = '';
  let evalSide = 'none';
  if (c.isCheckmate()) {
    evalLabel = turnOf(fen) === 'white' ? '0-1' : '1-0';
    evalSide = turnOf(fen) === 'white' ? 'b' : 'w';
  } else if (c.isGameOver()) evalLabel = '½';
  else if (best && engineOn) {
    evalLabel = fmtEval(best).replace('+', '');
    evalSide = best.value >= 0 ? 'w' : 'b';
  }

  let statusText;
  if (!engineOn) statusText = 'Off';
  else if (error) statusText = error;
  else if (!ready) statusText = 'Loading engine…';
  else {
    const knps = meta.nps ? ` · ${Math.round(meta.nps / 1000)} kn/s` : '';
    statusText = `Depth ${meta.depth || 0}/${depth}${knps}`;
  }

  let body;
  if (error) body = <li className="line empty">{error}</li>;
  else if (!engineOn)
    body = (
      <li className="line empty">
        {locked ? 'Engine is off while this game is in progress.' : 'Engine is off. Turn it on to see the top 5 moves.'}
      </li>
    );
  else {
    const rows = [];
    if (c.isGameOver()) {
      let msg = 'Game over.';
      if (c.isCheckmate()) msg = `Checkmate. ${turnOf(fen) === 'white' ? 'Black' : 'White'} wins.`;
      else if (c.isStalemate()) msg = 'Stalemate.';
      else if (c.isDraw()) msg = 'Draw.';
      rows.push(
        <li key="over" className="line empty">
          {msg}
        </li>
      );
    } else {
      const count = Math.min(MULTIPV, c.moves().length);
      for (let i = 0; i < count; i++) {
        const l = lines[i];
        if (!l) {
          rows.push(
            <li key={i} className="line pending">
              <span className="rank">{i + 1}</span>
              <span className="ev">…</span>
              <span className="pv">
                <span className="skel" />
              </span>
            </li>
          );
          continue;
        }
        const sans = pvToSan(fen, l.pv, 12);
        const pv = l.pv.slice(0, sans.length);
        rows.push(
          <li
            key={i}
            className="line"
            tabIndex={0}
            role="button"
            aria-label={`Show line ${i + 1}: ${sans.map((m) => m.san).join(' ')}`}
            title="Click a move to see that position"
            onClick={() => onPlay(pv, 0)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPlay(pv, 0);
              }
            }}
          >
            <span className="rank">{i + 1}</span>
            <Ev line={l} />
            <span className="pv">
              <Sans sans={sans} firstClass="first" onPick={(j) => onPlay(pv, j)} />
            </span>
          </li>
        );
      }
    }
    body = (
      <>
        <PlayedRow node={node} best={best} cache={cache} mark={mark} />
        {rows}
      </>
    );
  }

  return (
    <section className="card" aria-label="Engine">
      <div className="card-head">
        <span className="evalchip" data-side={evalLabel ? evalSide : 'none'}>
          {evalLabel || '–'}
        </span>
        <div className="engine-name">
          <strong>Stockfish 19</strong>
          <span aria-live="polite">{statusText}</span>
        </div>
        <div className="controls">
          <select id="depth-select" aria-label="Search depth" value={depth} onChange={(e) => onDepth(+e.target.value)}>
            {[14, 18, 20, 24, 30].map((d) => (
              <option key={d} value={d}>
                Depth {d}
              </option>
            ))}
          </select>
          <label className="switch" title={locked ? 'Engine is off while the game is in progress' : 'Engine on/off'}>
            <input
              type="checkbox"
              id="engine-toggle"
              checked={engineOn}
              disabled={locked}
              onChange={(e) => onToggle(e.target.checked)}
              aria-label="Engine on"
            />
            <span className="track" />
          </label>
        </div>
        <span className="sr-only">{status === 'thinking' ? 'Thinking' : 'Done'}</span>
      </div>
      <ul className="lines">{body}</ul>
    </section>
  );
}
