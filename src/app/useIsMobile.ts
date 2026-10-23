import { useEffect, useState } from 'react';

const QUERY = '(pointer: coarse) and (max-width: 900px)';

/** Phones get the stripped-down UI: room tabs, info panel and touch controls only. */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

export function useIsTouch(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}
