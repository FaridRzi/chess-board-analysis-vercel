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

// Standard games are typed by time control; variants (Chess960 etc.) are their own type.
export const BASE_TYPES = ['bullet', 'blitz', 'rapid', 'daily'];
const TYPE_LABELS = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
  daily: 'Daily',
  chess960: 'Chess960',
  kingofthehill: 'King of the Hill',
  threecheck: '3 Check',
  crazyhouse: 'Crazyhouse',
  bughouse: 'Bughouse',
  oddschess: 'Odds chess',
};
export const typeLabel = (t) => TYPE_LABELS[t] || t.charAt(0).toUpperCase() + t.slice(1);

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
    gameType: g.rules && g.rules !== 'chess' ? g.rules : g.time_class,
    timeControl: g.time_control,
    rules: g.rules,
    rated: g.rated,
    accuracy: g.accuracies ? g.accuracies[color] : null,
    eco: g.eco || null,
    opening: openingName(g.eco),
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

// ---------- how games ended ----------

// Won games are described by the opponent's code, lost and drawn games by the player's own.
const METHODS = {
  win: [
    ['resigned', 'Resignation'],
    ['checkmated', 'Checkmate'],
    ['timeout', 'Timeout'],
    ['abandoned', 'Abandoned'],
  ],
  loss: [
    ['resigned', 'Resignation'],
    ['checkmated', 'Checkmate'],
    ['timeout', 'Timeout'],
    ['abandoned', 'Abandoned'],
  ],
  draw: [
    ['agreed', 'Agreement'],
    ['repetition', 'Repetition'],
    ['stalemate', 'Stalemate'],
    ['insufficient', 'Insufficient material'],
    ['timevsinsufficient', 'Timeout vs insufficient material'],
    ['50move', '50-move rule'],
  ],
};

/** Every possible (outcome, method) slice, in display order. */
export const ENDINGS = ['win', 'draw', 'loss'].flatMap((outcome) =>
  [...METHODS[outcome], ['other', 'Other']].map(([code, label], i) => ({ outcome, code, label, shade: i }))
);

export function endingOf(g) {
  const code = g.outcome === 'win' ? g.oppResult : g.result;
  const known = METHODS[g.outcome].some(([c]) => c === code);
  return g.outcome + ':' + (known ? code : 'other');
}

// ---------- openings ----------

const FAMILY_END = /^(Opening|Defense|Game|Gambit|Attack|System|Countergambit)$/;
const VARIATION_END = /^(Variation|Line|Attack|Defense|System|Gambit|Countergambit|Formation|Opening|Game)$/;
const TIDY = [
  [/\bBishops\b/g, 'Bishop’s'],
  [/\bKings\b/g, 'King’s'],
  [/\bQueens\b/g, 'Queen’s'],
  [/\b(Alekhine|Owen|Bird|Petrov|Anderssen|Ware|Amar|Clemenz|Mieses|Barnes|Durkin|Sokolsky)s\b/g, '$1’s'],
  [/\bCaro Kann\b/g, 'Caro-Kann'],
  [/\bNimzo (Indian|Larsen)\b/g, 'Nimzo-$1'],
  [/\bNimzowitsch Larsen\b/g, 'Nimzowitsch-Larsen'],
  [/\bReti\b/g, 'Réti'],
  [/\bAnglo Indian\b/g, 'Anglo-Indian'],
  [/\bGruenfeld\b/g, 'Grünfeld'],
];
const tidy = (words) => TIDY.reduce((s, [re, to]) => s.replace(re, to), words.join(' '));

/**
 * "Opening: Main variation" from Chess.com's opening URL, e.g.
 * .../openings/Queens-Gambit-Declined-Exchange-Positional-Line-5...c6 → "Queen’s Gambit Declined: Exchange Positional Line".
 */
export function openingName(ecoUrl) {
  let slug = decodeURIComponent((ecoUrl || '').split('/openings/')[1] || '');
  slug = slug.replace(/with-1-([a-h][1-8])/, 'with 1.$1').split(/-\d+\.|\.\.\./)[0];
  const words = slug.split('-').filter(Boolean);
  if (!words.length || words[0] === 'Undefined') return 'Unknown opening';
  let i = words.findIndex((w) => FAMILY_END.test(w));
  if (i < 0) i = words.length - 1;
  if (/^(Declined|Accepted|Refused)$/.test(words[i + 1] || '')) i++;
  const family = tidy(words.slice(0, i + 1));
  const rest = words.slice(i + 1);
  if (!rest.length) return family;
  if (/^with /.test(rest[0])) return family + ' ' + rest.join(' ');
  const j = rest.findIndex((w) => VARIATION_END.test(w));
  return family + ': ' + tidy(j < 0 ? rest : rest.slice(0, j + 1));
}

// ---------- rating buckets ----------

/** Games grouped by opponent rating in 100-point steps, lowest first, with empty steps kept. */
export function byOpponentRating(games) {
  const rated = games.filter((g) => Number.isFinite(g.oppRating));
  if (!rated.length) return [];
  const lo = Math.floor(Math.min(...rated.map((g) => g.oppRating)) / 100) * 100;
  const hi = Math.floor(Math.max(...rated.map((g) => g.oppRating)) / 100) * 100;
  const buckets = [];
  for (let r = lo; r <= hi; r += 100) buckets.push({ from: r, to: r + 99, games: 0, win: 0, draw: 0, loss: 0 });
  for (const g of rated) {
    const b = buckets[Math.floor(g.oppRating / 100) - lo / 100];
    b.games++;
    b[g.outcome]++;
  }
  return buckets;
}

// ---------- per day ----------

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** One entry per local calendar day from fromMs to toMs (empty days included), oldest first. */
export function byDay(games, fromMs, toMs) {
  const days = [];
  const index = new Map();
  const d = new Date(fromMs);
  d.setHours(0, 0, 0, 0);
  for (; d.getTime() <= toMs; d.setDate(d.getDate() + 1)) {
    index.set(dayKey(d), days.length);
    days.push({ key: dayKey(d), day: d.getTime(), games: 0, win: 0, draw: 0, loss: 0 });
  }
  for (const g of games) {
    const i = index.get(dayKey(new Date(g.end)));
    if (i == null) continue;
    days[i].games++;
    days[i][g.outcome]++;
  }
  return days;
}
