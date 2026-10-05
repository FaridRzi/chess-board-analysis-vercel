/** "● White · username 1850" — the color is always spelled out, the name and rating when the game has them. */
export function Player({ color, name, elo, className = '' }) {
  const named = name && name !== '?';
  return (
    <div className={'player ' + className} data-color={color}>
      <span className="dot" />
      <span className="pcolor">{color === 'white' ? 'White' : 'Black'}</span>
      {named && <span className="pname">{name}</span>}
      {elo && elo !== '?' && <span className="elo">{elo}</span>}
    </div>
  );
}

export function EvalBar({ share, flipped }) {
  return (
    <div className={'evalbar' + (flipped ? ' flipped' : '')} aria-hidden="true" style={{ '--white': (share * 100).toFixed(1) + '%' }}>
      <div className="fill" />
    </div>
  );
}

/** Open-book icon: marks moves that follow named opening theory. */
export const BookIcon = () => (
  <svg className="book-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13" />
  </svg>
);

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24">
    <path d={d} />
  </svg>
);

export function NavBar({ onFirst, onPrev, onNext, onLast, onFlip, onReset, atStart, atEnd, inSideLine }) {
  return (
    <div className="navbar">
      <button type="button" aria-label="First move" title="First move (↑ or Home)" onClick={onFirst} disabled={atStart}>
        <Icon d="M6 5v14M18 6l-7 6 7 6" />
      </button>
      <button type="button" aria-label="Previous move" title="Previous move (←)" onClick={onPrev} disabled={atStart}>
        <Icon d="M15 6l-6 6 6 6" />
      </button>
      <button type="button" aria-label="Next move" title="Next move (→)" onClick={onNext} disabled={atEnd}>
        <Icon d="M9 6l6 6-6 6" />
      </button>
      <button type="button" aria-label="Last move" title="Last move (↓ or End)" onClick={onLast} disabled={atEnd}>
        <Icon d="M18 5v14M6 6l7 6-7 6" />
      </button>
      <button type="button" className="labeled" aria-label="Flip board" title="Flip board (F)" onClick={onFlip}>
        <Icon d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3" />
        <span>Flip</span>
      </button>
      <button
        type="button"
        className="labeled"
        aria-label="Reset to the game"
        title="Back to the game where your line branched off (R)"
        onClick={onReset}
        disabled={!inSideLine}
      >
        <Icon d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5" />
        <span>Reset</span>
      </button>
    </div>
  );
}

export function HowTo() {
  return (
    <details className="howto">
      <summary>How to type a game</summary>
      <div className="howto-body">
        <p>Paste a Chess.com link, any PGN (Chess.com, Lichess and others), or just the moves. Only the moves are needed:</p>
        <pre>1. e4 e5 2. Nf3 Nc6 3. Bb5 a6</pre>
        <ul>
          <li>
            Move numbers are optional: <code>e4 e5 Nf3 Nc6</code> works too.
          </li>
          <li>
            Pieces: <code>K Q R B N</code>. German <code>K D T L S</code> also works. Pawn moves are just the square:{' '}
            <code>e4</code>, <code>exd5</code>.
          </li>
          <li>
            Castling: <code>O-O</code> and <code>O-O-O</code> (zeros are fine).
          </li>
          <li>
            Promotion: <code>e8=Q</code> or <code>e8Q</code>.
          </li>
          <li>
            <code>x</code>, <code>+</code>, <code>#</code>, <code>!</code> and <code>?</code> are optional.
          </li>
          <li>Headers, clock times, comments and side lines are ignored.</li>
        </ul>
        <p>If a move has a typo, the game loads up to that move and tells you where it stopped.</p>
      </div>
    </details>
  );
}

export function FenRow({ fen }) {
  const copy = async (e) => {
    const btn = e.currentTarget;
    const input = btn.previousElementSibling;
    try {
      await navigator.clipboard.writeText(fen);
      btn.textContent = 'Copied';
      setTimeout(() => (btn.textContent = 'Copy'), 1400);
    } catch (err) {
      input.focus();
      input.select();
    }
  };
  return (
    <div className="fenrow">
      <label htmlFor="fen">FEN</label>
      <input id="fen" readOnly value={fen} />
      <button type="button" onClick={copy}>
        Copy
      </button>
    </div>
  );
}
