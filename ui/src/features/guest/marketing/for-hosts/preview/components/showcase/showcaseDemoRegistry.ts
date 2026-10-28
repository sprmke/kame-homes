import type { ComponentType } from 'react';

import type { ShowcaseDemoId } from '@/features/guest/marketing/for-hosts/preview/data/hostShowcase';

import {
  BookingsDemo,
  CalendarDemo,
  InboxDemo,
  MarketingDemo,
  MoneyDemo,
  TeamDemo,
} from './ShowcaseDemos';

/** Maps each feature-group id to its browser-bar path and demo panel. */
export const showcaseDemos: Record<ShowcaseDemoId, { path: string; Component: ComponentType }> = {
  bookings: { path: 'app.kamespace.com/…/bookings', Component: BookingsDemo },
  calendar: { path: 'app.kamespace.com/…/calendar', Component: CalendarDemo },
  inbox: { path: 'app.kamespace.com/…/inbox', Component: InboxDemo },
  money: { path: 'app.kamespace.com/…/finance', Component: MoneyDemo },
  marketing: { path: 'app.kamespace.com/…/marketing', Component: MarketingDemo },
  team: { path: 'app.kamespace.com/…/team', Component: TeamDemo },
};
