// Game review: a second Stockfish worker walks the game's main line and each move is judged by how
// much it changed the mover's chance of winning (Lichess's win% curve, 0–100).
import { ENGINE_URL, parseInfo } from './engine.js';
import { chessAt, tryMove } from './chess.js';

const DEPTH = 14;
const MOVETIME = 2500; // ms cap per position, whichever comes first

// A move that costs this many win% points and leaves the mover no longer clearly winning.
const BLUNDER_LOSS = 20;
const STILL_WINNING = 80;
// The only move: every alternative costs at least this much.
const ONLY_MOVE_GAP = 20;
// A sound sacrifice: gives up a piece (not just pawns) for a net loss of at least this much material,
// while staying this close to the best move.
const SAC_MATERIAL = 1;
const SAC_MAX_LOSS = 5;
const SAC_MIN_AFTER = 35;

export const KINDS = {
  blunder: { glyph: '??', label: 'Blunder', plural: 'Blunders' },
  only: { glyph: '!', label: 'Only move', plural: 'Only moves' },
  sacrifice: { glyph: '!!', label: 'Sacrifice', plural: 'Sacrifices' },
};

/** Stockfish in its own worker, answering one position at a time with its top two lines. */
export class Reviewer {
  constructor() {
    this.pending = null;
    this.lines = [];
    this.worker = new Worker(ENGINE_URL);
    this.ready = new Promise((resolve, reject) => {
      this.onReady = resolve;
      this.worker.onerror = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const err = new Error('The review engine stopped working.');
        reject(err);
        if (this.pending) this.pending.reject(err);
      };
    });
    this.worker.onmessage = (e) => this.handle(String(e.data));
    this.worker.postMessage('uci');
  }
  handle(line) {
    if (line === 'uciok') {
      this.worker.postMessage('setoption name MultiPV value 2');
      this.worker.postMessage('setoption name Hash value 16');
      this.worker.postMessage('isready');
    } else if (line === 'readyok') {
      this.onReady();
    } else if (line.startsWith('info') && line.includes(' pv ')) {
      const info = parseInfo(line);
      if (info) this.lines[info.multipv - 1] = { kind: info.kind, value: info.value, pv: info.pv, depth: info.depth };
    } else if (line.startsWith('bestmove') && this.pending) {
      const p = this.pending;
      this.pending = null;
      p.resolve(this.lines.filter(Boolean));
    }
  }
  /** Lines for the side to move: [{ kind: 'cp'|'mate', value, pv }] (best first). */
  analyze(fen) {
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      this.lines = [];
      this.worker.postMessage('position fen ' + fen);
      this.worker.postMessage(`go depth ${DEPTH} movetime ${MOVETIME}`);
    });
  }
  terminate() {
    this.worker.terminate();
  }
}

/** Side to move's winning chance, 0–100, from an engine score. */
export function winPct(score) {
  if (score.kind === 'mate') return score.value > 0 ? 100 : 0;
  const cp = Math.max(-1500, Math.min(1500, score.value));
  return 100 / (1 + Math.exp(-0.00368208 * cp));
}

/** Win% for the side to move in a finished position (mated = 0, drawn = 50), or null if play goes on. */
function terminalWin(fen) {
  const c = chessAt(fen);
  if (c.isCheckmate()) return 0;
  if (c.isGameOver()) return 50;
  return null;
}

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
/** Material of `color` minus the opponent's, in pawns. */
function balance(c, color) {
  let sum = 0;
  for (const row of c.board()) for (const sq of row) if (sq) sum += (sq.color === color ? 1 : -1) * VALUE[sq.type];
  return sum;
}

/**
 * What `color` really gave up after a move: follow the exchange it started, i.e. the captures that come
 * straight after it (the game's own moves, then the engine's), stopping at the first quiet move (max eight).
 * Returns { balance, lostPiece } — lostPiece when a knight or bigger of `color` was taken.
 */
function settle(fen, ucis, color) {
  const c = chessAt(fen);
  let bal = balance(c, color);
  let lostPiece = false;
  for (let i = 0; i < Math.min(ucis.length, 8); i++) {
    const u = ucis[i];
    const r = tryMove(c, { from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    if (!r || !r.captured) break;
    if (r.color !== color && r.captured !== 'p') lostPiece = true;
    bal = balance(c, color);
  }
  return { balance: bal, lostPiece };
}

// Lichess's per-move accuracy from the win% a move gave away.
const moveAccuracy = (loss) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));

