'use client';

import { useSyncExternalStore } from 'react';

/** PC 화면(가로 1024px 이상)인가. 그보다 좁으면 휴대폰 세로 화면용 배치를 쓴다 */
const QUERY = '(min-width: 1024px)';

export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(QUERY);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
}
