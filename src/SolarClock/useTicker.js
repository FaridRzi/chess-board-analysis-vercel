import { useEffect, useState } from 'react';

// Current time in milliseconds, refreshed every second.
// It is null on the first render so server rendering and the browser agree.
export function useTicker(intervalMs = 1000) {
  const [ms, setMs] = useState(null);
  useEffect(() => {
    const tick = () => setMs(Date.now());
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return ms;
}
