import { useEffect, useState } from 'react';

import {
  formatParkingBroadcastCountdown,
  parkingBroadcastCountdownA11yLabel,
} from '@/utils/format/parkingStayDisplay';

export type ParkingRequestCountdown = {
  display: string | null;
  minutesLabel: string | null;
  remainingMs: number;
};

export function useParkingRequestCountdown(expiresAt: string | null): ParkingRequestCountdown {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt) {
    return { display: null, minutesLabel: null, remainingMs: 0 };
  }

  const remainingMs = new Date(expiresAt).getTime() - now;
  if (remainingMs <= 0) {
    return { display: null, minutesLabel: null, remainingMs: 0 };
  }

  return {
    display: formatParkingBroadcastCountdown(remainingMs),
    minutesLabel: parkingBroadcastCountdownA11yLabel(remainingMs),
    remainingMs,
  };
}
