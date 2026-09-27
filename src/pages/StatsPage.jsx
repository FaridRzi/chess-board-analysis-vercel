import { useMemo, useRef, useState } from 'react';
import { ENDINGS, PRESETS, byOpponentRating, endingOf, fetchPlayerGames, openingName, rangeFor, summarize } from '../lib/stats.js';
import { Pie, RatingBars, pct } from '../components/Charts.jsx';

const TIME_CLASSES = ['bullet', 'blitz', 'rapid', 'daily'];
const OUTCOMES = [
  { key: 'win', label: 'Won' },
  { key: 'draw', label: 'Drew' },
  { key: 'loss', label: 'Lost' },
];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const isoDay = (d) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
const fmtDate = (ms) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function remembered() {
  try {
    return localStorage.getItem('stats.username') || '';
  } catch (e) {
    return '';
  }
}

function Tile({ label, value, white, black }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      <span className="tile-split">
        <span className="player" data-color="white">
          <span className="dot" /> White <b>{white}</b>
        </span>
        <span className="player" data-color="black">
          <span className="dot" /> Black <b>{black}</b>
        </span>
      </span>
    </div>
  );
}

const WORD = { win: 'Won', draw: 'Drew', loss: 'Lost' };
const RESULT_COLOR = { win: 'var(--win)', draw: 'var(--draw)', loss: 'var(--loss)' };
// Methods within a result share its hue, stepped toward the surface; each method keeps its step whatever the filter.
const SHADES = [100, 72, 52, 38, 28, 20, 14];
const shade = (outcome, i) =>
  i === 0 ? RESULT_COLOR[outcome] : `color-mix(in oklab, ${RESULT_COLOR[outcome]} ${SHADES[i]}%, var(--panel))`;
const COLOR_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'white', label: 'White' },
  { key: 'black', label: 'Black' },
];
const RANKS = [
  { key: 'games', label: 'Most played' },
  { key: 'win', label: 'Most won' },
  { key: 'draw', label: 'Most drawn' },
  { key: 'loss', label: 'Most lost' },
];

