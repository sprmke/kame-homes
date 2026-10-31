import { useMemo } from 'react';

import { useSearchParams } from 'react-router-dom';

import { parseISO } from 'date-fns';

import { GuestStayDateRangeDisplay } from '@/features/guest/property/components/GuestStayDateRangeDisplay';

import { cn } from '@/lib/utils';
import { normalizeDateString } from '@/utils/format/dates';

type GuestStayContextBarProps = {
  checkInDate?: string | null;
  checkOutDate?: string | null;
  onClear?: () => void;
  width?: 'constrained' | 'full';
  density?: 'default' | 'compact';
  className?: string;
};

function parseStayDate(raw: string | null | undefined): Date | null {
  const normalized = normalizeDateString(raw?.trim() ?? '');
  if (!normalized) return null;
  try {
    return parseISO(normalized);
  } catch {
    return null;
  }
}

/** Compact stay dates when check-in/out are known (URL or calendar selection). */
export function GuestStayContextBar({
  checkInDate,
  checkOutDate,
  onClear,
  width = 'constrained',
  density = 'default',
  className,
}: GuestStayContextBarProps) {
  const [searchParams] = useSearchParams();
  const checkIn = useMemo(
    () => parseStayDate(checkInDate ?? searchParams.get('checkInDate')),
    [checkInDate, searchParams]
  );
  const checkOut = useMemo(
    () => parseStayDate(checkOutDate ?? searchParams.get('checkOutDate')),
    [checkOutDate, searchParams]
  );

  if (!checkIn || !checkOut) return null;

  return (
    <GuestStayDateRangeDisplay
      checkIn={checkIn}
      checkOut={checkOut}
      onClear={onClear}
      width={width}
      density={density}
      className={cn(className)}
    />
  );
}
