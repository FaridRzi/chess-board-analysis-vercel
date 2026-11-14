import Text, { plain } from './Text.jsx';
import DayBar from './DayBar.jsx';
import HoursTable from './HoursTable.jsx';
import { useZoneTip } from './ZoneTip.jsx';
import { ZONE_ORDER } from './solar.js';
import { fmtClock } from './format.js';

// The reading column under the clock. Every word comes from content.js.
export default function Explainer({ content, view, refs, vars }) {
  const tipProps = useZoneTip();
  const { why, equator, anchors, reading, colors, days, source, zones } = content;
  const { r, loc } = view;

  const liveTime = (at) => {
    if (!r) return '';
    const p = r.p;
    const ms = { sunrise: p.SR, noon: p.SN, sunset: p.SS, midnight: p.MNa }[at];
    return fmtClock(ms, loc.tz);
  };

  const columns = refs
    .filter((x) => x.profile)
    .map((x) => ({ key: x.ref.id, name: x.ref.column, date: x.ref.dateLabel, profile: x.profile }));
  if (r) columns.push({ key: 'today', name: days.table.today, date: loc.name, profile: r.p });

  return (
    <article className="sc-explain">
      <section>
        <h2 className="sc-h2">{why.title}</h2>
        {why.paragraphs.map((t, i) => <p className="sc-p" key={i}><Text vars={vars}>{t}</Text></p>)}
      </section>

      <section>
        <h2 className="sc-h2">{equator.title}</h2>
        {equator.paragraphs.map((t, i) => <p className="sc-p" key={i}><Text vars={vars}>{t}</Text></p>)}
      </section>

      <section>
        <h2 className="sc-h2">{anchors.title}</h2>
        <p className="sc-p">{anchors.intro}</p>
        <ol className="sc-anchors">
          {anchors.items.map((item) => (
            <li key={item.at}>
              <span className="sc-a-time" {...tipProps(item.zone)}>
                <i className={`sc-chip sc-zone-${item.zone}`} />
                {item.time}
              </span>
              <div>
                <p className="sc-a-text"><span className="sc-a-name">{item.name}</span> {item.text}</p>
                {r && (
                  <span className="sc-a-live">
                    {plain(item.live, { city: loc.name, time: liveTime(item.at) })}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
        {anchors.paragraphs.map((t, i) => <p className="sc-p" key={i}><Text vars={vars}>{t}</Text></p>)}
      </section>

      <section>
        <h2 className="sc-h2">{reading.title}</h2>
        {reading.paragraphs.map((t, i) => <p className="sc-p" key={i}><Text vars={vars}>{t}</Text></p>)}
      </section>

      <section>
        <h2 className="sc-h2">{colors.title}</h2>
        {colors.paragraphs.map((t, i) => <p className="sc-p" key={i}><Text vars={vars}>{t}</Text></p>)}
        <div className="sc-legend">
          {ZONE_ORDER.map((zone) => (
            <button
              key={zone}
              type="button"
              className="sc-swatch"
              aria-label={`${zones[zone].name}, ${zones[zone].range}. ${zones[zone].definition}`}
              {...tipProps(zone)}
            >
              <i className={`sc-chip sc-chip-lg sc-zone-${zone}`} />
              <span><b>{zones[zone].name}</b><small>{zones[zone].range}</small></span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="sc-h2">{days.title}</h2>
        <p className="sc-p">{days.intro}</p>
        <div className="sc-days">
          {refs.filter((x) => x.profile).map((x) => (
            <DayBar key={x.ref.id} title={x.ref.title} profile={x.profile} tz={x.ref.tz} day={x.day} content={content} />
          ))}
          {r && (
            <DayBar
              title={plain(days.todayTitle, { city: loc.name })}
              profile={r.p} tz={loc.tz} day={r.day} content={content}
            />
          )}
        </div>
        <p className="sc-p">{days.tableIntro}</p>
        <HoursTable content={content} columns={columns} />
      </section>

      <section>
        <h2 className="sc-h2">{source.title}</h2>
        {source.paragraphs.map((t, i) => <p className="sc-p" key={i}><Text vars={vars}>{t}</Text></p>)}
      </section>
    </article>
  );
}