function Toggles({ label, options, value, onChange, multi }) {
  return (
    <div className="seg-control small" role="group" aria-label={label}>
      {options.map((o) => {
        const on = multi ? value.includes(o.key) : value === o.key;
        const next = multi ? (on ? value.filter((k) => k !== o.key) : [...value, o.key]) : o.key;
        return (
          <button key={o.key} type="button" aria-pressed={on} onClick={() => onChange(next)}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Legend() {
  return (
    <div className="legend" aria-hidden="true">
      {OUTCOMES.map((o) => (
        <span key={o.key}>
          <i className={'sw ' + o.key} /> {o.label}
        </span>
      ))}
    </div>
  );
}

function ResultPies({ s }) {
  const pie = (key, title, t) => (
    <div className="pie-card" key={key}>
      <h3>{title}</h3>
      <Pie
        label={`${title}: won, drew and lost`}
        center={pct(t.winRate)}
        sub="win rate"
        slices={OUTCOMES.map((o) => ({ key: o.key, label: o.label, value: t[o.key], color: RESULT_COLOR[o.key] }))}
      />
    </div>
  );
  return (
    <section className="card" aria-label="Results">
      <div className="card-head">
        <h2>Results</h2>
      </div>
      <div className="pies">
        {pie('all', 'All games', s.all)}
        {pie('white', 'As White', s.white)}
        {pie('black', 'As Black', s.black)}
      </div>
    </section>
  );
}

function RatingCard({ games }) {
  const [color, setColor] = useState('all');
  const buckets = useMemo(
    () => byOpponentRating(color === 'all' ? games : games.filter((g) => g.color === color)),
    [games, color]
  );
  return (
    <section className="card" aria-label="Results by opponent rating">
      <div className="card-head">
        <h2>Results by opponent rating</h2>
        <Toggles label="Color" options={COLOR_OPTIONS} value={color} onChange={setColor} />
      </div>
      <div className="chart-body">
        <Legend />
        {buckets.length ? <RatingBars buckets={buckets} /> : <p className="stats-note">No games with this color.</p>}
        <p className="axis-note">Opponent rating in steps of 100 · hover or tap a bar for counts</p>
      </div>
    </section>
  );
}

function EndingsCard({ games }) {
  const [colors, setColors] = useState(['white', 'black']);
  const [results, setResults] = useState(['win', 'loss']);
  const picked = games.filter((g) => colors.includes(g.color) && results.includes(g.outcome));
  const counts = {};
  for (const g of picked) {
    const k = endingOf(g);
    counts[k] = (counts[k] || 0) + 1;
  }
  const slices = ENDINGS.filter((e) => results.includes(e.outcome)).map((e) => ({
    key: e.outcome + ':' + e.code,
    label: `${WORD[e.outcome]} · ${e.label}`,
    value: counts[e.outcome + ':' + e.code] || 0,
    color: shade(e.outcome, e.shade),
  }));
  return (
    <section className="card" aria-label="How games ended">
      <div className="card-head">
        <h2>How games ended</h2>
        <div className="filters">
          <Toggles label="Color" multi options={COLOR_OPTIONS.slice(1)} value={colors} onChange={setColors} />
          <Toggles label="Result" multi options={OUTCOMES} value={results} onChange={setResults} />
        </div>
      </div>
      <div className="chart-body">
        {!colors.length || !results.length ? (
          <p className="stats-note">Pick at least one color and one result.</p>
        ) : picked.length === 0 ? (
          <p className="stats-note">No games match these filters.</p>
        ) : (
          <Pie label="How games ended" center={picked.length} sub={picked.length === 1 ? 'game' : 'games'} slices={slices} />
        )}
      </div>
    </section>
  );
}

function OpeningsCard({ games }) {
  const [color, setColor] = useState('all');
  const [rank, setRank] = useState('games');
  const rows = useMemo(() => {
    const byName = new Map();
    for (const g of games) {
      if (color !== 'all' && g.color !== color) continue;
      let row = byName.get(g.opening);
      if (!row) byName.set(g.opening, (row = { name: g.opening, games: 0, win: 0, draw: 0, loss: 0 }));
      row.games++;
      row[g.outcome]++;
    }
    return [...byName.values()]
      .filter((row) => row[rank] > 0)
      .sort((a, b) => b[rank] - a[rank] || b.games - a.games || a.name.localeCompare(b.name))
      .slice(0, 20);
  }, [games, color, rank]);
  const col = (key) => (key === rank ? 'num ranked' : 'num');

  return (
    <section className="card" aria-label="Openings">
      <div className="card-head">
        <h2>Top openings</h2>
        <div className="filters">
          <Toggles label="Color" options={COLOR_OPTIONS} value={color} onChange={setColor} />
          <Toggles label="Rank by" options={RANKS} value={rank} onChange={setRank} />
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="stats-note chart-body">No games match these filters.</p>
      ) : (
        <div className="table-wrap">
          <table className="openings">
            <thead>
              <tr>
                <th className="num rank">#</th>
                <th className="oname">Opening</th>
                <th className={col('games')}>Games</th>
                <th className={col('win')}>
                  <span className="long">Won</span>
                  <abbr className="short" title="Won">W</abbr>
                </th>
                <th className={col('draw')}>
                  <span className="long">Drew</span>
                  <abbr className="short" title="Drew">D</abbr>
                </th>
                <th className={col('loss')}>
                  <span className="long">Lost</span>
                  <abbr className="short" title="Lost">L</abbr>
                </th>
                <th className="num">Win %</th>
                <th className="barcol">
                  <span className="sr-only">Share won, drew, lost</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.name}>
                  <td className="num muted rank">{i + 1}</td>
                  <td className="oname">{row.name}</td>
                  <td className={col('games')}>{row.games}</td>
                  <td className={col('win')}>{row.win}</td>
                  <td className={col('draw')}>{row.draw}</td>
                  <td className={col('loss')}>{row.loss}</td>
                  <td className="num">{pct(row.win / row.games)}</td>
                  <td className="barcol" aria-hidden="true">
                    <div className="minibar">
                      {OUTCOMES.map((o) => (row[o.key] ? <i key={o.key} className={'seg ' + o.key} style={{ flexGrow: row[o.key] }} /> : null))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function StatsPage({ active }) {
  const today = isoDay(new Date());
  const [username, setUsername] = useState(remembered);
  const [preset, setPreset] = useState('1m');
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState({ state: 'idle' });
  const [timeClass, setTimeClass] = useState('all');
  const abort = useRef(null);

  const customBad = preset === 'custom' && (!from || !to || from > to);

  async function run(e) {
    e.preventDefault();
    const user = username.trim();
    if (!user || customBad) return;
    try {
      localStorage.setItem('stats.username', user);
    } catch (err) {
      /* storage blocked */
    }
    abort.current && abort.current.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    const [fromMs, toMs] = rangeFor(preset, from, to);
    setStatus({ state: 'loading', done: 0, total: 0 });
    try {
      const games = await fetchPlayerGames(user, fromMs, toMs, {
        signal: ctrl.signal,
        onProgress: (done, total) => setStatus({ state: 'loading', done, total }),
      });
      setTimeClass('all');
      setStatus({ state: 'done', user: games.length ? games[games.length - 1].username : user, games, fromMs, toMs });
    } catch (err) {
      if (err.name === 'AbortError') return;
      const msg = err instanceof TypeError ? 'Chess.com couldn’t be reached. Check your connection and try again.' : err.message;
      setStatus({ state: 'error', message: msg });
    }
  }

  const games = status.state === 'done' ? status.games : null;
  const counts = useMemo(() => {
    const c = {};
    for (const g of games || []) c[g.timeClass] = (c[g.timeClass] || 0) + 1;
    return c;
  }, [games]);
  const shown = useMemo(
    () => (games ? (timeClass === 'all' ? games : games.filter((g) => g.timeClass === timeClass)) : null),
    [games, timeClass]
  );
  const s = useMemo(() => shown && summarize(shown), [shown]);

  return (
    <div className="page stats" hidden={!active}>
      <form className="card stats-form" onSubmit={run}>
        <label className="field">
          <span>Chess.com username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. hikaru"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </label>
        <fieldset className="field">
          <legend>Date range</legend>
          <div className="seg-control">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => setPreset(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>
        {preset === 'custom' && (
          <div className="dates">
            <label className="field">
              <span>From</span>
              <input type="date" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="field">
              <span>To</span>
              <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
        )}
        <button className="btn-primary" type="submit" disabled={status.state === 'loading' || !username.trim() || customBad}>
          {status.state === 'loading' ? 'Loading…' : 'Show stats'}
        </button>
      </form>

      {status.state === 'loading' && (
        <p className="stats-note" role="status">
          {status.total ? `Reading month ${Math.min(status.done + 1, status.total)} of ${status.total} from Chess.com…` : 'Finding games…'}
        </p>
      )}
      {status.state === 'error' && (
        <div className="notice error" role="status">
          <strong>Couldn’t load stats.</strong> {status.message}
        </div>
      )}

      {games && (
        <>
          <div className="stats-head">
            <strong>{status.user}</strong>
            <span>
              Games finished {fmtDate(status.fromMs)} – {fmtDate(status.toMs)}
            </span>
          </div>

          {games.length === 0 ? (
            <p className="stats-note">No finished games in this range. Try a longer one.</p>
          ) : (
            <>
              <div className="seg-control chips" role="group" aria-label="Time control">
                <button type="button" aria-pressed={timeClass === 'all'} onClick={() => setTimeClass('all')}>
                  All <span>{games.length}</span>
                </button>
                {TIME_CLASSES.filter((tc) => counts[tc]).map((tc) => (
                  <button key={tc} type="button" aria-pressed={timeClass === tc} onClick={() => setTimeClass(tc)}>
                    {cap(tc)} <span>{counts[tc]}</span>
                  </button>
                ))}
              </div>

              <div className="tiles">
                <Tile label="Games played" value={s.all.games} white={s.white.games} black={s.black.games} />
                <Tile label="Wins" value={s.all.win} white={s.white.win} black={s.black.win} />
                <Tile label="Win rate" value={pct(s.all.winRate)} white={pct(s.white.winRate)} black={pct(s.black.winRate)} />
              </div>

              <ResultPies s={s} />
              <RatingCard games={shown} />
              <EndingsCard games={shown} />
              <OpeningsCard games={shown} />
              <p className="foot">Win rate is wins ÷ games; draws count as not won. Dates use your local time.</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
