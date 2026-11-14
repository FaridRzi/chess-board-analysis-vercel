import { DateTime, Interval } from 'luxon';

// The clock engine. Luxon does the dates and time zones; the only maths of our own
// is the solar-position formula in sunTimesForDate, because Luxon has no astronomy.

export const ZONE_ORDER = ['morning', 'afternoon', 'evening', 'night'];

function normDeg(d) { d = d % 360; return d < 0 ? d + 360 : d; }
function wrapDiff(d) { return ((d + 180) % 360 + 360) % 360 - 180; }

// Sunrise, solar noon and sunset for one calendar day and place (NOAA-style solar position).
// `day` is a Luxon DateTime and only its calendar date is used. Results are in milliseconds.
export function sunTimesForDate(day, lat, lon) {
  const n = DateTime.utc(day.year, day.month, day.day, 12).toMillis() / 86400000 + 2440587.5 - 2451545.0;
  const L = normDeg(280.460 + 0.9856474 * n);
  const g = normDeg(357.528 + 0.9856003 * n);
  const gRad = g * Math.PI / 180;
  const lambda = normDeg(L + 1.915 * Math.sin(gRad) + 0.020 * Math.sin(2 * gRad));
  const epsilon = 23.439 - 0.0000004 * n;
  const lambdaRad = lambda * Math.PI / 180;
  const epsilonRad = epsilon * Math.PI / 180;
  const dec = Math.asin(Math.sin(epsilonRad) * Math.sin(lambdaRad));
  const ra = normDeg(Math.atan2(Math.cos(epsilonRad) * Math.sin(lambdaRad), Math.cos(lambdaRad)) * 180 / Math.PI);
  const eqTime = 4 * wrapDiff(L - ra);
  const solarNoonUTCHours = 12 - lon / 15 - eqTime / 60;
  const latRad = lat * Math.PI / 180;
  const zenith = 90.833 * Math.PI / 180;
  const cosH = (Math.cos(zenith) - Math.sin(latRad) * Math.sin(dec)) / (Math.cos(latRad) * Math.cos(dec));
  const baseMs = DateTime.utc(day.year, day.month, day.day).toMillis();
  const solarNoon = Math.trunc(baseMs + solarNoonUTCHours * 3600000);
  let sunrise = null, sunset = null, polar = null;
  if (cosH >= -1 && cosH <= 1) {
    const Hh = Math.acos(cosH) * 180 / Math.PI / 15;
    sunrise = Math.trunc(baseMs + (solarNoonUTCHours - Hh) * 3600000);
    sunset = Math.trunc(baseMs + (solarNoonUTCHours + Hh) * 3600000);
  } else {
    polar = cosH < -1 ? 'always-day' : 'always-night';
  }
  return { sunrise, solarNoon, sunset, polar };
}

// The seven moments around one day, plus how long one dial hour lasts in each stretch.
// `day` is the start of a local day as a Luxon DateTime in the city's zone.
export function dayProfile(day, lat, lon) {
  const T = sunTimesForDate(day, lat, lon);
  const P = sunTimesForDate(day.minus({ days: 1 }), lat, lon);
  const N = sunTimesForDate(day.plus({ days: 1 }), lat, lon);
  if (!T.sunrise || !T.sunset || !P.sunrise || !P.sunset || !N.sunrise) return null;
  const SSp = P.sunset, SR = T.sunrise, SN = T.solarNoon, SS = T.sunset, SRn = N.sunrise;
  const MNb = (SSp + SR) / 2, MNa = (SS + SRn) / 2;
  return {
    prevSR: P.sunrise, prevSN: P.solarNoon,
    SSp, MNb, SR, SN, SS, MNa, SRn,
    daylight: SS - SR,
    hour: {
      morning: (SN - SR) / 5,
      afternoon: (SS - SN) / 7,
      evening: (MNa - SS) / 5,
      night: (SRn - MNa) / 7,
    },
  };
}

// `now` is a Luxon DateTime already set to the city's zone.
export function computeSolarClock(now, lat, lon) {
  const day = now.startOf('day');
  const p = dayProfile(day, lat, lon);
  if (!p) return { error: true, polar: sunTimesForDate(day, lat, lon).polar };
  const t = now.toMillis();
  // The cycle in progress runs from one sunrise to the next.
  const c = t >= p.SR
    ? { SR: p.SR,     SN: p.SN,     SS: p.SS,  MN: p.MNa, END: p.SRn }
    : { SR: p.prevSR, SN: p.prevSN, SS: p.SSp, MN: p.MNb, END: p.SR };
  const stretch = (a, b) => Interval.fromDateTimes(DateTime.fromMillis(a), DateTime.fromMillis(b));
  const zones = [
    { zone: 'morning',   span: stretch(c.SR, c.SN),  first: 7,  count: 5, ampm: 'AM' },
    { zone: 'afternoon', span: stretch(c.SN, c.SS),  first: 12, count: 7, ampm: 'PM' },
    { zone: 'evening',   span: stretch(c.SS, c.MN),  first: 7,  count: 5, ampm: 'PM' },
    { zone: 'night',     span: stretch(c.MN, c.END), first: 12, count: 7, ampm: 'AM' },
  ];
  const z = zones.find(q => q.span.contains(now)) || zones[3];
  const total = z.span.length();
  const f = Math.min(Math.max(now.diff(z.span.start).as('milliseconds') / total, 0), 1 - 1e-9);
  const elapsed = f * z.count;
  const hourOffset = Math.floor(elapsed);
  const hh = z.first === 7 ? 7 + hourOffset : (hourOffset === 0 ? 12 : hourOffset);
  const minutesFloat = (elapsed - hourOffset) * 60;
  const mm = Math.floor(minutesFloat);
  const ss = Math.floor((minutesFloat - mm) * 60);
  return { error: false, hh, mm, ss, ampm: z.ampm, zone: z.zone, hourMs: total / z.count, cycle: c, p, day };
}
