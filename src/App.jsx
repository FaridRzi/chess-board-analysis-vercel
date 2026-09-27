import { useEffect, useRef, useState } from 'react';
import BoardPage from './pages/BoardPage.jsx';
import StatsPage from './pages/StatsPage.jsx';

const PAGES = [
  { id: 'board', hash: '#/', label: 'Game analysis', blurb: 'Stockfish 19 in your browser · top 5 moves' },
  { id: 'stats', hash: '#/stats', label: 'Player stats', blurb: 'Wins, draws and losses from Chess.com' },
];

const pageFromHash = () => (location.hash.startsWith('#/stats') ? 'stats' : 'board');

export default function App() {
  const [page, setPage] = useState(pageFromHash);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtn = useRef(null);
  const drawer = useRef(null);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    drawer.current.querySelector('a[aria-current="page"]')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuBtn.current.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const current = PAGES.find((p) => p.id === page);

  return (
    <div className="app">
      <header className="brand">
        <button
          ref={menuBtn}
          type="button"
          className="menu-btn"
          aria-label="Menu"
          aria-expanded={menuOpen}
          aria-controls="drawer"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <h1>
          Candidate <span>Lines</span>
        </h1>
        <p>{current.blurb}</p>
      </header>

      <div className={'scrim' + (menuOpen ? ' open' : '')} onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <nav id="drawer" ref={drawer} className={'drawer' + (menuOpen ? ' open' : '')} aria-label="Pages" inert={!menuOpen}>
        <div className="drawer-head">
          Candidate <span>Lines</span>
        </div>
        {PAGES.map((p) => (
          <a key={p.id} href={p.hash} aria-current={p.id === page ? 'page' : undefined} onClick={() => setMenuOpen(false)}>
            <strong>{p.label}</strong>
            <span>{p.blurb}</span>
          </a>
        ))}
      </nav>

      <BoardPage active={page === 'board'} />
      <StatsPage active={page === 'stats'} />
    </div>
  );
}
