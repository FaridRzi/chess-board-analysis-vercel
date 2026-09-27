import { useEffect, useRef } from 'react';
import { moveNumberLabel } from '../lib/chess.js';
import { isAncestorOrSelf } from '../lib/tree.js';
import { KINDS } from '../lib/review.js';

function MoveBtn({ node, cur, onSelect, variant, mark }) {
  const cls = ['mv'];
  if (variant) cls.push('v');
  if (node === cur) cls.push('cur');
  return (
    <button type="button" className={cls.join(' ')} onClick={() => onSelect(node)} aria-label={mark ? `${node.san}, ${KINDS[mark].label}` : undefined}>
      {node.san}
      {mark && <span className={'glyph ' + mark}>{KINDS[mark].glyph}</span>}
    </button>
  );
}

/** A side line written inline, e.g. "9… b6 10. Nb5 (10. Nd5) cxb5". */
function InlineLine({ parent, first, cur, onSelect }) {
  const parts = [];
  let p = parent;
  let node = first;
  let needNumber = true;
  while (node) {
    const { n, black } = moveNumberLabel(p.fen);
    if (!black)
      parts.push(
        <span key={`n${node.id}`} className="vn">
          {n}.
        </span>
      );
    else if (needNumber)
      parts.push(
        <span key={`n${node.id}`} className="vn">
          {n}…
        </span>
      );
    parts.push(<MoveBtn key={node.id} node={node} cur={cur} onSelect={onSelect} variant />);
    parts.push(' ');
    needNumber = false;
    const alts = node === first ? [] : p.children.filter((c) => c !== node);
    for (const a of alts) {
      parts.push(
        <span key={`s${a.id}`} className="sub">
          (<InlineLine parent={p} first={a} cur={cur} onSelect={onSelect} />)
        </span>
      );
      parts.push(' ');
      needNumber = true;
    }
    p = node;
    node = node.children[0] || null;
  }
  while (parts.length && parts[parts.length - 1] === ' ') parts.pop();
  return <>{parts}</>;
}

export default function MoveList({ root, cur, result, onSelect, version, marks }) {
  const wrap = useRef(null);

  useEffect(() => {
    const w = wrap.current;
    const el = w && w.querySelector('.cur');
    if (!el) return;
    const top = el.offsetTop - w.offsetTop;
    if (top < w.scrollTop || top > w.scrollTop + w.clientHeight - 30) w.scrollTop = top - w.clientHeight / 2;
  }, [cur, version]);

  const items = [];
  let node = root;
  let needDots = false;
  let any = false;
  while (node) {
    const mainChild = node.children.find((c) => c.main) || null;
    const vars = node.children.filter((c) => !c.main);
    const { n, black } = moveNumberLabel(node.fen);
    if (mainChild) {
      any = true;
      if (!black) items.push(<span key={`mn${mainChild.id}`} className="mn">{n}.</span>);
      else if (needDots || node === root) {
        items.push(<span key={`mn${mainChild.id}`} className="mn">{n}.</span>);
        items.push(<span key={`g${mainChild.id}`} className="mv ghost">…</span>);
      }
      items.push(<MoveBtn key={mainChild.id} node={mainChild} cur={cur} onSelect={onSelect} mark={marks && marks.get(mainChild.id)} />);
      needDots = false;
    }
    if (vars.length) {
      any = true;
      if (mainChild && !black) items.push(<span key={`f${node.id}`} className="mv ghost" />);
      items.push(
        <div key={`v${node.id}`} className="vars">
          {vars.map((v) => (
            <div key={v.id} className={'var' + (isAncestorOrSelf(v, cur) ? ' active' : '')}>
              <InlineLine parent={node} first={v} cur={cur} onSelect={onSelect} />
            </div>
          ))}
        </div>
      );
      needDots = !!mainChild && !black;
    }
    node = mainChild;
  }

  return (
    <div className="moves" ref={wrap}>
      {any ? (
        <>
          {items}
          {result && result !== '*' && <span className="res">{result}</span>}
        </>
      ) : (
        <p className="nomoves">No moves yet. Move a piece on the board to start a line.</p>
      )}
    </div>
  );
}
