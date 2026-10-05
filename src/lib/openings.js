// Opening book: named openings (see src/data/README.md) arranged as a tree of moves and indexed by
// position, so a known position counts as "book" whatever move order reached it.
// The data is loaded on demand.

let book = null;
let loading = null;

/** A position's identity: pieces, side to move, castling rights and en-passant square. */
export const positionKey = (fen) => fen.split(' ').slice(0, 4).join(' ');

/**
 * 53-bit fingerprint of a position (cyrb53), as base 36. The data file ships one per book position,
 * computed by scripts/build-openings.mjs, so the browser never has to replay the book's moves.
 */
export function positionHash(fen) {
  const str = positionKey(fen);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const makeNode = (san) => ({ san, children: new Map(), opening: null, count: 0, lead: undefined });

/** { root, all, byPos } — the move tree, every opening as { eco, name, sans }, and the position index. */
export function loadBook() {
  if (!loading) loading = build();
  return loading;
}

async function build() {
  // openings: [eco, name, moves]; keys: one position fingerprint per tree node, in the order nodes are created below.
  const { default: data } = await import('../data/openings.json');
  const root = makeNode(null);
  const all = [];
  const byPos = new Map([[data.start, [root]]]);
  let created = 0;
  for (const [eco, name, moves] of data.openings) {
    const opening = { eco, name, sans: moves.split(' ') };
    all.push(opening);
    let node = root;
    root.count++;
    for (const san of opening.sans) {
      let child = node.children.get(san);
      if (!child) {
        node.children.set(san, (child = makeNode(san)));
        const key = data.keys[created++];
        const at = byPos.get(key);
        if (at) at.push(child);
        else byPos.set(key, [child]);
      }
      child.count++; // named openings at or below this move
      node = child;
    }
    if (!node.opening) node.opening = opening;
  }
  book = { root, all, byPos };
  return book;
}

/**
 * What the book knows about a position.
 * inBook: it occurs on a named line; opening: its own name, if it has one;
 * lines: named openings from here; moves: book continuations as { san, count, opening, lead }, most lines first.
 */
export function bookAt(book, fen) {
  const nodes = book.byPos.get(positionHash(fen));
  if (!nodes) return { inBook: false, opening: null, lines: 0, moves: [] };
  const named = nodes.find((n) => n.opening);
  const bySan = new Map();
  for (const node of nodes)
    for (const child of node.children.values()) {
      const m = bySan.get(child.san);
      if (!m) bySan.set(child.san, { san: child.san, count: child.count, opening: child.opening, top: child });
      else {
        m.count += child.count;
        if (!m.opening) m.opening = child.opening;
        if (child.count > m.top.count) m.top = child;
      }
    }
  const moves = [...bySan.values()]
    .map((m) => ({ san: m.san, count: m.count, opening: m.opening, lead: m.opening || leadOf(m.top) }))
    .sort((a, b) => b.count - a.count || a.san.localeCompare(b.san));
  return {
    inBook: true,
    opening: named ? named.opening : null,
    lines: nodes.reduce((sum, n) => sum + n.count, 0) - nodes.filter((n) => n.opening).length,
    moves,
  };
}

/**
 * How far a game follows the book. nodes: the game's main line [root, move1, …].
 * plies: book moves from the start, unbroken; ids: those moves' node ids; white/black: how many each side played;
 * opening: the deepest named opening reached; last: the last book position; left: the first move outside the book.
 */
export function bookOfGame(book, nodes) {
  const ids = new Set();
  let opening = null;
  let plies = 0;
  if (book.byPos.has(positionHash(nodes[0].fen))) {
    for (let k = 1; k < nodes.length; k++) {
      const at = book.byPos.get(positionHash(nodes[k].fen));
      if (!at) break;
      ids.add(nodes[k].id);
      plies = k;
      const named = at.find((n) => n.opening);
      if (named) opening = named.opening;
    }
  }
  const whiteFirst = nodes[0].fen.split(' ')[1] === 'w';
  const first = Math.ceil(plies / 2);
  return {
    plies,
    ids,
    white: whiteFirst ? first : plies - first,
    black: whiteFirst ? plies - first : first,
    opening,
    last: nodes[plies],
    left: nodes[plies + 1] || null,
  };
}

/**
 * For a move that is only a step on the way: the nearest named opening below it (fewest extra moves),
 * and among equally near ones the main line, i.e. the one with the most named lines beneath it.
 */
export function leadOf(node) {
  if (node.lead !== undefined) return node.lead;
  let found = null;
  for (let level = [node]; level.length && !found; ) {
    const named = level.filter((n) => n.opening);
    if (named.length) found = named.reduce((best, n) => (n.count > best.count ? n : best)).opening;
    else level = level.flatMap((n) => [...n.children.values()]);
  }
  return (node.lead = found);
}

/**
 * Where a sequence of moves sits in the book.
 * node: the book node, or null once the moves leave the book; named: the last named opening passed on the way.
 */
export function locate(root, sans) {
  let node = root;
  let named = null;
  for (const san of sans) {
    node = node && node.children.get(san);
    if (!node) return { node: null, named };
    if (node.opening) named = node.opening;
  }
  return { node, named };
}

/** Continuations from a node, most named lines first. */
export function continuations(node) {
  return node ? [...node.children.values()].sort((a, b) => b.count - a.count || a.san.localeCompare(b.san)) : [];
}

/** Openings whose name or ECO code contains every word typed; best matches and shortest lines first. */
export function searchOpenings(all, query, limit = 60) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const plain = (s) => s.toLowerCase().replace(/[’']/g, '');
  const hits = all.filter((o) => {
    const hay = plain(o.name) + ' ' + o.eco.toLowerCase();
    return words.every((w) => hay.includes(plain(w)));
  });
  // Names that begin with what was typed ("kings indian" → King's Indian Defense) come before mere mentions.
  const head = plain(words.join(' '));
  const starts = (o) => (plain(o.name).startsWith(head) || o.eco.toLowerCase() === head ? 0 : 1);
  return hits.sort((a, b) => starts(a) - starts(b) || a.sans.length - b.sans.length || a.name.localeCompare(b.name)).slice(0, limit);
}

/** "1. e4 e5 2. Nf3" from plain SAN moves. */
export function numbered(sans) {
  return sans.map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${s}` : s)).join(' ');
}
