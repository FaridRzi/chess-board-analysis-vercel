// Places and example days. Edit freely.
//
// cities: what appears in the city picker. The key (berlin, tehran, ...) is only an id.
//   name  shown in the picker
//   lat / lon  decimal degrees (south and west are negative)
//   tz    an IANA time zone name, e.g. "Europe/Berlin"
export const cities = {
  berlin:      { name: 'Berlin',       lat: 52.5200, lon: 13.4050,   tz: 'Europe/Berlin' },
  tehran:      { name: 'Tehran',       lat: 35.6892, lon: 51.3890,   tz: 'Asia/Tehran' },
  london:      { name: 'London',       lat: 51.5074, lon: -0.1278,   tz: 'Europe/London' },
  newyork:     { name: 'New York',     lat: 40.7128, lon: -74.0060,  tz: 'America/New_York' },
  tokyo:       { name: 'Tokyo',        lat: 35.6762, lon: 139.6503,  tz: 'Asia/Tokyo' },
  dubai:       { name: 'Dubai',        lat: 25.2048, lon: 55.2708,   tz: 'Asia/Dubai' },
  kualalumpur: { name: 'Kuala Lumpur', lat: 3.1390,  lon: 101.6869,  tz: 'Asia/Kuala_Lumpur' },
};

// referenceDays: the fixed days compared in "The same dial on different days".
//   title      heading above the bar
//   column     city name at the top of the table column
//   dateLabel  short date under it
//   month, day the calendar day (the current year is used)
//
// The two Berlin ids below feed the {juneDaylight} and {decDaylight} placeholders in content.js,
// so keep an entry with id "berlin-june" and one with id "berlin-dec" if you use those placeholders.
export const referenceDays = [
  { id: 'equator-june', title: 'Equator (Quito), 21 June', column: 'Equator', dateLabel: '21 Jun', month: 6,  day: 21, lat: -0.1807, lon: -78.4678, tz: 'America/Guayaquil' },
  { id: 'berlin-june',  title: 'Berlin, 21 June',          column: 'Berlin',  dateLabel: '21 Jun', month: 6,  day: 21, lat: 52.52,   lon: 13.405,   tz: 'Europe/Berlin' },
  { id: 'berlin-dec',   title: 'Berlin, 21 December',      column: 'Berlin',  dateLabel: '21 Dec', month: 12, day: 21, lat: 52.52,   lon: 13.405,   tz: 'Europe/Berlin' },
];
