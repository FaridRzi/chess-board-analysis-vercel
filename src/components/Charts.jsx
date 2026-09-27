import { Fragment, useEffect, useRef, useState } from 'react';

export const pct = (x) => (x == null || !Number.isFinite(x) ? '–' : x > 0 && x < 0.005 ? '<1%' : Math.round(x * 100) + '%');

/** One tooltip per chart; follows the pointer, or sits above a keyboard-focused mark. */
export function useTip() {
  const [tip, setTip] = useState(null);
  const bind = (key, lines) => {
    const show = (e) => {
      let x = e.clientX;
      let y = e.clientY;
      if (!e.type.startsWith('pointer')) {
        const r = e.currentTarget.getBoundingClientRect();
        x = r.left + r.width / 2;
        y = r.top;
      }
      setTip({ key, x, y, lines });
    };
    return { onPointerMove: show, onPointerDown: show, onFocus: show, onPointerLeave: () => setTip(null), onBlur: () => setTip(null) };
  };
  return [tip, bind];
}

export function Tip({ tip }) {
  if (!tip) return null;
  const x = Math.min(Math.max(tip.x, 90), window.innerWidth - 90);
  return (
    <div className="tip" role="tooltip" style={{ left: x, top: tip.y }}>
      {tip.lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}

const R = 56;
const r = 34;
const pt = (rad, a) => `${(rad * Math.cos(a)).toFixed(3)} ${(rad * Math.sin(a)).toFixed(3)}`;
function arc(a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${pt(R, a0)}A${R} ${R} 0 ${large} 1 ${pt(R, a1)}L${pt(r, a1)}A${r} ${r} 0 ${large} 0 ${pt(r, a0)}Z`;
}

/**
 * Donut chart. slices: [{ key, label, value, color }]. Zero slices are skipped.
 * The legend lists every slice with its count and share, so identity never rests on color alone.
 */
export function Pie({ slices, center, sub, label }) {
  const [tip, bind] = useTip();
  const total = slices.reduce((s, x) => s + x.value, 0);
  const shown = slices.filter((s) => s.value > 0);
  let a = -Math.PI / 2;
  const marks = shown.map((s) => {
    const a0 = a;
    a += (s.value / total) * Math.PI * 2;
    return { ...s, a0, a1: a };
  });
  const lines = (s) => [
    <strong>{s.label}</strong>,
    `${s.value} of ${total} games (${pct(s.value / total)})`,
  ];

  return (
    <div className="pie">
      <div className="pie-figure">
        <svg viewBox="-60 -60 120 120" role="img" aria-label={label}>
          {total === 0 && <circle r={(R + r) / 2} className="pie-empty" strokeWidth={R - r} fill="none" />}
          {marks.map((s) => {
            const dim = tip && tip.key !== s.key ? ' dim' : '';
            const props = { className: 'pie-slice' + dim, tabIndex: 0, 'aria-label': `${s.label}: ${s.value}`, ...bind(s.key, lines(s)) };
            return marks.length === 1 ? (
              <circle key={s.key} {...props} r={(R + r) / 2} fill="none" style={{ stroke: s.color }} />
            ) : (
              <path key={s.key} {...props} d={arc(s.a0, s.a1)} fill={s.color} />
            );
          })}
        </svg>
        <div className="pie-center" aria-hidden="true">
          <strong>{center}</strong>
          <span>{sub}</span>
        </div>
      </div>
      <ul className="pie-legend">
        {shown.map((s) => (
          <li key={s.key} className={tip && tip.key !== s.key ? 'dim' : ''}>
            <i className="sw" style={{ background: s.color }} />
            <span className="pl-label">{s.label}</span>
            <span className="pl-n">{s.value}</span>
            <span className="pl-p">{pct(s.value / total)}</span>
          </li>
        ))}
      </ul>
      <Tip tip={tip} />
    </div>
  );
}

const PARTS = [
  { key: 'win', label: 'Won' },
  { key: 'draw', label: 'Drew' },
  { key: 'loss', label: 'Lost' },
];

/** 100%-stacked won/drew/lost bars, one per opponent-rating bucket. */
export function RatingBars({ buckets }) {
  const [tip, bind] = useTip();
  const plot = useRef(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(plot.current);
    return () => ro.disconnect();
  }, []);
  const stride = Math.max(1, Math.ceil((buckets.length * 44) / Math.max(width, 1)));

  const lines = (b, hovered) => [
    <strong>
      Opponents {b.from}–{b.to} · {b.games} game{b.games === 1 ? '' : 's'}
    </strong>,
    ...PARTS.map((p) => (
      <span className={'tip-row' + (p.key === hovered ? ' on' : '')}>
        <i className={'sw ' + p.key} /> {p.label} {b[p.key]} ({pct(b[p.key] / b.games)})
      </span>
    )),
  ];

  return (
    <div className="rbars">
      <div className="rbars-y" aria-hidden="true">
        {[100, 75, 50, 25, 0].map((v) => (
          <span key={v} style={{ bottom: v + '%' }}>
            {v}%
          </span>
        ))}
      </div>
      <div className="rbars-main">
        <div className="rbars-plot" ref={plot}>
          {[0, 25, 50, 75, 100].map((v) => (
            <i key={v} className="grid" style={{ bottom: v + '%' }} />
          ))}
          {buckets.map((b) => (
            <div key={b.from} className="rbar">
              {b.games > 0 &&
                PARTS.map((p) =>
                  b[p.key] ? (
                    <div
                      key={p.key}
                      className={'seg ' + p.key + (tip && tip.key !== b.from + p.key ? ' dim' : '')}
                      style={{ flexGrow: b[p.key] }}
                      tabIndex={0}
                      aria-label={`Opponents ${b.from} to ${b.to}: ${p.label} ${b[p.key]} of ${b.games}`}
                      {...bind(b.from + p.key, lines(b, p.key))}
                    />
                  ) : null
                )}
            </div>
          ))}
        </div>
        <div className="rbars-x" aria-hidden="true">
          {buckets.map((b, i) => (
            <div key={b.from}>
              {i % stride === 0 && (
                <Fragment>
                  <span>{b.from}</span>
                  {stride === 1 && <small>{b.games}</small>}
                </Fragment>
              )}
            </div>
          ))}
        </div>
      </div>
      <Tip tip={tip} />
    </div>
  );
}
