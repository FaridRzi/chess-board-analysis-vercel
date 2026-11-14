import { useId } from 'react';
import Text from './Text.jsx';
import Arc from './Arc.jsx';
import { useZoneTip } from './ZoneTip.jsx';
import { fmtDial } from './format.js';

// The top of the component: city picker, the time, the zone name and the cycle strip.
export default function ClockFace({ content, cities, cityKey, onCityChange, custom, onCustomChange, view }) {
  const id = useId();
  const tipProps = useZoneTip();
  const c = content.clock;
  const { r, now, loc, message } = view;

  const zoneButton = r && (
    <button type="button" className="sc-zone-name" {...tipProps(r.zone)}>
      {content.zones[r.zone].name}
    </button>
  );

  return (
    <header className="sc-clock">
      <div className="sc-city-row">
        <label htmlFor={`${id}-city`}>{c.cityLabel}</label>
        <select id={`${id}-city`} value={cityKey} onChange={(e) => onCityChange(e.target.value)}>
          {Object.entries(cities).map(([key, city]) => (
            <option key={key} value={key}>{city.name}</option>
          ))}
          <option value="custom">{c.customCity}</option>
        </select>
        {cityKey === 'custom' && (
          <span className="sc-custom">
            <input
              id={`${id}-lat`} type="text" inputMode="decimal"
              placeholder={c.latitude} aria-label={c.latitude}
              value={custom.lat} onChange={(e) => onCustomChange({ ...custom, lat: e.target.value })}
            />
            <input
              id={`${id}-lon`} type="text" inputMode="decimal"
              placeholder={c.longitude} aria-label={c.longitude}
              value={custom.lon} onChange={(e) => onCustomChange({ ...custom, lon: e.target.value })}
            />
            <input
              id={`${id}-tz`} type="text" className="sc-tz"
              placeholder={c.timeZone} aria-label={c.timeZone}
              value={custom.tz} onChange={(e) => onCustomChange({ ...custom, tz: e.target.value })}
            />
          </span>
        )}
      </div>

      <div className="sc-time">
        <span>{r ? fmtDial(r) : '--:--:--'}</span>
        <span className="sc-ampm">{r ? r.ampm : ''}</span>
      </div>

      <p className="sc-where">
        {r
          ? <Text vars={{ zone: zoneButton, minutes: Math.round(r.hourMs / 60000) }}>{c.hourLength}</Text>
          : (message || ' ')}
      </p>
      <p className="sc-real">
        {r
          ? <Text vars={{ time: now.toFormat('HH:mm:ss'), timeZone: loc.tz.replace('_', ' ') }}>{c.wallClock}</Text>
          : ' '}
      </p>

      {r && <Arc cycle={r.cycle} nowMs={now.toMillis()} content={content} />}
      {r && <p className="sc-arc-note">{c.arcNote}</p>}
    </header>
  );
}
