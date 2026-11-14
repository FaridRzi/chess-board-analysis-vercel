import { plain } from './Text.jsx';
import { useZoneTip } from './ZoneTip.jsx';
import { ZONE_ORDER } from './solar.js';
import { fmtDur, fmtMin } from './format.js';

// How long one dial hour lasts, in real minutes, for each day being compared.
// columns: [{ key, name, date, profile }]
export default function HoursTable({ content, columns }) {
  const tipProps = useZoneTip();
  const t = content.days.table;

  const rows = [
    { key: 'daylight', label: t.daylight, cell: (p) => fmtDur(p.daylight) },
    ...ZONE_ORDER.map((zone) => ({
      key: zone,
      zone,
      label: plain(t.hourRow, { range: content.zones[zone].range }),
      cell: (p) => fmtMin(p.hour[zone]),
    })),
  ];

  return (
    <div className="sc-tablewrap">
      <table className="sc-table">
        <thead>
          <tr>
            <th />
            {columns.map((col) => (
              <th key={col.key} scope="col">{col.name}<br />{col.date}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">
                {row.zone && <i className={`sc-chip sc-zone-${row.zone}`} {...tipProps(row.zone)} />}
                {row.label}
              </th>
              {columns.map((col) => <td key={col.key}>{row.cell(col.profile)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
