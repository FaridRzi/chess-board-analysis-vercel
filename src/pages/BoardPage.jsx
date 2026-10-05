import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Chess, validateFen } from 'chess.js';
import Board from '../components/Board.jsx';
import BoardEditor from '../components/BoardEditor.jsx';
import ReviewLane from '../components/ReviewLane.jsx';
import { useReview } from '../useReview.js';
import { mainLine } from '../lib/review.js';
import EnginePanel from '../components/EnginePanel.jsx';
import MoveList from '../components/MoveList.jsx';
import { EvalBar, FenRow, HowTo, NavBar, Player } from '../components/Bits.jsx';
import { useEngine } from '../useEngine.js';
import { GameTree, lastOf, mainAncestor, nextOf } from '../lib/tree.js';
import { parseGameText, looksLikeFen, labelFor } from '../lib/pgn.js';
import { parseChessComLink, fetchChessComGame } from '../lib/chesscom.js';
import { START_FEN, chessAt, formatTimeControl, turnOf, winShare } from '../lib/chess.js';

// The page opens on a fresh board: the starting position, no moves yet.
function initialGame() {
  const tree = new GameTree(START_FEN, []);
  return { tree, cur: tree.root, headers: {}, label: 'New game', notice: null };
}

function Notice({ notice }) {
  if (!notice) return null;
  return (
    <div className={'notice ' + notice.kind} role="status">
      <strong>{notice.title}</strong> {notice.body}
    </div>
  );
}

