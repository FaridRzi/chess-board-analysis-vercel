import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// The color definitions. Wrap the component in <ZoneTipProvider>, then spread
// {...tipProps('morning')} onto any element that should show a zone's definition.
// Mouse: shows on hover. Touch: tap to show, tap again or tap elsewhere to hide.
// Keyboard: shows on focus. Escape hides it.

const TipContext = createContext(() => ({}));

export function useZoneTip() {
  return useContext(TipContext);
}

export function ZoneTipProvider({ zones, children }) {
  const [tip, setTip] = useState(null); // { zone, el }
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const tipRef = useRef(null);
  const canHover = useRef(true);

  useEffect(() => {
    canHover.current = window.matchMedia('(hover: hover)').matches;
  }, []);

  const hide = useCallback(() => setTip(null), []);

  // Place the tip above the element, or below it if there is no room, and keep it on screen.
  useLayoutEffect(() => {
    if (!tip || !tipRef.current) return;
    const r = tip.el.getBoundingClientRect();
    const w = tipRef.current.offsetWidth;
    const h = tipRef.current.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, vw - w - 12));
    let top = r.top - h - 10;
    if (top < 8) top = r.bottom + 10;
    setPos({ left, top });
  }, [tip]);

  useEffect(() => {
    if (!tip) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') hide(); };
    const onDocClick = (e) => { if (!e.target.closest || !e.target.closest('[data-sc-zone]')) hide(); };
    window.addEventListener('scroll', hide, { passive: true });
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onDocClick);
    return () => {
      window.removeEventListener('scroll', hide);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onDocClick);
    };
  }, [tip, hide]);

  const tipProps = useCallback((zone) => ({
    'data-sc-zone': zone,
    onMouseEnter: (e) => { if (canHover.current) setTip({ zone, el: e.currentTarget }); },
    onMouseLeave: () => { if (canHover.current) hide(); },
    onFocus: (e) => { if (e.currentTarget.matches(':focus-visible')) setTip({ zone, el: e.currentTarget }); },
    onBlur: hide,
    onClick: (e) => {
      if (canHover.current) return;
      const el = e.currentTarget;
      setTip((cur) => (cur && cur.el === el ? null : { zone, el }));
    },
  }), [hide]);

  const info = tip && zones[tip.zone];
  return (
    <TipContext.Provider value={tipProps}>
      {children}
      {info && createPortal(
        <div className="sc-tip" ref={tipRef} role="tooltip" style={{ left: pos.left, top: pos.top }}>
          <span className="sc-tip-head">
            <i className={`sc-chip sc-zone-${tip.zone}`} />
            <b>{info.name}</b>
          </span>
          {info.definition}
        </div>,
        document.body
      )}
    </TipContext.Provider>
  );
}
