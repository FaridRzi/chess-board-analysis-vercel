// Site-wide identity and the page list the menu and router share.
export const SITE = {
  name: 'Farid Rezaei',
  initials: 'FR',
  tagline: 'Things I build. Pick a project below or from the menu.',
};

export const HOME = { id: 'home', hash: '#/', label: 'Home', blurb: 'Portfolio' };

export const CHESS_PAGES = [
  { id: 'board', hash: '#/chess', label: 'Game analysis', blurb: 'Stockfish 19 in your browser · top 5 moves' },
  { id: 'stats', hash: '#/chess/stats', label: 'Player stats', blurb: 'Wins, draws and losses from Chess.com' },
  { id: 'openings', hash: '#/chess/openings', label: 'Opening explorer', blurb: 'Browse openings and their names' },
];

export const PAGES = [HOME, ...CHESS_PAGES];

// Old links (before the portfolio move) pointed at #/stats and #/openings.
const LEGACY = { '#/stats': '#/chess/stats', '#/openings': '#/chess/openings' };

export function pageFromHash() {
  const raw = location.hash || '#/';
  const legacy = Object.keys(LEGACY).find((k) => raw.startsWith(k));
  if (legacy) {
    history.replaceState(null, '', LEGACY[legacy]);
    return pageFromHash();
  }
  // Longest hash first so #/chess/stats is not matched by #/chess.
  const match = [...CHESS_PAGES].sort((a, b) => b.hash.length - a.hash.length).find((p) => raw.startsWith(p.hash));
  return match ? match.id : 'home';
}
