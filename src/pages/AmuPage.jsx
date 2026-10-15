import { useEffect } from 'react';

const FONT_URL = 'https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap';

/** A single name, set large in a calligraphic script. The font loads only when this page is opened. */
export default function AmuPage({ active }) {
  useEffect(() => {
    if (!active || document.querySelector(`link[href="${FONT_URL}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_URL;
    document.head.appendChild(link);
  }, [active]);

  return (
    <div className="page amu" hidden={!active}>
      <section className="amu-stage">
        <h2 className="amu-name">Amu Akbar</h2>
        <span className="amu-rule" aria-hidden="true" />
      </section>
    </div>
  );
}
