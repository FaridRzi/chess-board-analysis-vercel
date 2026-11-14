import { DateTime } from 'luxon';
import { plain } from './Text.jsx';
import { useZoneTip } from './ZoneTip.jsx';
import { fmtClock, fmtDur } from './format.js';

// One real day, midnight to midnight, colored by zone, with the four anchors marked.
// `day` is the start of that day (a Luxon DateTime in the city's zone).
export default function DayBar({ title, profile: p, tz, day, content }) {
  const tipProps = useZoneTip();
  const d = content.days;

  // Hours in this day: 24, or 23 / 25 on a clock-change day.
  const span = day.plus({ days: 1 }).diff(day, 'hours').hours;
  const hoursIn = (ms) => DateTime.fromMillis(ms, { zone: tz }).diff(day, 'hours').hours;

  const edges = [p.SSp, p.MNb, p.SR, p.SN, p.SS, p.MNa, p.SRn].map(hoursIn);
  const zoneOf = ['evening', 'night', 'morning', 'afternoon', 'evening', 'night'];
  const segments = zoneOf
    .map((zone, k) => {
      const a = Math.max(0, edges[k]);
      const b = Math.min(span, edges[k + 1]);
      return b > a ? { zone, left: (a / span) * 100, width: ((b - a) / span) * 100 } : null;
    })
    .filter(Boolean);

  const ticks = [
    [p.SR, d.marks.sunrise],
    [p.SN, d.marks.noon],
    [p.SS, d.marks.sunset],
    [p.MNb, d.marks.midnight],
    [p.MNa, d.marks.midnight],
  ]
    .map(([ms, label]) => ({ ms, label, h: hoursIn(ms) }))
    .filter((t) => t.h >= 0 && t.h <= span)
    .map((t) => {
      const pct = (t.h / span) * 100;
      return { ...t, pct, edge: pct < 7 ? 'sc-edge-l' : pct > 93 ? 'sc-edge-r' : '' };
    });

  const aria = plain(d.barAria, {
    title,
    sunrise: fmtClock(p.SR, tz),
    noon: fmtClock(p.SN, tz),
    sunset: fmtClock(p.SS, tz),
  });

  return (
    <div className="sc-day">
      <div className="sc-day-head">
        <b>{title}</b>
        <span>{plain(d.daylightOf, { duration: fmtDur(p.daylight) })}</span>
      </div>
      <div className="sc-bar" role="img" aria-label={aria}>
        {segments.map((s, i) => (
          <span
            key={i}
            className={`sc-z sc-zone-${s.zone}`}
            style={{ left: `${s.left}%`, width: `${s.width}%` }}
            {...tipProps(s.zone)}
          />
        ))}
      </div>
      <div className="sc-ticks">
        {ticks.map((t, i) => (
          <span key={i} className={`sc-tick ${t.edge}`} style={{ left: `${t.pct}%` }}>
            <b>{t.label}</b>
            <i>{fmtClock(t.ms, tz)}</i>
          </span>
        ))}
      </div>
    </div>
  );
}
