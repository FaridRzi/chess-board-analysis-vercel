import { useEffect, useRef, useState } from 'react';
import { Chessground } from 'chessground';
import { Chess, validateFen } from 'chess.js';
import { START_FEN } from '../lib/chess.js';

const ROLES = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
const EMPTY = '8/8/8/8/8/8/8/8';
const CASTLES = [
  { flag: 'K', label: 'White O-O', king: 'e1', rook: 'h1', color: 'w' },
  { flag: 'Q', label: 'White O-O-O', king: 'e1', rook: 'a1', color: 'w' },
  { flag: 'k', label: 'Black O-O', king: 'e8', rook: 'h8', color: 'b' },
  { flag: 'q', label: 'Black O-O-O', king: 'e8', rook: 'a8', color: 'b' },
];

/** Board part of a FEN → { e1: 'K', … } */
function squaresOf(placement) {
  const out = {};
  placement.split('/').forEach((row, i) => {
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) file += +ch;
      else out['abcdefgh'[file++] + (8 - i)] = ch;
    }
  });
  return out;
}

/** Eight ranks of exactly eight squares each. */
function isPlacement(p) {
  const rows = p.split('/');
  return rows.length === 8 && rows.every((r) => /^[1-8pnbrqkPNBRQK]+$/.test(r) && [...r].reduce((n, ch) => n + (+ch || 1), 0) === 8);
}

/** Castling flags the pieces still allow (king and rook on their home squares). */
function possibleCastles(placement) {
  const sq = squaresOf(placement);
  return CASTLES.filter((c) => {
    const [k, r] = c.color === 'w' ? ['K', 'R'] : ['k', 'r'];
    return sq[c.king] === k && sq[c.rook] === r;
  }).map((c) => c.flag);
}

function buildFen(placement, turn, castling) {
  const possible = possibleCastles(placement);
  const rights = CASTLES.map((c) => c.flag)
    .filter((f) => castling.includes(f) && possible.includes(f))
    .join('');
  return `${placement} ${turn} ${rights || '-'} - 0 1`;
}

/** Why a position can't be analyzed, in plain words, or null if it's fine. */
function problemWith(fen) {
  const [placement, turn] = fen.split(' ');
  const pieces = Object.entries(squaresOf(placement));
  const count = (p) => pieces.filter(([, x]) => x === p).length;
  for (const [k, side] of [
    ['K', 'white'],
    ['k', 'black'],
  ]) {
    if (count(k) === 0) return `Add a ${side} king.`;
    if (count(k) > 1) return `There can only be one ${side} king.`;
  }
  if (pieces.some(([sq, x]) => /p/i.test(x) && /[18]/.test(sq[1]))) return 'Pawns can’t stand on the first or last rank.';
  const v = validateFen(fen);
  if (!v.ok) return v.error;
  const other = new Chess(fen.replace(` ${turn} `, turn === 'w' ? ' b ' : ' w '));
  if (other.inCheck()) {
    const [mover, checked] = turn === 'w' ? ['White', 'Black'] : ['Black', 'White'];
    return `${checked}’s king is in check, so it can’t be ${mover}’s turn.`;
  }
  return null;
}

