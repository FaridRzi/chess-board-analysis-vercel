// Rebuilds src/data/openings.json from https://github.com/lichess-org/chess-openings (CC0).
//   node scripts/build-openings.mjs
// Output: { start, openings: [[eco, name, "e4 e5 Nf3"], …], keys: [position fingerprint per tree node] }.
// `keys` follows the order src/lib/openings.js creates tree nodes in: line by line, move by move, new moves only.
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { positionHash } from '../src/lib/openings.js';

const SOURCE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master/';

const openings = [];
const keys = [];
const seen = new Set(); // move sequences that already have a tree node

for (const file of ['a', 'b', 'c', 'd', 'e']) {
  const res = await fetch(`${SOURCE}${file}.tsv`);
  if (!res.ok) throw new Error(`${file}.tsv: HTTP ${res.status}`);
  for (const row of (await res.text()).split('\n').slice(1)) {
    if (!row.trim()) continue;
    const [eco, name, pgn] = row.split('\t');
    const chess = new Chess();
    const sans = [];
    for (const san of pgn.replace(/\d+\.(\.\.)?/g, ' ').trim().split(/\s+/)) {
      sans.push(chess.move(san).san); // throws on an illegal move; spelled the way chess.js writes it
      const path = sans.join(' ');
      if (!seen.has(path)) {
        seen.add(path);
        keys.push(positionHash(chess.fen()));
      }
    }
    openings.push([eco, name, sans.join(' ')]);
  }
}

const out = new URL('../src/data/openings.json', import.meta.url);
fs.writeFileSync(out, JSON.stringify({ start: positionHash(new Chess().fen()), openings, keys }));
console.log(`${openings.length} openings, ${keys.length} tree nodes, ${new Set(keys).size + 1} positions → ${fs.statSync(out).size} bytes`);
