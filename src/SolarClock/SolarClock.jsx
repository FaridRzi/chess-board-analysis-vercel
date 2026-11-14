import { useMemo, useState } from 'react';
import { DateTime, IANAZone } from 'luxon';
import defaultContent from './content.js';
import { cities as defaultCities, referenceDays as defaultReferenceDays } from './cities.js';
import { computeSolarClock, dayProfile } from './solar.js';
import { fmtDial, fmtDur, fmtSpan } from './format.js';
import { useTicker } from './useTicker.js';
import { ZoneTipProvider } from './ZoneTip.jsx';
import ClockFace from './ClockFace.jsx';
import Explainer from './Explainer.jsx';
import './solar-clock.css';

function resolveLocation(cityKey, cities, custom, content) {
  if (cityKey !== 'custom') {
    const city = cities[cityKey];
    return city ? { name: city.name, lat: city.lat, lon: city.lon, tz: city.tz } : { error: 'needCoordinates' };
  }
  const lat = parseFloat(custom.lat);
  const lon = parseFloat(custom.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return { error: 'needCoordinates' };
  const tz = custom.tz.trim() || 'UTC';
  if (!IANAZone.isValidZone(tz)) return { error: 'badTimeZone' };
  return { name: content.clock.customName, lat, lon, tz };
}

/**
 * <SolarClock />
 *
 * Props (all optional):
 *   content          the text. Defaults to ./content.js
 *   cities           the city picker list. Defaults to ./cities.js
 *   referenceDays    the example days. Defaults to ./cities.js
 *   initialCity      key of the city shown first (default "berlin")
 *   className        extra class on the outer element
 */
export default function SolarClock({
  content = defaultContent,
  cities = defaultCities,
  referenceDays = defaultReferenceDays,
  initialCity = 'berlin',
  className = '',
}) {
  const firstCity = initialCity in cities ? initialCity : Object.keys(cities)[0];
  const [cityKey, setCityKey] = useState(firstCity);
  const [custom, setCustom] = useState({ lat: '', lon: '', tz: '' });
  const nowMs = useTicker();
  const [year] = useState(() => DateTime.now().year);

  const loc = useMemo(() => resolveLocation(cityKey, cities, custom, content), [cityKey, cities, custom, content]);

  // Where the clock stands right now.
  const view = useMemo(() => {
    if (loc.error) return { message: content.clock[loc.error] };
    if (nowMs === null) return { loc };
    const now = DateTime.fromMillis(nowMs, { zone: loc.tz });
    const r = computeSolarClock(now, loc.lat, loc.lon);
    if (r.error) {
      return { loc, now, message: r.polar === 'always-night' ? content.clock.noSunrise : content.clock.noSunset };
    }
    return { loc, now, r };
  }, [nowMs, loc, content]);

  // The fixed example days. They do not change while the page is open.
  const refs = useMemo(() => referenceDays.map((ref) => {
    const day = DateTime.fromObject({ year, month: ref.month, day: ref.day }, { zone: ref.tz });
    return { ref, day, profile: dayProfile(day, ref.lat, ref.lon) };
  }), [referenceDays, year]);

  // Values for the {placeholders} used in the explanation text.
  const daylightOf = (id) => {
    const found = refs.find((x) => x.ref.id === id);
    return found && found.profile ? fmtDur(found.profile.daylight) : '';
  };
  const { r } = view;
  const vars = {
    juneDaylight: daylightOf('berlin-june'),
    decDaylight: daylightOf('berlin-dec'),
    dialTime: r ? `${fmtDial(r)} ${r.ampm}` : '--',
    hourMinutes: r ? Math.round(r.hourMs / 60000) : '--',
    minuteLength: r ? fmtSpan(r.hourMs / 60000) : '--',
  };

  return (
    <div
      className={`sc-root ${className}`.trim()}
      style={r ? { '--sc-accent': `var(--sc-${r.zone})` } : undefined}
    >
      <ZoneTipProvider zones={content.zones}>
        <ClockFace
          content={content}
          cities={cities}
          cityKey={cityKey}
          onCityChange={setCityKey}
          custom={custom}
          onCustomChange={setCustom}
          view={view}
        />
        <Explainer content={content} view={view} refs={refs} vars={vars} />
      </ZoneTipProvider>
    </div>
  );
}
