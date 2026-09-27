import { useMemo, useRef, useState } from 'react';
import { PRESETS, fetchPlayerGames, rangeFor, summarize } from '../lib/stats.js';

const TIME_CLASSES = ['bullet', 'blitz', 'rapid', 'daily'];
const OUTCOMES = [
  { key: 'win', label: 'Won' },
  { key: 'draw', label: 'Drew' },
  { key: 'loss', label: 'Lost' },
];

const pct = (x) => (x == null ? '–' : Math.round(x * 100) + '%');
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

/** One horizontal win/draw/loss bar, segments sized by share of games. */
function OutcomeBar({ label, color, t }) {
  const [tip, setTip] = useState(null);
  return (
    <div className="wdl-row">
      <div className="wdl-name">
        {color ? (
          <span className="player" data-color={color}>
            <span className="dot" /> {label}
          </span>
        ) : (
          label
        )}
      </div>
      <div className="wdl-bar" onMouseLeave={() => setTip(null)}>
        {t.games === 0 ? (
          <span className="wdl-empty">No games</span>
        ) : (
          OUTCOMES.map(({ key, label: word }) => {
            const n = t[key];
            if (!n) return null;
            const share = n / t.games;
            const text = `${word} ${n} of ${t.games} (${pct(share)})`;
            return (
              <div
                key={key}
                className={'seg ' + key}
                style={{ flexGrow: n }}
                tabIndex={0}
                aria-label={`${label}: ${text}`}
                onMouseEnter={() => setTip({ key, text })}
                onFocus={() => setTip({ key, text })}
                onBlur={() => setTip(null)}
              >
                {share >= 0.1 && <span>{n}</span>}
              </div>
            );
          })
        )}
        {tip && (
          <div className="wdl-tip" role="tooltip">
            {tip.text}
          </div>
        )}
      </div>
      <div className="wdl-nums">
        <span>{t.win}</span>
        <span>{t.draw}</span>
        <span>{t.loss}</span>
        <strong>{pct(t.winRate)}</strong>
      </div>
    </div>
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

              <section className="card wdl" aria-label="Results by color">
                <div className="card-head">
                  <h2>Results by color</h2>
                  <div className="legend" aria-hidden="true">
                    {OUTCOMES.map((o) => (
                      <span key={o.key}>
                        <i className={'sw ' + o.key} /> {o.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="wdl-body">
                  <div className="wdl-row wdl-cols" aria-hidden="true">
                    <div />
                    <div />
                    <div className="wdl-nums">
                      <span>W</span>
                      <span>D</span>
                      <span>L</span>
                      <span>Win %</span>
                    </div>
                  </div>
                  <OutcomeBar label="All" t={s.all} />
                  <OutcomeBar label="White" color="white" t={s.white} />
                  <OutcomeBar label="Black" color="black" t={s.black} />
                </div>
              </section>
              <p className="foot">Win rate is wins ÷ games; draws count as not won. Dates use your local time.</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
