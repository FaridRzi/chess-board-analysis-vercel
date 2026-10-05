// Opening book for the explorer: named openings (see src/data/README.md) arranged as a tree of moves.
// The data is ~370 KB, so it's loaded on demand.

let book = null;

const makeNode = (san) => ({ san, children: new Map(), opening: null, count: 0, lead: undefined });

/** { root, all } — root is the move tree; all is every opening as { eco, name, sans }. */
export async function loadBook() {
  if (book) return book;
  const { default: list } = await import('../data/openings.json');
  const root = makeNode(null);
  const all = [];
  for (const [eco, name, moves] of list) {
    const opening = { eco, name, sans: moves.split(' ') };
    all.push(opening);
    let node = root;
    root.count++;
    for (const san of opening.sans) {
      let child = node.children.get(san);
      if (!child) node.children.set(san, (child = makeNode(san)));
      child.count++; // named openings at or below this move
      node = child;
    }
    if (!node.opening) node.opening = opening;
  }
  book = { root, all };
  return book;
}

/** The nearest named opening at or below a node (fewest extra moves), for moves that are only a step on the way. */
export function leadOf(node) {
  if (node.lead !== undefined) return node.lead;
  let found = null;
  for (let level = [node]; level.length && !found; ) {
    const next = [];
    for (const n of level) {
      if (n.opening) {
        found = n.opening;
        break;
      }
      next.push(...n.children.values());
    }
    level = next;
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
