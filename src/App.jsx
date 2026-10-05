import { useEffect, useRef, useState } from 'react';
import BoardPage from './pages/BoardPage.jsx';
import StatsPage from './pages/StatsPage.jsx';
import OpeningsPage from './pages/OpeningsPage.jsx';

const PAGES = [
  { id: 'board', hash: '#/', label: 'Game analysis', blurb: 'Stockfish 19 in your browser · top 5 moves' },
  { id: 'stats', hash: '#/stats', label: 'Player stats', blurb: 'Wins, draws and losses from Chess.com' },
  { id: 'openings', hash: '#/openings', label: 'Opening explorer', blurb: 'Browse openings and their names' },
];

const pageFromHash = () => (location.hash.startsWith('#/stats') ? 'stats' : location.hash.startsWith('#/openings') ? 'openings' : 'board');

export default function App() {
  const [page, setPage] = useState(pageFromHash);
  const [menuOpen, setMenuOpen] = useState(false);
  const [handoff, setHandoff] = useState(null); // a line sent from the opening explorer to the board page
  const [explorerLine, setExplorerLine] = useState(null); // and one sent the other way
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
        <img className="logo" src="/logo.png" alt="" width="34" height="34" />
        <h1>
          Candidate <span>Lines</span>
        </h1>
        <p>{current.blurb}</p>
      </header>

      <div className={'scrim' + (menuOpen ? ' open' : '')} onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <nav id="drawer" ref={drawer} className={'drawer' + (menuOpen ? ' open' : '')} aria-label="Pages" inert={!menuOpen}>
        <div className="drawer-head">
          <img className="logo" src="/logo.png" alt="" width="30" height="30" />
          Candidate <span>Lines</span>
        </div>
        {PAGES.map((p) => (
          <a key={p.id} href={p.hash} aria-current={p.id === page ? 'page' : undefined} onClick={() => setMenuOpen(false)}>
            <strong>{p.label}</strong>
            <span>{p.blurb}</span>
          </a>
        ))}
      </nav>

      <BoardPage
        active={page === 'board'}
        handoff={handoff}
        onExplore={(sans) => {
          setExplorerLine({ sans });
          location.hash = '#/openings';
        }}
      />
      <StatsPage active={page === 'stats'} />
      <OpeningsPage
        active={page === 'openings'}
        line={explorerLine}
        onAnalyze={(sans, name) => {
          setHandoff({ sans, name });
          location.hash = '#/';
        }}
      />
    </div>
  );
}
