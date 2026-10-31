import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { PropertyMediaItem } from '@/features/dashboard/marketing/lib/polotno/propertyMedia';

const CalendarPropertyMediaContext = createContext<PropertyMediaItem[]>([]);

export function useCalendarPropertyMedia(): PropertyMediaItem[] {
  return useContext(CalendarPropertyMediaContext);
}

type Props = {
  images: PropertyMediaItem[];
  children: ReactNode;
};

export function CalendarPropertyMediaProvider({ images, children }: Props) {
  const value = useMemo(() => images, [images]);

  return (
    <CalendarPropertyMediaContext.Provider value={value}>
      {children}
    </CalendarPropertyMediaContext.Provider>
  );
}
