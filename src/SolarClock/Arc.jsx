import { useZoneTip } from './ZoneTip.jsx';

// The strip under the time: one full cycle, sunrise to sunrise, with a dot for now.
export default function Arc({ cycle: c, nowMs, content }) {
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
    [c.SR, marks.sunrise, 'sc-l'],
    [c.SN, marks.noon, ''],
    [c.SS, marks.sunset, ''],
    [c.MN, marks.midnight, ''],
    [c.END, marks.sunrise, 'sc-r'],
  ];

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
        {labels.map(([ms, label, cls], i) => (
          <span key={i} className={cls} style={{ left: `${pct(ms)}%` }}>{label}</span>
        ))}
      </div>
    </div>
  );
}
