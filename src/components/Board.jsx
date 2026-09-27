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
export default function Board({ node, orientation, arrows, onMove, redraw }) {
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

  return (
    <div className="boardsize">
      <div ref={el} className="board" />
    </div>
  );
}
