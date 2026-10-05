import { useCallback, useEffect, useMemo, useState } from 'react';
import Board from '../components/Board.jsx';
import { GameTree } from '../lib/tree.js';
import { START_FEN, chessAt, tryMove } from '../lib/chess.js';
import { bookAt, loadBook, numbered, searchOpenings } from '../lib/openings.js';

/** Moves from the start to `node`, as SAN. */
function pathOf(node) {
  const nodes = [];
  for (let n = node; n.parent; n = n.parent) nodes.unshift(n);
  return nodes;
}

export default function OpeningsPage({ active, onAnalyze, line }) {
  const [book, setBook] = useState(null);
  const [failed, setFailed] = useState(false);
  const [tree] = useState(() => new GameTree(START_FEN, []));
  const [cur, setCur] = useState(tree.root);
  const [version, setVersion] = useState(0);
  const [orientation, setOrientation] = useState('white');
  const [query, setQuery] = useState('');

  // The book is only fetched once someone opens this page.
  useEffect(() => {
    if (!active || book) return;
    loadBook().then(setBook, () => setFailed(true));
  }, [active, book]);

  const goTo = useCallback((node) => {
    if (!node) return;
    setCur(node);
    setVersion((v) => v + 1);
  }, []);

  const path = useMemo(() => pathOf(cur), [cur]);
  const sans = useMemo(() => path.map((n) => n.san), [path]);
  // Matched by position, so a known position is recognized whatever move order reached it.
  const here = useMemo(() => (book ? bookAt(book, cur.fen) : { inBook: false, opening: null, lines: 0, moves: [] }), [book, cur]);
  const named = useMemo(() => {
    let last = null;
    if (book) for (const n of path) last = bookAt(book, n.fen).opening || last;
    return last;
  }, [book, path]);
  const next = here.moves;
  const results = useMemo(() => (book ? searchOpenings(book.all, query) : []), [book, query]);

  // Arrows for the three continuations with the most named lines.
  const arrows = useMemo(
    () =>
      next.slice(0, 3).flatMap((n) => {
        const r = tryMove(chessAt(cur.fen), n.san);
        return r ? [r.from + r.to] : [];
      }),
    [next, cur]
  );

  const play = (san) => goTo(tree.playSan(cur, san));
  const playLine = useCallback(
    (line) => {
      let node = tree.root;
      for (const san of line) node = node && tree.playSan(node, san);
      goTo(node);
    },
    [tree, goTo]
  );
  const jumpTo = (opening) => {
    playLine(opening.sans);
    setQuery('');
  };

  // A position sent over from Game analysis.
  useEffect(() => {
    if (line) playLine(line.sans);
  }, [line, playLine]);
  const onBoardMove = (from, to) => {
    const node = tree.userMove(cur, from, to);
    if (node) goTo(node);
    else setVersion((v) => v + 1); // redraw to undo an invalid drop
  };

  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.target.closest && e.target.closest('textarea, input, select')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') goTo(cur.parent);
      else if (e.key === 'ArrowUp' || e.key === 'Home') goTo(tree.root);
      else if (e.key === 'f' || e.key === 'F') setOrientation((o) => (o === 'white' ? 'black' : 'white'));
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, cur, tree, goTo]);

  const atStart = !cur.parent;
  const exact = here.opening;
  const ply = sans.length;
  const moveLabel = (san) => (ply % 2 === 0 ? `${ply / 2 + 1}. ${san}` : `${(ply + 1) / 2}… ${san}`);

  let title;
  let note = null;
  if (atStart) title = 'Starting position';
  else if (exact) title = exact.name;
  else if (named) {
    title = named.name;
    note = here.inBook ? 'No separate name for this exact position yet. Keep going.' : 'These moves have left the named openings.';
  } else {
    title = 'Unnamed line';
    note = 'These moves have left the named openings.';
  }
  const eco = exact ? exact.eco : !atStart && named ? named.eco : null;

  return (
    <div className="page openings" hidden={!active}>
      <main className="layout">
        <section className="boardcol" aria-label="Board">
          <div className="boardrow">
            <div className="boardwrap">
              <Board node={cur} orientation={orientation} arrows={arrows} onMove={onBoardMove} redraw={version} visible={active} />
            </div>
          </div>
          <div className="op-actions">
            <button type="button" onClick={() => goTo(cur.parent)} disabled={atStart} title="Back one move (←)">
              ← Back
            </button>
            <button type="button" onClick={() => goTo(tree.root)} disabled={atStart} title="Back to the starting position (↑)">
              Start over
            </button>
            <button type="button" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))} title="Flip board (F)">
              Flip
            </button>
            <button type="button" className="btn-primary" onClick={() => onAnalyze(sans, title)} disabled={atStart}>
              Open in Game analysis
            </button>
          </div>
        </section>

        <aside className="side">
          <section className="card" aria-label="Current opening">
            <div className="op-current">
              <div className="op-title">
                {eco && <span className="op-eco">{eco}</span>}
                <h2>{title}</h2>
              </div>
              {note && <p className="op-note">{note}</p>}
              {path.length > 0 && (
                <div className="op-line" aria-label="Moves played">
                  {path.map((n, i) => (
                    <span key={n.id}>
                      {i % 2 === 0 && <span className="num">{i / 2 + 1}.</span>}
                      <button type="button" className={n === cur ? 'cur' : ''} onClick={() => goTo(n)}>
                        {n.san}
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="card" aria-label="Next moves">
            <div className="card-head">
              <h2>Next moves</h2>
              {book && <span className="op-count">{next.length ? `${here.lines} named lines from here` : ''}</span>}
            </div>
            {failed ? (
              <p className="op-empty">The opening list couldn’t be loaded. Check your connection and reload the page.</p>
            ) : !book ? (
              <p className="op-empty">Loading openings…</p>
            ) : next.length === 0 ? (
              <p className="op-empty">
                {here.inBook ? 'This is the end of the named line.' : 'No named openings continue from this position.'} Go back a move, or search below.
              </p>
            ) : (
              <ul className="op-next">
                {next.map((n) => {
                  const lead = n.lead;
                  return (
                    <li key={n.san}>
                      <button type="button" onClick={() => play(n.san)}>
                        <span className="op-san">{moveLabel(n.san)}</span>
                        <span className={'op-name' + (n.opening ? '' : ' via')}>
                          {!n.opening && <span className="op-via">leads to </span>}
                          {lead.name}
                        </span>
                        <span className="op-lines" title={`${n.count} named opening${n.count === 1 ? '' : 's'} after this move`}>
                          {n.count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card" aria-label="Find an opening">
            <div className="op-search">
              <label className="field">
                <span>Find an opening</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name or ECO code, e.g. Sicilian Najdorf or B90"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            </div>
            {query.trim() &&
              (results.length === 0 ? (
                <p className="op-empty">{book ? 'No opening matches that.' : 'Loading openings…'}</p>
              ) : (
                <ul className="op-results">
                  {results.map((o) => (
                    <li key={o.sans.join(' ')}>
                      <button type="button" onClick={() => jumpTo(o)}>
                        <span className="op-eco">{o.eco}</span>
                        <span className="op-rname">
                          <strong>{o.name}</strong>
                          <span>{numbered(o.sans)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ))}
          </section>
          <p className="foot">Opening names from the Lichess chess-openings list (public domain).</p>
        </aside>
      </main>
    </div>
  );
}
