import { BookIcon } from './Bits.jsx';

/**
 * The opening book for the position on the board: its name and the book moves from here.
 * Fixed height. Clicking a move plays it (as a side line when the game went another way).
 */
export default function BookBar({ ready, here, name, gameMove, moveLabel, left, onPlay, onLastBook, onExplore }) {
  let body;
  if (!ready) body = <span className="bk-note">Loading opening book…</span>;
  else if (!here.inBook)
    body = (
      <>
        <span className="bk-note">Out of book{left ? ` since ${left}` : ''}.</span>
        <button type="button" className="bk-link" onClick={onLastBook}>
          Go to the last book position
        </button>
      </>
    );
  else if (!here.moves.length) body = <span className="bk-note">End of the named line.</span>;
  else
    body = here.moves.map((m) => (
      <button
        key={m.san}
        type="button"
        className={'bk-move' + (m.san === gameMove ? ' played' : '')}
        title={(m.opening ? '' : 'Leads to ') + m.lead.name + (m.san === gameMove ? ' · played in the game' : '')}
        onClick={() => onPlay(m.san)}
      >
        {moveLabel(m.san)}
      </button>
    ));

  return (
    <section className="card bookbar" aria-label="Opening book">
      <div className="bk-head">
        <BookIcon />
        <strong title={name.text}>
          {name.eco && <span className="op-eco">{name.eco}</span>}
          {name.text}
        </strong>
        <button type="button" className="bk-link" onClick={onExplore}>
          Opening explorer
        </button>
      </div>
      <div className="bk-moves">{body}</div>
    </section>
  );
}
