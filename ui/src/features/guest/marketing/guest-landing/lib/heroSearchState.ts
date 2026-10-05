import { format } from 'date-fns';

import {
  HERO_SEARCH_SINGLE_MONTH_PANEL_WIDTH,
  heroSearchWhenPanelWidth,
} from '@/features/guest/marketing/guest-landing/lib/heroSearchCalendarClassNames';

import type { DateRange } from 'react-day-picker';

/** Pure state helpers for HeroSearch: URL parsing, display formatting, dropdown layout. */

export type SearchField = 'where' | 'when' | 'who';

export interface HeroSearchValues {
  location: string;
  checkIn: string;
  checkOut: string;
  guests: string;
}

export interface GuestCounts {
  adults: number;
  children: number;
  infants: number;
  pets: number;
}

export interface DropdownLayout {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function estimatedPanelHeight(field: SearchField, calendarMonths: number) {
  switch (field) {
    case 'where':
      return 380;
    case 'when':
      return calendarMonths === 2 ? 450 : 460;
    case 'who':
      return 320;
    default:
      return 360;
  }
}

export function parseDateParam(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const parsed = new Date(`${raw}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function parseGuestsParam(raw: string | null): GuestCounts {
  const total = Number.parseInt(raw ?? '', 10);
  if (Number.isNaN(total) || total < 1) {
    return { adults: 2, children: 0, infants: 0, pets: 0 };
  }
  return { adults: total, children: 0, infants: 0, pets: 0 };
}

export function parseGuestBreakdown(sp: URLSearchParams): GuestCounts {
  const hasBreakdown = sp.has('adults') || sp.has('children') || sp.has('pets');
  if (hasBreakdown) {
    const adults = Number.parseInt(sp.get('adults') ?? '', 10);
    const children = Number.parseInt(sp.get('children') ?? '', 10);
    const pets = Number.parseInt(sp.get('pets') ?? '', 10);
    return {
      adults: Number.isFinite(adults) && adults >= 0 ? Math.max(adults, 1) : 1,
      children: Number.isFinite(children) && children >= 0 ? children : 0,
      infants: 0,
      pets: Number.isFinite(pets) && pets >= 0 ? pets : 0,
    };
  }
  return parseGuestsParam(sp.get('guests'));
}

export function readWhereParam(sp: URLSearchParams, fallback = ''): string {
  return (sp.get('where') ?? sp.get('location') ?? fallback).trim() || fallback;
}

export function buildSearchValues(
  location: string,
  dateRange: DateRange | undefined,
  guests: GuestCounts
): HeroSearchValues {
  const guestTotal = guests.adults + guests.children;
  return {
    location: location.trim(),
    checkIn: toIsoDate(dateRange?.from),
    checkOut: toIsoDate(dateRange?.to),
    guests: guestTotal > 0 ? String(guestTotal) : '',
  };
}

export function formatGuestSummary(counts: GuestCounts) {
  const guestCount = counts.adults + counts.children;
  if (guestCount === 0 && counts.pets === 0) return '';
  const parts: string[] = [];
  if (guestCount > 0) parts.push(`${guestCount} guest${guestCount === 1 ? '' : 's'}`);
  if (counts.pets > 0) parts.push(`${counts.pets} pet${counts.pets === 1 ? '' : 's'}`);
  return parts.join(', ');
}

export function formatGuestSummaryCompact(counts: GuestCounts) {
  const guestCount = counts.adults + counts.children;
  if (guestCount > 0) return String(guestCount);
  if (counts.pets > 0) return `${counts.pets} pet`;
  return '';
}

export function formatDateRange(range: DateRange | undefined) {
  if (!range?.from) return '';
  if (!range.to) return format(range.from, 'MMM d');
  return `${format(range.from, 'MMM d')} – ${format(range.to, 'MMM d')}`;
}

export function toIsoDate(date: Date | undefined) {
  if (!date) return '';
  return format(date, 'yyyy-MM-dd');
}

export function preferredPanelWidth(field: SearchField, rootWidth: number, calendarMonths: number) {
  const isMobile = rootWidth < 640;
  if (isMobile) return rootWidth;

  switch (field) {
    case 'where':
      return HERO_SEARCH_SINGLE_MONTH_PANEL_WIDTH;
    case 'when':
      return heroSearchWhenPanelWidth(calendarMonths === 2 ? 2 : 1, rootWidth);
    case 'who':
      return 380;
    default:
      return rootWidth;
  }
}

export function computeDropdownLayout(
  field: SearchField,
  rootEl: HTMLElement,
  barEl: HTMLElement,
  segmentEl: HTMLElement,
  calendarMonths: number,
  contentHeight: number
): DropdownLayout {
  const rootRect = rootEl.getBoundingClientRect();
  const barRect = barEl.getBoundingClientRect();
  const segmentRect = segmentEl.getBoundingClientRect();
  const rootWidth = rootRect.width;
  const width = preferredPanelWidth(field, rootWidth, calendarMonths);
  const isMobile = rootWidth < 640;

  let left = 0;
  if (!isMobile) {
    const segmentLeft = segmentRect.left - rootRect.left;
    const segmentCenter = segmentLeft + segmentRect.width / 2;

    if (field === 'where') {
      left = segmentLeft;
    } else if (field === 'when') {
      left = segmentCenter - width / 2;
    } else {
      left = segmentRect.right - rootRect.left - width;
    }

    left = Math.max(0, Math.min(left, rootWidth - width));
  }

  const top = barRect.bottom - rootRect.top + 12;

  return {
    left,
    top,
    width,
    height: contentHeight,
  };
}
