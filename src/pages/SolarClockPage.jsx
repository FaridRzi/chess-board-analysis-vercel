import SolarClock from '../SolarClock';

export function SunIcon({ size = 22 }) {
  return (
    <svg className="logo sun-icon" viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <rect width="40" height="40" rx="8" fill="#0A0E1B" />
      <path d="M6 27h28" stroke="#6F7FD0" strokeWidth="2" strokeLinecap="round" />
      <path d="M11 27a9 9 0 0 1 18 0" fill="#F4D06F" />
      <path d="M20 9v3M9.4 13.4l2.1 2.1M30.6 13.4l-2.1 2.1" stroke="#EE9150" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function SolarClockPage({ active }) {
  return (
    <div className="page solar-page" hidden={!active}>
      <SolarClock />
    </div>
  );
}
