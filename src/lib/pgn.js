// Game text reader.
// Accepts any PGN (Chess.com, Lichess, others) or just the moves:
//   1. e4 e5 2. Nf3 Nc6      e4 e5 Nf3 Nc6      1.e4 e5 2.Nf3 Nc6
// Headers, clocks, comments, !? marks, $ codes and side variations are
// ignored. German piece letters (K D T L S), lowercase letters, 0-0
// castling and coordinates (e2e4) also work.
import { Chess, validateFen } from 'chess.js';
import { START_FEN, moveNumberLabel, tryMove } from './chess.js';

const RESULTS = new Set(['1-0', '0-1', '1/2-1/2', '½-½', '*']);
const GERMAN = { S: 'N', L: 'B', T: 'R', D: 'Q' };

export function parseGameText(input) {
  let text = input.replace(/\r\n?/g, '\n').replace(/…/g, '...').replace(/[–—]/g, '-');

  const headers = {};
  text = text.replace(/^\s*\[([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\s*\]\s*$/gm, (_, k, v) => {
    if (!(k in headers)) headers[k] = v.replace(/\\(.)/g, '$1');
    return '';
  });

  text = text.replace(/\{[^}]*\}/g, ' ');
  text = text.replace(/;[^\n]*/g, ' ');
  text = text.replace(/^%[^\n]*/gm, ' ');
  text = text.replace(/\$\d+/g, ' ');
  let prev;
  do {
    prev = text;
    text = text.replace(/\([^()]*\)/g, ' ');
  } while (text !== prev);
  text = text.replace(/[()]/g, ' ');
  text = text.replace(/(\d+)\s*(\.{1,3})\s*/g, '$1$2 ');

  const variant = (headers.Variant || 'standard').toLowerCase();
  if (!/^(standard|from position|chess)$/.test(variant)) {
    return { error: `This game is ${headers.Variant}. Only standard chess is supported.` };
  }

  let startFen = START_FEN;
  if (headers.FEN) {
    const v = validateFen(headers.FEN.trim());
    if (!v.ok) return { error: `The FEN header isn’t valid: ${v.error}` };
    startFen = new Chess(headers.FEN.trim()).fen();
  }

  const c = new Chess(startFen);
  const moves = [];
  let result = null;
  let stoppedAt = null;

  for (const raw of text.split(/\s+/).filter(Boolean)) {
    if (RESULTS.has(raw)) {
      result = raw === '½-½' ? '1/2-1/2' : raw;
      break;
    }
    if (/^\d+\.*$/.test(raw) || /^\.+$/.test(raw) || /^e\.?p\.?$/i.test(raw)) continue;
    const tok = raw.replace(/^\d+\.+/, '');
    if (!tok) continue;
    const r = readMove(c, tok);
    if (!r) {
      const { n, black } = moveNumberLabel(c.fen());
      stoppedAt = { label: `${n}${black ? '…' : '.'} ${tok}`, loaded: moves.length };
      break;
    }
    moves.push(r);
  }
  if (!result && headers.Result && RESULTS.has(headers.Result)) result = headers.Result;
  return { headers, startFen, moves, result, stoppedAt };
}

export function readMove(c, tok) {
  let t = tok.replace(/[!?]+$/, '').replace(/[+#]/g, '');
  t = t.replace(/^0-0-0$/i, 'O-O-O').replace(/^0-0$/i, 'O-O').replace(/^o-o-o$/, 'O-O-O').replace(/^o-o$/, 'O-O');
  t = t.replace(/e\.?p\.?$/i, '');
  if (!t) return null;
  const tries = [];
  const add = (s) => {
    if (s && !tries.includes(s)) tries.push(s);
  };
  const withPromo = (s) =>
    s
      .replace(/([a-h][18])=?([QRBNqrbn])$/, (_, sq, p) => `${sq}=${p.toUpperCase()}`)
      .replace(/([a-h][18])=?([DTLS])$/, (_, sq, p) => `${sq}=${GERMAN[p]}`);
  add(t);
  add(withPromo(t));
  if (GERMAN[t[0]]) add(withPromo(GERMAN[t[0]] + t.slice(1)));
  if (/^[nrqk]/.test(t)) add(withPromo(t[0].toUpperCase() + t.slice(1)));
  if (/^b/.test(t)) add(withPromo('B' + t.slice(1))); // "bc4" as a bishop, after trying the b-pawn
  for (const s of tries.slice()) add(s.replace(/x/g, ''));
  for (const s of tries.slice()) add(s.replace(/-/g, ''));
  for (const s of tries) {
    const r = tryMove(c, s);
    if (r) return r;
  }
  const coord = t.toLowerCase().replace(/[-x:]/g, '').match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/);
  if (coord) {
    const r = tryMove(c, { from: coord[1], to: coord[2], promotion: coord[3] || 'q' });
    if (r) return r;
  }
  return null;
}

export function looksLikeFen(raw) {
  return !raw.includes('\n') && raw.split(/\s+/).length >= 2 && raw.includes('/');
}

export function labelFor(h) {
  if (/chess\.com/i.test(h.Site || '') || /chess\.com/i.test(h.Link || '')) return 'Chess.com game';
  if (/lichess/i.test(h.Site || '')) return 'Lichess game';
  if (h.Event && h.Event !== '?' && !/casual|rated|live chess|let's play/i.test(h.Event)) return h.Event;
  return 'Your game';
}
