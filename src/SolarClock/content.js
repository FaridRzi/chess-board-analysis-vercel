// =====================================================================
//  SOLAR CLOCK: ALL THE TEXT LIVES IN THIS FILE
// =====================================================================
//  Change any words between the quote marks. Nothing else needs touching.
//
//  Two small tricks you can use inside any text:
//    {name}     is replaced by a live value. Only use the placeholders that already
//               appear in that same text, for example {city} or {juneDaylight}.
//    **words**  makes the words bold.
//
//  Rules to keep the file working:
//    - Keep every line ending in a comma.
//    - Keep the text inside quote marks. To use an apostrophe inside 'single quotes',
//      write it as \'  or switch that one text to "double quotes".
//    - The words before the colon (the keys) are names the code looks up. Do not rename them.
//
//  Places and the example days live in cities.js.
// =====================================================================

const content = {
  // ---------------------------------------------------------------
  //  The clock at the top
  // ---------------------------------------------------------------
  clock: {
    cityLabel: 'City',
    customCity: 'Your own place',
    customName: 'your place',        // used in sentences such as "Today in your place: 07:26"
    latitude: 'Latitude',
    longitude: 'Longitude',
    timeZone: 'Time zone, e.g. Europe/Berlin',

    // {zone} is the colored zone name (hover it for its definition), {minutes} the real minutes in one dial hour.
    hourLength: '{zone}. Each hour lasts {minutes} real minutes right now.',
    // {time} is the normal clock time, {timeZone} the zone name.
    wallClock: 'Wall clock {time} in {timeZone}',

    arcAria: 'One full cycle from one sunrise to the next, split into morning, afternoon, evening and night',
    arcNote: 'One full cycle, sunrise to sunrise. The white dot is now.',
    arcMarks: {
      sunrise: '6 AM',
      noon: '12 PM',
      sunset: '6 PM',
      midnight: '12 AM',
    },
    // Shown when you hover or tap a label under the strip. {time} is the wall-clock time in the city.
    arcTips: {
      sunrise: 'Sunrise at {time}',
      noon: 'Solar noon at {time}',
      sunset: 'Sunset at {time}',
      midnight: 'Middle of the night at {time}',
      yesterday: '{time} yesterday',
      tomorrow: '{time} tomorrow',
    },

    // Messages shown instead of the time
    needCoordinates: 'Enter a latitude and longitude to start.',
    badTimeZone: 'Time zone not recognised. Use a name like Europe/Berlin.',
    noSunrise: 'The sun does not rise here today.',
    noSunset: 'The sun does not set here today.',
  },

  // ---------------------------------------------------------------
  //  The four colors. The definition shows when you hover (or tap) a color.
  // ---------------------------------------------------------------
  zones: {
    morning: {
      name: 'Morning',
      range: '6AM to 12PM',
      definition: 'From sunrise at 6AM to the sun at its highest at 12PM. The light is building. Six dial hours.',
    },
    afternoon: {
      name: 'Afternoon',
      range: '12PM to 6PM',
      definition: 'From the sun at its highest at 12PM to sunset at 6PM. The light is fading. Six dial hours.',
    },
    evening: {
      name: 'Evening',
      range: '6PM to 12AM',
      definition: 'From sunset at 6PM to the middle of the darkness at 12AM. The light is gone and the night is deepening. Six dial hours.',
    },
    night: {
      name: 'Night',
      range: '12AM to 6AM',
      definition: 'From the middle of the darkness at 12AM to sunrise at 6AM. The darkness is thinning toward the next sunrise. Six dial hours.',
    },
  },

  // ---------------------------------------------------------------
  //  The explanation under the clock. Each section is a title and paragraphs.
  // ---------------------------------------------------------------
  why: {
    title: 'Why I built this clock',
    paragraphs: [
      'In Berlin, daylight changes a lot through the year. However, my body clock mostly follows the sun, the moon and the sky, not a contractual number. This clock helps me understand my body clock more efficiently.',
      'It shows where I am in the cycle of light and dark, depending on the season and I can plan my sleeps better (the regular time is shown right under it).',
    ],
  },

  equator: {
    title: 'The reference: the equator',
    paragraphs: [
      'On the equator, since the sun is directly overhead all year long, a day could be broken into 4 equal parts. Moreover, the sunrise usually is at 6AM, sun is in the middle of the sky at 12PM, sunset happens at 6PM and exactly middleo of the night\'s darkness is at 12AM.',
      'In other words, we assume a day is 12 hours of light and 12 hours of darkness, and the four anchors are at 6AM, 12PM, 6PM and 12AM (morning, afternoon, evening, night corresponding).',
    ],
  },

  anchors: {
    title: 'Four anchors',
    intro: 'The clock is pinned to four moments, read from the sun in the city I pick.',
    // zone = which color it uses. at = which moment it is (sunrise, noon, sunset or midnight).
    // live = the line under it with the real time today. {city} and {time} are filled in.
    items: [
      { zone: 'morning',   time: '6AM',  at: 'sunrise',  name: 'Sunrise.',  text: 'The first light of the sun appears.',               live: 'Today in {city}: {time}' },
      { zone: 'afternoon', time: '12PM', at: 'noon',     name: 'Noon.',     text: 'The sun is in the middle of the sky.',                                        live: 'Today in {city}: {time}' },
      { zone: 'evening',   time: '6PM',  at: 'sunset',   name: 'Sunset.',   text: 'The last light of the sun is gone.',                                          live: 'Today in {city}: {time}' },
      { zone: 'night',     time: '12AM', at: 'midnight', name: 'Midnight.', text: 'The exact middle point between the start and the end of the darkness.',        live: 'Tonight in {city}: {time}' },
    ],
    // {juneDaylight} and {decDaylight} are Berlin's daylight on 21 June and 21 December.
    paragraphs: [
      'Whatever time lies between two anchors is split equally into the hours that sit there. Each quarter of the cycle is always 6 dial hours long, but the real time inside them changes with the seasons. The dial is pinned to the four anchors, so it always shows the same four moments of the day, no matter how long or short they are in real time.',
      'So the dial always holds 12 hours of day and 12 hours of night, but the real time inside them changes with the seasons. On 21 June, Berlin has **{juneDaylight}** of daylight, so the day hours run long and the night hours run short. On 21 December it flips: **{decDaylight}** of daylight and long night hours.',
    ],
  },

  reading: {
    title: 'Reading HH:MM:SS',
    // {dialTime} is the dial time right now, {hourMinutes} the real minutes in this hour,
    // {minuteLength} the real length of one dial minute.
    paragraphs: [
      'HH is the hour of the day. MM is how many minutes of that hour have passed, and SS is how many seconds of that minute. Every dial hour has 60 minutes and every dial minute has 60 seconds, however long the hour lasts in real time.',
      'Right now it reads **{dialTime}**. This hour lasts **{hourMinutes}** real minutes, so one dial minute lasts **{minuteLength}**.',
    ],
  },

  colors: {
    title: 'What the colors mean',
    paragraphs: [
      'Each color is one stretch of the cycle. It changes at the four anchors, not at fixed clock times. The AM/PM mark, the zone name under the time and the strip use the color of the stretch I am in.',
      'Hover over a color to read its definition. On a phone, tap it.',
    ],
  },

  days: {
    title: 'The same dial on different days',
    intro: 'Each bar is one real day, midnight to midnight. The labels show where the anchors fall on the normal clock: the dial reading on top, the wall-clock time below it.',
    todayTitle: 'Today, {city}',
    daylightOf: '{duration} of daylight',     // {duration} looks like 16h 50m
    barAria: '{title}: sunrise {sunrise}, noon {noon}, sunset {sunset}',
    marks: { sunrise: '6AM', noon: '12PM', sunset: '6PM', midnight: '12AM' },
    tableIntro: 'How long one dial hour lasts, in real minutes:',
    table: {
      daylight: 'Daylight',
      hourRow: 'Hour, {range}',
      today: 'Today',
    },
  },

  source: {
    title: 'Where the sun data comes from',
    paragraphs: [
      'No sun data is downloaded. The page calculates sunrise, solar noon and sunset on your device from the city\'s latitude and longitude and today\'s date, and it reads the current time from your device clock. The Luxon library handles time zones, date arithmetic and formatting.',
    ],
  },
};

export default content;
