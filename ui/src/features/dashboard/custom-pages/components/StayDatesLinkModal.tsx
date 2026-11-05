import { useEffect, useState } from 'react';

import { Copy } from 'lucide-react';

import {
  absoluteGuestPath,
  guestCalendarPath,
  guestMessagesPath,
} from '@/features/guest/lib/guestPublicPaths';

import { copyGuestLink } from '@/features/dashboard/custom-pages/lib/copyGuestLink';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { dateToString } from '@/utils/format/dates';

import type { DateRange } from 'react-day-picker';

export type StayDatesLinkPage = 'calendar' | 'messages';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertySlug: string;
  pageId: StayDatesLinkPage;
};

const COPY: Record<StayDatesLinkPage, { title: string; description: string; toast: string }> = {
  calendar: {
    title: 'Copy calendar link',
    description: 'Pick stay dates to include in the link.',
    toast: 'Calendar',
  },
  messages: {
    title: 'Copy messages link',
    description: 'Pick the stay dates for this chat.',
    toast: 'Messages',
  },
};

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/** Pick a stay date range, then copy a guest calendar or messages link that keeps those dates. */
export function StayDatesLinkModal({ open, onOpenChange, propertySlug, pageId }: Props) {
  const copy = COPY[pageId];
  const [range, setRange] = useState<DateRange | undefined>();

  useEffect(() => {
    if (!open) setRange(undefined);
  }, [open]);

  const checkIn = range?.from ? dateToString(range.from) : '';
  const checkOut = range?.to ? dateToString(range.to) : '';
  const hasRange = Boolean(checkIn && checkOut);

  const buildPath = () => {
    const params = new URLSearchParams();
    if (hasRange) {
      params.set('checkInDate', checkIn);
      params.set('checkOutDate', checkOut);
    }
    return pageId === 'messages'
      ? guestMessagesPath(propertySlug, params)
      : guestCalendarPath(propertySlug, params);
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{copy.title}</ResponsiveModalTitle>
          <ResponsiveModalDescription>{copy.description}</ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <Calendar
          mode="range"
          selected={range}
          onSelect={setRange}
          numberOfMonths={1}
          weekStartsOn={0}
          disabled={{ before: startOfToday() }}
          className="stay-dates-calendar"
        />

        <ResponsiveModalFooter>
          {pageId === 'calendar' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-[44px]"
              onClick={() =>
                void copyGuestLink(
                  absoluteGuestPath(guestCalendarPath(propertySlug)),
                  copy.toast
                ).then(() => onOpenChange(false))
              }
            >
              Without dates
            </Button>
          ) : null}
          <Button
            type="button"
            variant="default"
            size="sm"
            className="min-h-[44px] gap-1.5"
            disabled={!hasRange}
            onClick={() =>
              void copyGuestLink(absoluteGuestPath(buildPath()), copy.toast).then(() =>
                onOpenChange(false)
              )
            }
          >
            <Copy className="size-3.5" aria-hidden />
            Copy link
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