/**
 * Judges every move whose before and after positions have been analyzed.
 * nodes: main line [root, move1, move2, …]; evals[i]: engine lines at nodes[i] (null when the game is over there).
 * Returns { marks: Map(nodeId → kind), moves: Map(nodeId → { loss, accuracy, kind }), summary: { white, black } }.
 */
export function classify(nodes, evals, complete = true) {
  // Positions analyzed so far (a prefix of the game).
  let m = 0;
  while (m < nodes.length && evals[m] !== undefined) m++;
  const lineWins = (i) => (evals[i] || []).map((l) => ({ uci: l.pv[0], win: winPct(l) }));

  // Win% for the side to move at each position, refined from the end backward: the value of the move
  // actually played comes from the (later, deeper-seeing) analysis of the position it led to.
  const W = new Array(m);
  const R = new Array(m); // the options at each position, refined the same way
  for (let i = m - 1; i >= 0; i--) {
    const t = terminalWin(nodes[i].fen);
    if (t != null) {
      W[i] = t;
      R[i] = [];
      continue;
    }
    const opts = lineWins(i);
    if (i + 1 < m) {
      const played = 100 - W[i + 1];
      const hit = opts.find((o) => o.uci === nodes[i + 1].uci);
      if (hit) hit.win = played;
      else opts.push({ uci: nodes[i + 1].uci, win: played });
    }
    R[i] = opts.sort((a, b) => b.win - a.win);
    W[i] = opts.length ? opts[0].win : 50;
  }

  const marks = new Map();
  const moves = new Map();
  const acc = { w: [], b: [] };
  const counts = { w: { blunder: 0, only: 0, sacrifice: 0 }, b: { blunder: 0, only: 0, sacrifice: 0 } };
  // Judge a move only once the position after it has been looked past too (unless the review is complete).
  const last = complete ? m - 1 : m - 2;

  for (let k = 1; k <= last; k++) {
    const prev = nodes[k - 1];
    const node = nodes[k];
    const mover = prev.fen.split(' ')[1];
    const beforeWin = W[k - 1];
    const after = 100 - W[k];
    const loss = Math.max(0, beforeWin - after);

    let kind = null;
    // Sound sacrifice: a piece given up for good (as the game went on), yet about as good as the best move.
    if (loss <= SAC_MAX_LOSS && after >= SAC_MIN_AFTER) {
      const game = nodes.slice(k + 1, k + 9).map((n) => n.uci);
      const end = k + game.length;
      const tail = end < m && evals[end] && evals[end][0] ? evals[end][0].pv : [];
      const { balance: settled, lostPiece } = settle(node.fen, [...game, ...tail], mover);
      if (lostPiece && balance(chessAt(prev.fen), mover) - settled >= SAC_MATERIAL) kind = 'sacrifice';
    }
    // Only move: the best move, and every other move is much worse. Plain recaptures don't count.
    const opts = R[k - 1];
    if (!kind && opts.length >= 2 && node.uci === opts[0].uci) {
      const gap = opts[0].win - opts[1].win;
      const recapture = prev.lastMove && prev.lastMove[1] === node.lastMove[1] && /x/.test(prev.san || '') && /x/.test(node.san || '');
      if (gap >= ONLY_MOVE_GAP && !recapture) kind = 'only';
    }
    // Blunder: throws away the advantage, or hands it to the opponent.
    if (!kind && loss >= BLUNDER_LOSS && after < STILL_WINNING) kind = 'blunder';

    const accuracy = moveAccuracy(loss);
    acc[mover].push(accuracy);
    moves.set(node.id, { loss, accuracy, kind });
    if (kind) {
      marks.set(node.id, kind);
      counts[mover][kind]++;
    }
  }

  // Lichess-style game accuracy: the mean of the arithmetic and harmonic means, so one big error weighs in.
  const gameAccuracy = (xs) => {
    if (!xs.length) return null;
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const harmonic = xs.length / xs.reduce((s, x) => s + 1 / Math.max(x, 1), 0);
    return (mean + harmonic) / 2;
  };
  return {
    marks,
    moves,
    summary: {
      white: { accuracy: gameAccuracy(acc.w), moves: acc.w.length, ...counts.w },
      black: { accuracy: gameAccuracy(acc.b), moves: acc.b.length, ...counts.b },
    },
  };
}

/** The game's own moves: root, then each main-line child. */
export function mainLine(tree) {
  const nodes = [tree.root];
  let n = tree.root;
  while ((n = n.children.find((c) => c.main))) nodes.push(n);
  return nodes;
}
