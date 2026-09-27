import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import { chessAt, turnOf } from '../lib/chess.js';
import { destsFor } from '../lib/tree.js';

const BRUSHES = {
  e1: { key: 'e1', color: '#3d8bd9', opacity: 0.95, lineWidth: 12 },
  e2: { key: 'e2', color: '#3d8bd9', opacity: 0.55, lineWidth: 9 },
  e3: { key: 'e3', color: '#3d8bd9', opacity: 0.35, lineWidth: 7 },
};

/** Lichess's chessground board. Either color can be moved (see GameTree.userMove). */
const PROMOTION_PIECES = [
  ['q', 'queen'],
  ['n', 'knight'],
  ['r', 'rook'],
  ['b', 'bishop'],
];

/** Lichess-style picker: the four pieces stacked on the promotion square's file, from the board edge inward. */
function PromotionPicker({ to, color, orientation, onPick }) {
  const first = useRef(null);
  useEffect(() => {
    first.current && first.current.focus();
    const onKey = (e) => e.key === 'Escape' && onPick(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onPick]);
  const file = to.charCodeAt(0) - 97;
  const col = orientation === 'white' ? file : 7 - file;
  const fromTop = (to[1] === '8') === (orientation === 'white');
  return (
    <div className="cg-wrap promo" role="dialog" aria-label="Promote to" onClick={() => onPick(null)}>
      {PROMOTION_PIECES.map(([p, name], i) => (
        <button
          key={p}
          ref={i === 0 ? first : null}
          type="button"
          aria-label={name}
          style={{ left: col * 12.5 + '%', [fromTop ? 'top' : 'bottom']: i * 12.5 + '%' }}
          onClick={(e) => {
            e.stopPropagation();
            onPick(p);
          }}
        >
          <piece className={name + ' ' + color} />
        </button>
      ))}
    </div>
  );
}

export default function Board({ node, orientation, arrows, onMove, redraw, visible = true, promotion, onPromote }) {
  const el = useRef(null);
  const api = useRef(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    api.current = Chessground(el.current, {
      coordinates: true,
      animation: { enabled: true, duration: 180 },
      highlight: { lastMove: true, check: true },
      movable: { free: false, color: 'both', showDests: true, events: { after: (o, d) => onMoveRef.current(o, d) } },
      premovable: { enabled: false },
      draggable: { showGhost: true },
      drawable: { enabled: true, brushes: BRUSHES },
    });
    return () => api.current && api.current.destroy();
  }, []);

  useEffect(() => {
    const turn = turnOf(node.fen);
    api.current.set({
      fen: node.fen,
      orientation,
      turnColor: turn,
      lastMove: node.lastMove || undefined,
      check: chessAt(node.fen).inCheck() ? turn : false,
      movable: { color: 'both', dests: destsFor(node) },
    });
  }, [node, orientation, redraw]);

  useEffect(() => {
    api.current.setAutoShapes(
      arrows.map((u, i) => ({ orig: u.slice(0, 2), dest: u.slice(2, 4), brush: ['e1', 'e2', 'e3'][i] })).reverse()
    );
  }, [arrows]);

  // Chessground measures the board once; re-measure after it was hidden by another page.
  useEffect(() => {
    if (visible) api.current.redrawAll();
  }, [visible]);

  return (
    <div className="boardsize">
      <div ref={el} className="board" />
      {promotion && <PromotionPicker to={promotion.to} color={promotion.color} orientation={orientation} onPick={onPromote} />}
    </div>
  );
}
