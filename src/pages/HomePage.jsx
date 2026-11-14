import { CHESS_PAGES, SITE, SOLAR_PAGE } from '../site.js';
import { SunIcon } from './SolarClockPage.jsx';

export default function HomePage({ active }) {
  return (
    <div className="page home" hidden={!active}>
      <section className="hero">
        <h2>{SITE.name}</h2>
        <p>{SITE.tagline}</p>
      </section>

      <section className="projects" aria-labelledby="projects-title">
        <h3 id="projects-title">Projects</h3>
        <div className="project-grid">
          <article className="project-card">
            <div className="project-head">
              <img className="logo" src="/logo.png" alt="" width="40" height="40" />
              <div>
                <h4>Chess · Candidate Lines</h4>
                <p>Analysis board, player stats and an opening explorer, with Stockfish 19 running in the browser.</p>
              </div>
            </div>
            <ul className="project-links">
              {CHESS_PAGES.map((p) => (
                <li key={p.id}>
                  <a href={p.hash}>
                    <strong>{p.label}</strong>
                    <span>{p.blurb}</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="project-tags">React · Vite · chessground · chess.js · Stockfish WASM</p>
          </article>

          <article className="project-card">
            <div className="project-head">
              <SunIcon size={40} />
              <div>
                <h4>Solar Clock</h4>
                <p>A clock that tells time by the sun: 7AM is sunrise, 7PM is sunset, and an hour stretches or shrinks with the season and the city.</p>
              </div>
            </div>
            <ul className="project-links">
              <li>
                <a href={SOLAR_PAGE.hash}>
                  <strong>Open the clock</strong>
                  <span>{SOLAR_PAGE.blurb}</span>
                </a>
              </li>
            </ul>
            <p className="project-tags">React · Luxon · NOAA solar-position maths</p>
          </article>
        </div>
      </section>
    </div>
  );
}
