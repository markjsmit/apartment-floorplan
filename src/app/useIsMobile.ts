import { PHONE_QUERY as QUERY } from '../scene/clickAction';
import { useEffect, useState } from 'react';


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
