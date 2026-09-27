// Move tree. Every position is a node; game moves are `main`,
// everything the user plays is a side line.
import { Chess } from 'chess.js';
import { chessAt, tryMove } from './chess.js';

export class GameTree {
  constructor(startFen, moveList) {
    this.idSeq = 0;
    this.byId = new Map();
    this.root = this.make(null, startFen, null, true);
    const c = new Chess(startFen);
    let node = this.root;
    for (const mv of moveList) {
      const r = tryMove(c, mv.from ? { from: mv.from, to: mv.to, promotion: mv.promotion } : mv.san || mv);
      if (!r) break;
      const child = this.make(node, c.fen(), r, true);
      node.children.push(child);
      node = child;
    }
    this.end = node;
  }
  make(parent, fen, r, main) {
    const node = {
      id: ++this.idSeq,
      parent,
      fen,
      san: r ? r.san : null,
      uci: r ? r.from + r.to + (r.promotion || '') : null,
      lastMove: r ? [r.from, r.to] : null,
      children: [],
      main: !!main,
    };
    this.byId.set(node.id, node);
    return node;
  }
  addChild(parent, r, fen) {
    const uci = r.from + r.to + (r.promotion || '');
    const existing = parent.children.find((c) => c.uci === uci);
    if (existing) return existing;
    const node = this.make(parent, fen, r, false);
    parent.children.push(node);
    return node;
  }
  /** Plays a UCI move from `node` and returns the resulting node (or null if illegal). */
  playUci(node, uci) {
    const c = chessAt(node.fen);
    const r = tryMove(c, { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return r ? this.addChild(node, r, c.fen()) : null;
  }
  /**
   * A drag on the board. A piece of the side to move plays the next move;
   * a piece of the side that just moved changes that move instead.
   */
  userMove(node, from, to) {
    const here = chessAt(node.fen);
    const piece = here.get(from);
    const turn = node.fen.split(' ')[1];
    if (piece && piece.color === turn) {
      const r = tryMove(here, { from, to, promotion: 'q' });
      return r ? this.addChild(node, r, here.fen()) : null;
    }
    if (node.parent && node.lastMove) {
      const [lf, lt] = node.lastMove;
      const origin = from === lt ? lf : from;
      const before = chessAt(node.parent.fen);
      const r = tryMove(before, { from: origin, to, promotion: 'q' });
      return r ? this.addChild(node.parent, r, before.fen()) : null;
    }
    return null;
  }
  deleteLineAt(node) {
    const start = lineStartOf(node);
    const parent = start.parent;
    if (!parent || start.main) return node;
    parent.children = parent.children.filter((c) => c !== start);
    return parent;
  }
}

export function nextOf(node) {
  if (!node.children.length) return null;
  if (node.main) return node.children.find((c) => c.main) || node.children[0];
  return node.children[0];
}
export function lastOf(node) {
  let n = node;
  let nx;
  while ((nx = nextOf(n))) n = nx;
  return n;
}
export function mainAncestor(node) {
  let n = node;
  while (n.parent && !n.main) n = n.parent;
  return n;
}
export function lineStartOf(node) {
  let n = node;
  while (n.parent && !n.parent.main) n = n.parent;
  return n;
}
export function isAncestorOrSelf(ancestor, node) {
  for (let n = node; n; n = n.parent) if (n === ancestor) return true;
  return false;
}

/** Legal drops for the board: next moves, plus changes to the move just played. */
export function destsFor(node) {
  const d = new Map();
  const push = (from, to) => {
    if (!d.has(from)) d.set(from, []);
    const arr = d.get(from);
    if (!arr.includes(to)) arr.push(to);
  };
  for (const m of chessAt(node.fen).moves({ verbose: true })) push(m.from, m.to);
  if (node.parent && node.lastMove) {
    const [lf, lt] = node.lastMove;
    const now = chessAt(node.fen);
    for (const m of chessAt(node.parent.fen).moves({ verbose: true })) {
      const key = m.from === lf ? lt : m.from;
      const piece = now.get(key);
      if (!piece || piece.color !== m.color) continue;
      if (m.to === key) continue;
      if (m.from === lf && m.to === lt) continue;
      push(key, m.to);
    }
  }
  return d;
}
