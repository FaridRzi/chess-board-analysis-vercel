// Reads a player's finished games from Chess.com's public API (api.chess.com/pub, CORS-open)
// and summarizes them. Games live in monthly archives, sorted by end_time (unix seconds).

const API = 'https://api.chess.com/pub/player/';
const DAY = 86400000;

// Per-side result codes: https://www.chess.com/news/view/published-data-api#pubapi-general-codes
const DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);

/** 'win' | 'draw' | 'loss' for one side's result code. */
export function outcomeOf(code) {
  if (code === 'win') return 'win';
  return DRAWS.has(code) ? 'draw' : 'loss';
}

export const PRESETS = [
  { id: '1d', label: '1 Day', ms: DAY },
  { id: '1w', label: '1 Week', ms: 7 * DAY },
  { id: '1m', label: '1 Month', ms: 30 * DAY },
  { id: '1y', label: '1 Year', ms: 365 * DAY },
  { id: 'custom', label: 'Custom' },
];

/** [fromMs, toMs] for a preset, or for a custom pair of YYYY-MM-DD dates (local days, inclusive). */
export function rangeFor(preset, customFrom, customTo, now = Date.now()) {
  if (preset !== 'custom') return [now - PRESETS.find((p) => p.id === preset).ms, now];
  const from = new Date(customFrom + 'T00:00:00').getTime();
  const to = new Date(customTo + 'T23:59:59.999').getTime();
  return [from, to];
}

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  if (res.status === 404) return null;
  if (res.status === 429) throw new Error('Chess.com is rate-limiting requests. Wait a minute and try again.');
  if (!res.ok) throw new Error(`Chess.com answered ${res.status}.`);
  return res.json();
}

// Finished months never change, so keep them for the session.
const archiveCache = new Map();

/**
 * All games `username` finished between fromMs and toMs, oldest first.
 * onProgress(done, total) reports archive months read.
 */
export async function fetchPlayerGames(username, fromMs, toMs, { signal, onProgress } = {}) {
  const user = username.trim().toLowerCase();
  const index = await getJson(API + encodeURIComponent(user) + '/games/archives', signal);
  if (!index) throw new Error(`There’s no Chess.com player named “${username.trim()}”.`);

  // Archive months are UTC; pad a day on each side so boundary games aren't missed.
  const monthKey = (ms) => {
    const d = new Date(ms);
    return d.getUTCFullYear() * 100 + d.getUTCMonth() + 1;
  };
  const lo = monthKey(fromMs - DAY);
  const hi = monthKey(toMs + DAY);
  const urls = (index.archives || []).filter((u) => {
    const m = u.match(/\/(\d{4})\/(\d{2})$/);
    const k = m && +m[1] * 100 + +m[2];
    return k && k >= lo && k <= hi;
  });

  const current = monthKey(Date.now());
  const games = [];
  for (let i = 0; i < urls.length; i++) {
    onProgress && onProgress(i, urls.length);
    const url = urls[i];
    let list = archiveCache.get(url);
    if (!list) {
      // Sequential on purpose: Chess.com rate-limits parallel requests.
      const data = await getJson(url, signal);
      list = (data && data.games) || [];
      const m = url.match(/\/(\d{4})\/(\d{2})$/);
      if (+m[1] * 100 + +m[2] < current) archiveCache.set(url, list);
    }
    for (const g of list) {
      const t = g.end_time * 1000;
      if (t < fromMs || t > toMs) continue;
      const side = sideOf(g, user);
      if (side) games.push(toRecord(g, side));
    }
  }
  onProgress && onProgress(urls.length, urls.length);
  return games.sort((a, b) => a.end - b.end);
}

function sideOf(g, user) {
  for (const side of ['white', 'black']) {
    const p = g[side] || {};
    if ((p.username || '').toLowerCase() === user) return side;
    if ((p['@id'] || '').toLowerCase().endsWith('/player/' + user)) return side;
  }
  return null;
}

function toRecord(g, color) {
  const me = g[color];
  const opp = g[color === 'white' ? 'black' : 'white'];
  return {
    url: g.url,
    end: g.end_time * 1000,
    username: me.username,
    color,
    outcome: outcomeOf(me.result),
    result: me.result,
    oppResult: opp.result,
    rating: me.rating,
    opponent: opp.username,
    oppRating: opp.rating,
    timeClass: g.time_class,
    timeControl: g.time_control,
    rules: g.rules,
    rated: g.rated,
    accuracy: g.accuracies ? g.accuracies[color] : null,
    eco: g.eco || null,
  };
}

function tally(games) {
  const t = { games: games.length, win: 0, draw: 0, loss: 0 };
  for (const g of games) t[g.outcome]++;
  t.winRate = t.games ? t.win / t.games : null;
  return t;
}

/** Totals overall and per color. Win rate = wins / games (draws don't count as half). */
export function summarize(games) {
  return {
    all: tally(games),
    white: tally(games.filter((g) => g.color === 'white')),
    black: tally(games.filter((g) => g.color === 'black')),
  };
}
