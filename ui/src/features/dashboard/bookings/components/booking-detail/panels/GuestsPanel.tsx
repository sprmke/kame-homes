import { Mail, Phone, UserRound, Users } from 'lucide-react';

import { requiresValidId } from '@/features/guest/form/lib/guestCounts';

import { DocPreview } from '@/features/dashboard/bookings/components/booking-detail/BookingDocPreview';
import { BookingDetailCard } from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailCard';
import {
  BookingDetailRow,
  BookingDetailRowGroup,
} from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailRow';
import { receiptAiPreviewLoading } from '@/features/dashboard/bookings/hooks/useReceiptAiBackfill';
import {
  ADMIN_GUEST_VIEW_SLOTS,
  shouldShowAdminGuestViewSlot,
} from '@/features/dashboard/bookings/lib/adminGuestSlots';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { cn } from '@/lib/utils';

type PreviewHandler = (label: string, rawUrl: string) => void;

function ContactLine({
  icon: Icon,
  value,
  href,
}: {
  icon: typeof Mail;
  value: string;
  href?: string;
}) {
  const content = (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium">
      <Icon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 break-all">{value}</span>
    </span>
  );
  if (!href) return content;
  return (
    <a href={href} className="text-foreground hover:text-primary min-w-0 transition-colors">
      {content}
    </a>
  );
}

export function GuestsPanel({
  booking,
  onPreview,
  isDocumentAiBackfilling = false,
}: {
  booking: BookingRow;
  onPreview: PreviewHandler;
  isDocumentAiBackfilling?: boolean;
}) {
  const visibleSlots = ADMIN_GUEST_VIEW_SLOTS.filter((slot) =>
    shouldShowAdminGuestViewSlot(slot, booking)
  );
  const email = booking.guest_email?.trim();
  const phone = booking.guest_phone_number?.trim();
  const address = booking.guest_address?.trim();
  const nationality = booking.nationality?.trim();
  const displayName = booking.guest_facebook_name?.trim();
  const hasContact = Boolean(email || phone || address || nationality || displayName);

  return (
    <div className="space-y-4">
      {hasContact ? (
        <BookingDetailCard title="Primary Guest" icon={UserRound}>
          <BookingDetailRowGroup>
            {displayName ? <BookingDetailRow label="Display name" value={displayName} /> : null}
            {email ? (
              <BookingDetailRow label="Email">
                <span className="flex min-w-0 justify-end sm:max-w-[68%]">
                  <ContactLine icon={Mail} value={email} href={`mailto:${email}`} />
                </span>
              </BookingDetailRow>
            ) : null}
            {phone ? (
              <BookingDetailRow label="Phone">
                <span className="flex min-w-0 justify-end sm:max-w-[68%]">
                  <ContactLine icon={Phone} value={phone} href={`tel:${phone}`} />
                </span>
              </BookingDetailRow>
            ) : null}
            {address ? <BookingDetailRow label="Address" value={address} /> : null}
            {nationality ? <BookingDetailRow label="Nationality" value={nationality} /> : null}
          </BookingDetailRowGroup>
        </BookingDetailCard>
      ) : null}

      <BookingDetailCard title="Guest list" icon={Users} bodyClassName="!px-0">
        {visibleSlots.length === 0 ? (
          <p className="text-muted-foreground px-4 py-4 text-sm sm:px-5">No guests listed.</p>
        ) : (
          <table className="w-full table-fixed">
            <caption className="sr-only">Guests staying on this booking</caption>
            <thead>
              <tr className="border-border/60 border-b">
                <th scope="col" className="text-overline px-4 pb-2 text-left sm:px-5">
                  Name
                </th>
                <th scope="col" className="text-overline w-[4.5rem] pb-2 text-left">
                  Age
                </th>
                <th
                  scope="col"
                  className="text-overline w-[5.5rem] px-4 pb-2 text-left sm:w-28 sm:px-5"
                >
                  Valid ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {visibleSlots.map((slot) => {
                const name = booking[slot.nameKey]?.trim();
                const age = booking[slot.ageKey];
                const hasAge = age != null && !Number.isNaN(age);
                const validIdUrl = booking[slot.validIdUrlKey]?.trim();
                const needsValidId = hasAge && requiresValidId(age);

                return (
                  <tr key={slot.index}>
                    <td className="px-4 py-2.5 align-middle sm:px-5">
                      <p className="text-muted-foreground text-xs font-medium">{slot.label}</p>
                      <p
                        title={name}
                        className={cn(
                          'truncate text-sm leading-snug',
                          name ? 'text-foreground font-semibold' : 'text-muted-foreground'
                        )}
                      >
                        {name || '-'}
                      </p>
                    </td>

                    <td className="text-muted-foreground py-2.5 text-center align-middle text-xs font-medium tabular-nums">
                      {hasAge ? `${age} ${age === 1 ? 'yr' : 'yrs'}` : '-'}
                    </td>

                    <td className="px-4 py-2.5 align-middle sm:px-5">
                      <div className="flex justify-end">
                        {validIdUrl ? (
                          <DocPreview
                            compact
                            label={`${slot.label} guest valid ID`}
                            url={validIdUrl}
                            onPreview={onPreview}
                            receiptAiVerdict={
                              slot.validIdAiVerdictKey
                                ? booking[slot.validIdAiVerdictKey]
                                : undefined
                            }
                            receiptAiLoading={
                              slot.validIdAiVerdictKey
                                ? receiptAiPreviewLoading(
                                    isDocumentAiBackfilling,
                                    validIdUrl,
                                    booking[slot.validIdAiVerdictKey]
                                  )
                                : false
                            }
                            receiptAiVariant="valid_id"
                          />
                        ) : needsValidId ? (
                          <span className="border-border text-muted-foreground flex size-14 items-center justify-center rounded-lg border border-dashed text-[10px] font-medium sm:size-16">
                            No ID
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            {hasAge ? 'Not required' : '-'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </BookingDetailCard>
    </div>
  );
}
