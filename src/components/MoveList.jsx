import { useEffect, useRef, useState } from 'react';
import { moveNumberLabel } from '../lib/chess.js';
import { isAncestorOrSelf } from '../lib/tree.js';
import { KINDS } from '../lib/review.js';
import { BookIcon } from './Bits.jsx';

function MoveBtn({ node, cur, onSelect, variant, mark, book }) {
  const cls = ['mv'];
  if (variant) cls.push('v');
  if (node === cur) cls.push('cur');
  if (mark) cls.push('rv-' + mark);
  return (
    <button
      type="button"
      className={cls.join(' ')}
      onClick={() => onSelect(node)}
      aria-label={mark ? `${node.san}, ${KINDS[mark].label}` : book ? `${node.san}, book move` : undefined}
      title={book ? 'Book move' : undefined}
    >
      {node.san}
      {book && <BookIcon />}
      {mark && <span className={'glyph ' + mark}>{KINDS[mark].glyph}</span>}
    </button>
  );
}

/** Moves along a line (following each first continuation), and every variation that starts inside it. */
function lineLength(first) {
  let n = 0;
  for (let node = first; node; node = node.children[0]) n++;
  return n;
}

/** True when `node` starts a variation: it isn't the move its parent's line continues with. */
const startsVariation = (node) => !!node.parent && !node.main && (node.parent.main || node.parent.children[0] !== node);

/**
 * One variation as an indented, collapsible block. Its moves run inline; where another move was tried
 * instead of one of them, that deeper variation sits in its own block right after the move it replaces.
 */
function Variation({ parent, first, cur, onSelect, collapsed, onToggle }) {
  const open = !collapsed.has(first.id);
  const active = isAncestorOrSelf(first, cur);
  const number = (p, node, force) => {
    const { n, black } = moveNumberLabel(p.fen);
    if (!black) return <span key={`n${node.id}`} className="vn">{n}.</span>;
    return force ? <span key={`n${node.id}`} className="vn">{n}…</span> : null;
  };

  let body;
  if (!open) {
    // Collapsed: the first few moves as plain text, and how much is folded away.
    const preview = [];
    let p = parent;
    let node = first;
    for (let i = 0; node && i < 3; i++) {
      preview.push(number(p, node, i === 0), <span key={node.id} className="pv-san">{node.san}</span>, ' ');
      p = node;
      node = node.children[0] || null;
    }
    const total = lineLength(first);
    body = (
      <button type="button" className="var-summary" onClick={() => onToggle(first.id)}>
        {preview}
        {total > 3 && <span className="vn">…</span>}
        <span className="var-count">
          {total} move{total === 1 ? '' : 's'}
        </span>
      </button>
    );
  } else {
    const blocks = [];
    let seg = [];
    const flush = (key) => {
      if (seg.length) blocks.push(<div key={`seg${key}`} className="var-seg">{seg}</div>);
      seg = [];
    };
    let p = parent;
    let node = first;
    let needNumber = true;
    while (node) {
      seg.push(number(p, node, needNumber), <MoveBtn key={node.id} node={node} cur={cur} onSelect={onSelect} variant />, ' ');
      needNumber = false;
      const alts = node === first ? [] : p.children.filter((c) => c !== node);
      if (alts.length) {
        flush(node.id);
        blocks.push(
          <div key={`kids${node.id}`} className="var-kids">
            {alts.map((a) => (
              <Variation key={a.id} parent={p} first={a} cur={cur} onSelect={onSelect} collapsed={collapsed} onToggle={onToggle} />
            ))}
          </div>
        );
        needNumber = true;
      }
      p = node;
      node = node.children[0] || null;
    }
    flush('end');
    body = <div className="var-body">{blocks}</div>;
  }

  return (
    <div className={'var' + (active ? ' active' : '') + (open ? '' : ' folded')}>
      <button
        type="button"
        className="var-toggle"
        aria-expanded={open}
        aria-label={open ? 'Collapse variation' : 'Expand variation'}
        title={open ? 'Collapse' : 'Expand'}
        onClick={() => onToggle(first.id)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
      {body}
    </div>
  );
}

/** Ids of every variation's first move, anywhere under `root`. */
function variationIds(root) {
  const ids = [];
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (startsVariation(node)) ids.push(node.id);
    stack.push(...node.children);
  }
  return ids;
}

export default function MoveList({ root, cur, result, onSelect, version, marks, bookIds }) {
  const wrap = useRef(null);
  const [collapsed, setCollapsed] = useState(() => new Set()); // first-move ids of folded variations

  useEffect(() => setCollapsed(new Set()), [root]);

  // Stepping into a folded variation opens it (and the ones around it), so the current move is on show.
  useEffect(() => {
    setCollapsed((prev) => {
      let next = prev;
      for (let n = cur; n; n = n.parent)
        if (prev.has(n.id) && startsVariation(n)) {
          if (next === prev) next = new Set(prev);
          next.delete(n.id);
        }
      return next;
    });
  }, [cur]);

  const toggle = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  useEffect(() => {
    const w = wrap.current;
    const el = w && w.querySelector('.cur');
    if (!el) return;
    const top = el.getBoundingClientRect().top - w.getBoundingClientRect().top + w.scrollTop;
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
      items.push(<MoveBtn key={mainChild.id} node={mainChild} cur={cur} onSelect={onSelect} mark={marks && marks.get(mainChild.id)} book={!!bookIds && bookIds.has(mainChild.id)} />);
      needDots = false;
    }
    if (vars.length) {
      any = true;
      if (mainChild && !black) items.push(<span key={`f${node.id}`} className="mv ghost" />);
      items.push(
        <div key={`v${node.id}`} className="vars">
          {vars.map((v) => (
            <Variation key={v.id} parent={node} first={v} cur={cur} onSelect={onSelect} collapsed={collapsed} onToggle={toggle} />
          ))}
        </div>
      );
      needDots = !!mainChild && !black;
    }
    node = mainChild;
  }

  const allVars = variationIds(root);
  const allFolded = allVars.length > 0 && allVars.every((id) => collapsed.has(id));

  return (
    <div className="moves" ref={wrap}>
      {any ? (
        <>
          {allVars.length > 0 && (
            <div className="moves-tools">
              <button type="button" onClick={() => setCollapsed(allFolded ? new Set() : new Set(allVars))}>
                {allFolded ? 'Expand all' : 'Collapse all'} · {allVars.length} variation{allVars.length === 1 ? '' : 's'}
              </button>
            </div>
          )}
          {items}
          {result && result !== '*' && <span className="res">{result}</span>}
        </>
      ) : (
        <p className="nomoves">No moves yet. Move a piece on the board to start a line.</p>
      )}
    </div>
  );
}
