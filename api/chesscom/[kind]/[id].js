// Vercel serverless function: GET /api/chesscom/:kind/:id
// Fetches a Chess.com game (daily or live) and returns only what the page needs.

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  const m = (req.url || '').match(/\/api\/chesscom\/(daily|live)\/(\d{1,15})(?:[/?#]|$)/);
  const kind = m ? m[1] : req.query && req.query.kind;
  const id = m ? m[2] : req.query && req.query.id;
  if (!/^(daily|live)$/.test(kind || '') || !/^\d{1,15}$/.test(id || '')) {
    return send(res, 400, { error: 'Use /api/chesscom/daily/<id> or /api/chesscom/live/<id>.' });
  }

  let upstream;
  try {
    upstream = await fetch(`https://www.chess.com/callback/${kind}/game/${id}`, { headers: BROWSER_HEADERS });
  } catch (e) {
    return send(res, 502, { error: 'Chess.com could not be reached.' });
  }
  if (upstream.status === 404) return send(res, 404, { error: 'No game with that ID.' });
  if (!upstream.ok) return send(res, 502, { error: `Chess.com answered ${upstream.status}.` });

  let data;
  try {
    data = await upstream.json();
  } catch (e) {
    return send(res, 502, { error: 'Chess.com sent something that is not game data.' });
  }
  const g = data.game || data;
  if (!g || typeof g.moveList !== 'string') return send(res, 502, { error: 'The game has no move list.' });

  return send(res, 200, {
    game: {
      id: g.id,
      moveList: g.moveList,
      isFinished: g.isFinished,
      pgnHeaders: g.pgnHeaders || {},
    },
  });
}
