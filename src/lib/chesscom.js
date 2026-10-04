import { START_FEN } from './chess.js';

// Chess.com stores move lists in its compact "TCN" encoding.
const TCN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?{~}(^)[_]@#$,./&-*++=';

export function decodeTcn(str) {
  const moves = [];
  for (let i = 0; i + 1 < str.length; i += 2) {
    const m = {};
    const w = TCN.indexOf(str[i]);
    let c = TCN.indexOf(str[i + 1]);
    if (c > 63) {
      m.promotion = 'qnrbkp'[Math.floor((c - 64) / 3)];
      c = w + (w < 16 ? -8 : 8) + ((c - 1) % 3) - 1;
    }
    m.from = TCN[w % 8] + (Math.floor(w / 8) + 1);
    m.to = TCN[c % 8] + (Math.floor(c / 8) + 1);
    moves.push(m);
  }
  return moves;
}

/**
 * A Chess.com game link, bare or inside a share message from the app
 * ("Check out this #chess game: A vs B - https://www.chess.com/game/live/123", in any language).
 * PGNs also carry the link in [Link "…"] / [Site "…"] headers, so text with PGN headers is never a link.
 */
export function parseChessComLink(text) {
  if (/^\s*\[\w+\s+"/m.test(text)) return null;
  const m = text.match(/chess\.com\/(?:analysis\/)?game\/(daily|live)?\/?(\d+)/i);
  if (!m) return null;
  return { kind: (m[1] || 'live').toLowerCase(), id: m[2] };
}

export async function fetchChessComGame(kind, id) {
  const res = await fetch(`/api/chesscom/${kind}/${id}`, { cache: 'no-store' });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* not JSON */
  }
  if (!res.ok) throw new Error((data && data.error) || `The server answered ${res.status}.`);
  const g = data.game || data;
  if (!g || typeof g.moveList !== 'string') throw new Error('The game has no move list.');
  const h = g.pgnHeaders || {};
  const result = g.isFinished === false ? '*' : h.Result || '*';
  return { headers: { ...h, Result: result }, startFen: h.FEN || START_FEN, moves: decodeTcn(g.moveList) };
}
