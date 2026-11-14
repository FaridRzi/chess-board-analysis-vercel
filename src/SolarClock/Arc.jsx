import { DateTime } from 'luxon';
import { useZoneTip } from './ZoneTip.jsx';
import { plain } from './Text.jsx';
import { fmtClock } from './format.js';

// The strip under the time: one full cycle, sunrise to sunrise, with a dot for now.
export default function Arc({ cycle: c, nowMs, tz, content }) {
  const tipProps = useZoneTip();
  const total = c.END - c.SR;
  const pct = (ms) => ((ms - c.SR) / total) * 100;
  const marks = content.clock.arcMarks;

  const segments = [
    [c.SR, c.SN, 'morning'],
    [c.SN, c.SS, 'afternoon'],
    [c.SS, c.MN, 'evening'],
    [c.MN, c.END, 'night'],
  ];
  const labels = [
    [c.SR, marks.sunrise, 'sunrise', 'sc-l'],
    [c.SN, marks.noon, 'noon', ''],
    [c.SS, marks.sunset, 'sunset', ''],
    [c.MN, marks.midnight, 'midnight', ''],
    [c.END, marks.sunrise, 'sunrise', 'sc-r'],
  ];

  // "Sunset at 16:31", with "yesterday" or "tomorrow" when the anchor is on another calendar day.
  const tips = content.clock.arcTips;
  const today = DateTime.fromMillis(nowMs, { zone: tz }).startOf('day');
  const tipFor = (ms, anchor) => {
    const days = Math.round(DateTime.fromMillis(ms, { zone: tz }).startOf('day').diff(today, 'days').days);
    let time = fmtClock(ms, tz);
    if (days < 0) time = plain(tips.yesterday, { time });
    if (days > 0) time = plain(tips.tomorrow, { time });
    return plain(tips[anchor], { time });
  };

  return (
    <div className="sc-arc">
      <div className="sc-arc-track" role="img" aria-label={content.clock.arcAria}>
        {segments.map(([a, b, zone]) => (
          <span
            key={zone}
            className={`sc-arc-seg sc-zone-${zone}`}
            style={{ left: `${pct(a)}%`, width: `${pct(b) - pct(a)}%` }}
            {...tipProps(zone)}
          />
        ))}
      </div>
      <div className="sc-arc-dot" style={{ left: `${pct(nowMs)}%` }} />
      <div className="sc-arc-labels">
        {labels.map(([ms, label, anchor, cls], i) => {
          const tip = tipFor(ms, anchor);
          return (
            <span
              key={i}
              className={`sc-arc-mark ${cls}`.trim()}
              style={{ left: `${pct(ms)}%` }}
              tabIndex={0}
              data-tip={tip}
              aria-label={`${label}: ${tip}`}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
