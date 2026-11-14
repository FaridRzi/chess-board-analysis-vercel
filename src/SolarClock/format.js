import { DateTime, Duration } from 'luxon';

// "07:05:03"
export function fmtDial(r) {
  return Duration.fromObject({ hours: r.hh, minutes: r.mm, seconds: r.ss }).toFormat('hh:mm:ss');
}

// Wall-clock time in a zone: "07:26" or "07:26:41"
export function fmtClock(ms, tz, withSeconds = false) {
  return DateTime.fromMillis(ms, { zone: tz }).toFormat(withSeconds ? 'HH:mm:ss' : 'HH:mm');
}

// "16h 50m"
export function fmtDur(ms) {
  return Duration.fromObject({ minutes: Math.round(ms / 60000) }).shiftTo('hours', 'minutes').toFormat("h'h' mm'm'");
}

// "101 min"
export function fmtMin(ms) {
  return Math.round(ms / 60000) + ' min';
}

// "1 min 41 s" or "42 s"
export function fmtSpan(sec) {
  const d = Duration.fromObject({ seconds: Math.round(sec) }).shiftTo('minutes', 'seconds');
  return d.minutes >= 1 ? d.toFormat("m 'min' s 's'") : d.toFormat("s 's'");
}