function SpareRow({ color, tool, onTool, onDragStart }) {
  const is = (t) => tool && tool.color === color && tool.role === t;
  return (
    <div className="cg-wrap spare-row" role="toolbar" aria-label={`${color} pieces`}>
      <button type="button" className={'tool' + (!tool ? ' on' : '')} aria-pressed={!tool} aria-label="Move pieces" onClick={() => onTool(null)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3l12 9-5.5 1.2L16 20l-2.6 1.2-3-6.6L6 18z" />
        </svg>
      </button>
      {ROLES.map((role) => (
        <button
          key={role}
          type="button"
          className={is(role) ? 'on' : ''}
          aria-pressed={is(role)}
          aria-label={`${color} ${role}`}
          onMouseDown={(e) => onDragStart({ color, role }, e.nativeEvent)}
          onTouchStart={(e) => onDragStart({ color, role }, e.nativeEvent)}
          onClick={() => onTool(is(role) ? null : { color, role })}
        >
          <piece className={`${role} ${color}`} />
        </button>
      ))}
      <button
        type="button"
        className={'tool' + (tool === 'trash' ? ' on' : '')}
        aria-pressed={tool === 'trash'}
        aria-label="Remove pieces"
        onClick={() => onTool(tool === 'trash' ? null : 'trash')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Free board setup. Drag pieces around or off the board, drag new ones in from the rows above
 * and below, or pick a piece (or the bin) and click squares.
 */
export default function BoardEditor({ initialFen, initialOrientation, onDone, onCancel }) {
  const [f0, t0, c0] = initialFen.split(' ');
  const [placement, setPlacement] = useState(f0);
  const [turn, setTurn] = useState(t0 === 'b' ? 'b' : 'w');
  const [castling, setCastling] = useState(c0 && c0 !== '-' ? c0 : '');
  const [orientation, setOrientation] = useState(initialOrientation);
  const [tool, setTool] = useState(null); // null = move pieces · { color, role } · 'trash'
  const [fenDraft, setFenDraft] = useState(null); // text while the FEN box is being edited
  const el = useRef(null);
  const api = useRef(null);
  const toolRef = useRef(tool);
  toolRef.current = tool;

  useEffect(() => {
    const cg = Chessground(el.current, {
      fen: placement,
      orientation,
      coordinates: true,
      animation: { enabled: true, duration: 120 },
      highlight: { lastMove: false, check: false },
      movable: { free: true, color: 'both', showDests: false },
      premovable: { enabled: false },
      draggable: { showGhost: true, deleteOnDropOff: true },
      drawable: { enabled: false },
      events: {
        change: () => setPlacement(cg.getFen()),
        select: (key) => {
          const t = toolRef.current;
          if (!t) return;
          const cur = cg.state.pieces.get(key);
          const same = t !== 'trash' && cur && cur.role === t.role && cur.color === t.color;
          cg.setPieces(new Map([[key, t === 'trash' || same ? undefined : { role: t.role, color: t.color }]]));
          setPlacement(cg.getFen());
        },
      },
    });
    api.current = cg;
    return () => cg.destroy();
  }, []);

  // With a piece or the bin picked, clicks place/remove instead of moving pieces.
  useEffect(() => {
    api.current.set({ draggable: { enabled: !tool }, selectable: { enabled: !tool } });
    api.current.selectSquare(null);
  }, [tool]);
  useEffect(() => api.current.set({ orientation }), [orientation]);

  const loadPlacement = (p) => {
    api.current.set({ fen: p });
    setPlacement(api.current.getFen());
  };
  const onSpareDrag = (piece, e) => {
    if (toolRef.current) return; // in click mode a press just picks the tool
    api.current.dragNewPiece(piece, e);
  };

  const possible = possibleCastles(placement);
  const fen = buildFen(placement, turn, castling);
  const problem = problemWith(fen);

  // Typing or pasting a FEN applies it as soon as its board part is complete.
  const onFenInput = (text) => {
    setFenDraft(text);
    const [p, t, c] = text.trim().split(/\s+/);
    if (!isPlacement(p || '')) return;
    if (p !== placement) loadPlacement(p);
    setTurn(t === 'b' ? 'b' : 'w');
    setCastling(c && c !== '-' ? c : '');
  };

  const top = orientation === 'white' ? 'black' : 'white';
  const bottom = orientation === 'white' ? 'white' : 'black';

  return (
    <main className="layout editor">
      <section className="boardcol" aria-label="Board setup">
        <SpareRow color={top} tool={tool} onTool={setTool} onDragStart={onSpareDrag} />
        <div className={'boardsize' + (tool ? ' placing' : '')}>
          <div ref={el} className="board" />
        </div>
        <SpareRow color={bottom} tool={tool} onTool={setTool} onDragStart={onSpareDrag} />
        <p className="editor-hint">
          {tool === 'trash'
            ? 'Click pieces to remove them.'
            : tool
              ? `Click squares to place a ${tool.color} ${tool.role}. Click one again to remove it.`
              : 'Drag pieces to move them, or off the board to remove them. Drag new pieces in from the rows, or pick one and click squares.'}
        </p>
      </section>

      <aside className="side">
        <section className="card editor-card" aria-label="Position settings">
          <div className="card-head">
            <h2>Set up position</h2>
          </div>
          <div className="editor-body">
            <div className="field">
              <span>Side to move</span>
              <div className="seg-control">
                {[
                  ['w', 'White'],
                  ['b', 'Black'],
                ].map(([t, label]) => (
                  <button key={t} type="button" aria-pressed={turn === t} onClick={() => setTurn(t)}>
                    {label} to move
                  </button>
                ))}
              </div>
            </div>

            <fieldset className="field">
              <legend>Castling</legend>
              <div className="castles">
                {CASTLES.map((c) => (
                  <label key={c.flag} className={possible.includes(c.flag) ? '' : 'off'}>
                    <input
                      type="checkbox"
                      disabled={!possible.includes(c.flag)}
                      checked={castling.includes(c.flag) && possible.includes(c.flag)}
                      onChange={(e) => setCastling((s) => (e.target.checked ? s + c.flag : s.replace(c.flag, '')))}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="editor-actions">
              <button type="button" onClick={() => (loadPlacement(START_FEN.split(' ')[0]), setTurn('w'), setCastling('KQkq'))}>
                Starting position
              </button>
              <button type="button" onClick={() => (loadPlacement(EMPTY), setCastling(''))}>
                Clear board
              </button>
              <button type="button" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>
                Flip board
              </button>
            </div>

            <label className="field">
              <span>FEN</span>
              <input
                className="mono"
                spellCheck={false}
                autoComplete="off"
                value={fenDraft ?? fen}
                onChange={(e) => onFenInput(e.target.value)}
                onBlur={() => setFenDraft(null)}
              />
            </label>

            {problem && (
              <div className="notice warn" role="status">
                {problem}
              </div>
            )}
          </div>
          <div className="editor-foot">
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={!!problem} onClick={() => onDone(fen, orientation)}>
              Analyze position
            </button>
          </div>
        </section>
      </aside>
    </main>
  );
}
