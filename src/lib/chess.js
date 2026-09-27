import { Chess } from 'chess.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function chessAt(fen) {
  return new Chess(fen);
}
export function turnOf(fen) {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}
export function moveNumberLabel(fen) {
  const parts = fen.split(' ');
  return { n: parseInt(parts[5], 10) || 1, black: parts[1] === 'b' };
}
export function tryMove(c, m) {
  try {
    return c.move(m) || null;
  } catch (e) {
    return null;
  }
}

/** Converts engine UCI moves to numbered SAN, e.g. [{num:'10.', san:'Nxb5'}, …] */
export function pvToSan(fen, pv, max, forceFirstNumber = true) {
  const c = chessAt(fen);
  const out = [];
  let { n, black } = moveNumberLabel(fen);
  for (let i = 0; i < pv.length && i < max; i++) {
    const u = pv[i];
    const r = tryMove(c, { from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    if (!r) break;
    let num = '';
    if (!black) num = n + '.';
    else if (i === 0 && forceFirstNumber) num = n + '…';
    out.push({ num, san: r.san });
    if (black) n++;
    black = !black;
  }
  return out;
}

export function fmtEval(line) {
  if (!line) return '';
  if (line.kind === 'mate') {
    if (line.value === 0) return '#';
    return (line.value > 0 ? '+M' : '−M') + Math.abs(line.value);
  }
  const v = line.value / 100;
  const s = Math.abs(v).toFixed(2);
  if (v > 0.004) return '+' + s;
  if (v < -0.004) return '−' + s;
  return '0.00';
}

/** White's share of the eval bar, 0..1 */
export function winShare(line) {
  if (!line) return 0.5;
  if (line.kind === 'mate') return line.value > 0 ? 1 : line.value < 0 ? 0 : 0.5;
  const cp = Math.max(-1500, Math.min(1500, line.value));
  return 1 / (1 + Math.exp(-0.00368208 * cp));
}

export function formatTimeControl(tc) {
  const m = String(tc).match(/^1\/(\d+)$/);
  if (m) {
    const days = Math.round(+m[1] / 86400);
    return `Daily · ${days} day${days === 1 ? '' : 's'}/move`;
  }
  const t = String(tc).match(/^(\d+)(?:\+(\d+))?$/);
  if (t) {
    const base = +t[1];
    const baseLabel = base % 60 === 0 ? `${base / 60} min` : `${base} s`;
    return t[2] && +t[2] > 0 ? `${baseLabel} + ${t[2]} s` : baseLabel;
  }
  return tc;
}
