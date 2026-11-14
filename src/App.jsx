import { useEffect, useRef, useState } from 'react';
import HomePage from './pages/HomePage.jsx';
import BoardPage from './pages/BoardPage.jsx';
import StatsPage from './pages/StatsPage.jsx';
import OpeningsPage from './pages/OpeningsPage.jsx';
import SolarClockPage, { SunIcon } from './pages/SolarClockPage.jsx';
import { CHESS_PAGES, HOME, PAGES, SITE, SOLAR_PAGE, pageFromHash } from './site.js';

const isChess = (id) => CHESS_PAGES.some((p) => p.id === id);

function NavLink({ p, page, onPick, icon }) {
  const text = (
    <>
      <strong>{p.label}</strong>
      <span>{p.blurb}</span>
    </>
  );
  return (
    <a href={p.hash} className={icon ? 'nav-icon-link' : undefined} aria-current={p.id === page ? 'page' : undefined} onClick={onPick}>
      {icon ? <>{icon}<div>{text}</div></> : text}
    </a>
  );
}

export default function App() {
  const [page, setPage] = useState(pageFromHash);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chessOpen, setChessOpen] = useState(() => isChess(pageFromHash()));
  const [handoff, setHandoff] = useState(null); // a line sent from the opening explorer to the board page
  const [explorerLine, setExplorerLine] = useState(null); // and one sent the other way
  const menuBtn = useRef(null);
  const drawer = useRef(null);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Opening the menu on a chess page shows that page in its group.
  useEffect(() => {
    if (menuOpen && isChess(page)) setChessOpen(true);
  }, [menuOpen, page]);

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

  useEffect(() => {
    const label = PAGES.find((p) => p.id === page).label;
    document.title = page === 'home' ? SITE.name : isChess(page) ? `${label} · Chess · ${SITE.name}` : `${label} · ${SITE.name}`;
  }, [page]);

  const current = PAGES.find((p) => p.id === page);
  const close = () => setMenuOpen(false);

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
        <a className="site-home" href={HOME.hash}>
          <span className="monogram" aria-hidden="true">{SITE.initials}</span>
          <h1>{SITE.name}</h1>
        </a>
        {isChess(page) && (
          <span className="crumb">
            <span aria-hidden="true">/</span> Chess <span aria-hidden="true">/</span> <b>{current.label}</b>
          </span>
        )}
        {page === 'solar' && (
          <span className="crumb">
            <span aria-hidden="true">/</span> <b>{current.label}</b>
          </span>
        )}
        {page !== 'home' && <p>{current.blurb}</p>}
      </header>

      <div className={'scrim' + (menuOpen ? ' open' : '')} onClick={close} aria-hidden="true" />
      <nav id="drawer" ref={drawer} className={'drawer' + (menuOpen ? ' open' : '')} aria-label="Pages" inert={!menuOpen}>
        <div className="drawer-head">
          <span className="monogram" aria-hidden="true">{SITE.initials}</span>
          {SITE.name}
        </div>
        <NavLink p={HOME} page={page} onPick={close} />

        <div className="nav-group">
          <button
            type="button"
            className={'nav-group-btn' + (isChess(page) ? ' has-current' : '')}
            aria-expanded={chessOpen}
            aria-controls="nav-chess"
            onClick={() => setChessOpen((o) => !o)}
          >
            <img className="logo" src="/logo.png" alt="" width="22" height="22" />
            <strong>Chess</strong>
            <svg className="chev" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
          <div id="nav-chess" className="nav-group-items" hidden={!chessOpen}>
            {CHESS_PAGES.map((p) => (
              <NavLink key={p.id} p={p} page={page} onPick={close} />
            ))}
          </div>
        </div>
        <NavLink p={SOLAR_PAGE} page={page} onPick={close} icon={<SunIcon />} />
      </nav>

      <HomePage active={page === 'home'} />
      <BoardPage
        active={page === 'board'}
        handoff={handoff}
        onExplore={(sans) => {
          setExplorerLine({ sans });
          location.hash = '#/chess/openings';
        }}
      />
      <StatsPage active={page === 'stats'} />
      <OpeningsPage
        active={page === 'openings'}
        line={explorerLine}
        onAnalyze={(sans, name) => {
          setHandoff({ sans, name });
          location.hash = '#/chess';
        }}
      />
      <SolarClockPage active={page === 'solar'} />
    </div>
  );
}