export default function BoardPage({ active, handoff }) {
  const [game, setGame] = useState(initialGame);
  const [version, setVersion] = useState(0); // bumps when the tree changes or the board must redraw
  const [orientation, setOrientation] = useState('white');
  const [engineWanted, setEngineWanted] = useState(true);
  const [depth, setDepth] = useState(20);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);
  const sourceBox = useRef(null);
  const [collapsed, setCollapsed] = useState(false); // one line after a game loads; opens on tap

  // Grow the box with its text (typed or pasted), up to a limit; one line while collapsed.
  useLayoutEffect(() => {
    const el = sourceBox.current;
    el.style.height = '';
    if (collapsed) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, [source, collapsed]);
  const [promotion, setPromotion] = useState(null); // { from, to, color } while the user picks a piece
  const [editing, setEditing] = useState(false); // board setup mode

  const { tree, cur, headers } = game;
  const locked = headers.Result === '*'; // game still in progress
  const engineOn = engineWanted && !locked && active && !editing;
  const engine = useEngine({ fen: cur.fen, enabled: engineOn, depth });
  // Game review runs whenever the engine is allowed (never for games in progress).
  const review = useReview(tree, engineWanted && !locked);
  const curMark = review.marks.get(cur.id) || null;
  const boardMark = useMemo(() => (curMark ? { square: cur.lastMove[1], kind: curMark } : null), [curMark, cur]);

  const goTo = useCallback((node) => {
    if (!node) return;
    setPromotion(null);
    setGame((g) => ({ ...g, cur: node }));
    setVersion((v) => v + 1);
  }, []);

  const loadGame = (h, startFen, moves, label, notice, startPly = 0) => {
    const t = new GameTree(startFen, moves);
    let node = t.root;
    for (let i = 0; i < startPly && nextOf(node); i++) node = nextOf(node);
    const inProgress = h.Result === '*';
    setGame({
      tree: t,
      cur: node,
      headers: h,
      label,
      notice: inProgress
        ? {
            kind: 'warn',
            title: 'This game is still in progress, so the engine is off.',
            body: 'Chess.com’s fair-play rules don’t allow engine help in ongoing games, daily games included. Load it again once the game has finished to review it.',
          }
        : notice || null,
    });
    setVersion((v) => v + 1);
    setCollapsed(true);
    sourceBox.current && sourceBox.current.blur();
  };

  // A line sent over from the opening explorer: load it and show its last move.
  useEffect(() => {
    if (!handoff) return;
    const g = parseGameText(handoff.sans.join(' '));
    loadGame({}, g.startFen, g.moves, handoff.name, null, g.moves.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff]);

  const clearSource = () => {
    setSource('');
    setCollapsed(false);
    sourceBox.current.focus();
  };

  // From the review lane: the next main-line move of this kind by this player, wrapping around.
  const jumpToMark = (kind, color) => {
    const line = mainLine(tree);
    const here = line.indexOf(mainAncestor(cur));
    const hits = line.filter((n) => n.parent && review.marks.get(n.id) === kind && turnOf(n.parent.fen) === color);
    if (hits.length) goTo(hits.find((n) => line.indexOf(n) > here) || hits[0]);
  };

  const setNotice = (notice) => setGame((g) => ({ ...g, notice }));

  async function pasteClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setNotice({ kind: 'info', title: 'The clipboard is empty.', body: 'Copy a game link, PGN or moves first, then tap Paste.' });
        return;
      }
      setSource(text.trim());
      setCollapsed(false);
      sourceBox.current.focus();
    } catch (e) {
      setNotice({
        kind: 'info',
        title: 'Couldn’t read the clipboard.',
        body: 'Your browser blocked it. Click in the box and press ⌘V (Ctrl+V on Windows) instead.',
      });
    }
  }

  async function handleLoad() {
    const raw = source.trim();
    if (!raw) return;
    const link = parseChessComLink(raw);
    if (link) {
      setLoading(true);
      try {
        const g = await fetchChessComGame(link.kind, link.id);
        loadGame(g.headers, g.startFen, g.moves, `Chess.com ${link.kind} game ${link.id}`);
      } catch (e) {
        setNotice({
          kind: 'info',
          title: `Couldn’t load game ${link.id} from Chess.com.`,
          body: `${e.message} Paste its PGN instead: in the Chess.com app, open the game, tap Share → PGN → Copy, then paste it above and tap Load.`,
        });
      } finally {
        setLoading(false);
      }
      return;
    }
    if (/^https?:\/\//i.test(raw)) {
      setNotice({ kind: 'error', title: 'That link isn’t a Chess.com game.', body: 'For other sites, copy the game’s PGN and paste it here.' });
      return;
    }
    if (looksLikeFen(raw)) {
      const v = validateFen(raw);
      if (v.ok) loadGame({}, new Chess(raw).fen(), [], 'Position from FEN');
      else setNotice({ kind: 'error', title: 'That FEN isn’t valid.', body: v.error });
      return;
    }
    const g = parseGameText(raw);
    if (g.error) {
      setNotice({ kind: 'error', title: 'Couldn’t load that game.', body: g.error });
      return;
    }
    if (!g.moves.length && g.stoppedAt) {
      setNotice({
        kind: 'error',
        title: `Couldn’t read the first move, “${g.stoppedAt.label}”.`,
        body: 'Write moves like 1. e4 e5 2. Nf3 Nc6. See “How to type a game” below the box.',
      });
      return;
    }
    const h = { ...g.headers };
    if (g.result) h.Result = g.result;
    const notice = g.stoppedAt
      ? {
          kind: 'warn',
          title: `Loaded ${g.moves.length} move${g.moves.length === 1 ? '' : 's'}, then stopped at ${g.stoppedAt.label}.`,
          body: 'That move isn’t legal in the position (or has a typo). Fix it in the box and tap Load again.',
        }
      : null;
    loadGame(h, g.startFen, g.moves, labelFor(h), notice);
  }

  const onBoardMove = (from, to) => {
    if (tree.isPromotion(cur, from, to)) {
      setPromotion({ from, to, color: chessAt(cur.fen).get(from).color === 'w' ? 'white' : 'black' });
      return;
    }
    const next = tree.userMove(cur, from, to);
    if (next) goTo(next);
    else setVersion((v) => v + 1); // redraw to undo an invalid drop
  };
  const onPromote = useCallback(
    (piece) => {
      const p = promotion;
      setPromotion(null);
      const next = piece && p && tree.userMove(cur, p.from, p.to, piece);
      if (next) goTo(next);
      else setVersion((v) => v + 1); // cancelled: put the pawn back
    },
    [promotion, tree, cur, goTo]
  );
  // An engine line: add it to the move tree and jump to its move `upto`.
  const onPlay = (pv, upto = 0) => goTo(tree.playLine(cur, pv, upto));

  useEffect(() => {
    if (!active || promotion || editing) return;
    const onKey = (e) => {
      if (e.target.closest && e.target.closest('textarea, input, select')) return;
      if (e.key === 'ArrowLeft') goTo(cur.parent);
      else if (e.key === 'ArrowRight') goTo(nextOf(cur));
      else if (e.key === 'Home' || e.key === 'ArrowUp') goTo(tree.root);
      else if (e.key === 'End' || e.key === 'ArrowDown') goTo(lastOf(cur));
      else if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey) setOrientation((o) => (o === 'white' ? 'black' : 'white'));
      else if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey && !cur.main) goTo(mainAncestor(cur));
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [cur, tree, goTo, active, promotion, editing]);

  // Eval bar and arrows
  const c = chessAt(cur.fen);
  let share = 0.5;
  if (c.isCheckmate()) share = turnOf(cur.fen) === 'white' ? 0 : 1;
  else if (!c.isGameOver() && engineOn && engine.lines[0]) share = winShare(engine.lines[0]);
  const arrowKey = engineOn ? engine.lines.slice(0, 3).map((l) => (l ? l.pv[0] : '')).join(',') : '';
  const arrows = useMemo(() => (arrowKey ? arrowKey.split(',').filter(Boolean) : []), [arrowKey]);

  const meta = [];
  if (headers.Date && !/^\?/.test(headers.Date)) meta.push(headers.Date.replace(/\./g, '-').replace(/-\?\?/g, ''));
  if (headers.TimeControl && headers.TimeControl !== '-') meta.push(formatTimeControl(headers.TimeControl));
  if (headers.Result) meta.push(headers.Result === '*' ? 'In progress' : headers.Result);

  const white = <Player color="white" name={headers.White} elo={headers.WhiteElo} />;
  const black = <Player color="black" name={headers.Black} elo={headers.BlackElo} />;

  return (
    <div className="page" hidden={!active}>
      <header className="top">
        <div className="import">
          <textarea
            id="source"
            rows={1}
            spellCheck={false}
            autoComplete="off"
            aria-label="Game link, PGN or moves"
            placeholder="Link, PGN or moves"
            ref={sourceBox}
            className={collapsed ? 'collapsed' : ''}
            title={collapsed ? 'Tap to show the full text' : undefined}
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setCollapsed(false);
            }}
            onFocus={() => setCollapsed(false)}
            onClick={() => setCollapsed(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleLoad();
              }
            }}
          />
          {source && (
            <button type="button" className="clear-btn" aria-label="Clear" title="Clear" onClick={clearSource}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={pasteClipboard} title="Paste from clipboard">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 4h6v3H9zM9 5H6v15h12V5h-3M9 12h6M9 16h4" />
            </svg>
            Paste
          </button>
          <button id="load" className="btn-primary" type="button" onClick={handleLoad} disabled={loading}>
            {loading ? 'Loading…' : 'Load'}
          </button>
        </div>
        <HowTo />
        <Notice notice={game.notice} />
      </header>

      {!editing && (
        <ReviewLane
          review={review}
          white={headers.White}
          black={headers.Black}
          onJump={jumpToMark}
        />
      )}

      {editing ? (
        <BoardEditor
          initialFen={cur.fen}
          initialOrientation={orientation}
          onCancel={() => setEditing(false)}
          onDone={(fen, o) => {
            setEditing(false);
            setOrientation(o);
            loadGame({}, fen, [], 'Your position');
          }}
        />
      ) : (
        <main className="layout">
          <section className="boardcol" aria-label="Board">
            {orientation === 'white' ? black : white}
            <div className="boardrow">
              <EvalBar share={share} flipped={orientation === 'black'} />
              <div className="boardwrap">
                <Board
                  node={cur}
                  orientation={orientation}
                  arrows={arrows}
                  onMove={onBoardMove}
                  redraw={version}
                  visible={active}
                  promotion={promotion}
                  onPromote={onPromote}
                  mark={boardMark}
                />
              </div>
            </div>
            {orientation === 'white' ? white : black}
            <NavBar
              atStart={!cur.parent}
              atEnd={!nextOf(cur)}
              onFirst={() => goTo(tree.root)}
              onPrev={() => goTo(cur.parent)}
              onNext={() => goTo(nextOf(cur))}
              onLast={() => goTo(lastOf(cur))}
              onFlip={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
              onReset={() => goTo(mainAncestor(cur))}
              inSideLine={!cur.main}
            />
            <div className="status">
              <span>{turnOf(cur.fen) === 'white' ? 'White' : 'Black'} to move</span>
              <button type="button" className="linkish" onClick={() => setEditing(true)}>
                Set up position
              </button>
            </div>
          </section>

          <aside className="side">
            <EnginePanel
              node={cur}
              engine={engine}
              engineOn={engineOn}
              locked={locked}
              depth={depth}
              onToggle={setEngineWanted}
              onDepth={setDepth}
              onPlay={onPlay}
              mark={curMark}
            />

            <section className="card" aria-label="Moves">
              {/* One fixed-height header: the side-line actions replace the game details instead of adding a row. */}
              <div className={'gamehead' + (cur.main ? '' : ' exploring')}>
                <div className="gamehead-text">
                  <strong>{game.label}</strong>
                  <span>{cur.main ? meta.join(' · ') : 'You’re in your own line'}</span>
                </div>
                {!cur.main && (
                  <span className="explore-actions">
                    <button type="button" onClick={() => goTo(tree.deleteLineAt(cur))}>
                      Delete line
                    </button>
                    <button type="button" onClick={() => goTo(mainAncestor(cur))}>
                      Back to game
                    </button>
                  </span>
                )}
              </div>
              <MoveList root={tree.root} cur={cur} result={headers.Result} onSelect={goTo} version={version} marks={review.marks} />
              <FenRow fen={cur.fen} />
            </section>
            <p className="foot">Tap an engine line, or any move in it, to see it on the board. Drag the piece that just moved to change that move.</p>
          </aside>
        </main>
      )}
    </div>
  );
}
