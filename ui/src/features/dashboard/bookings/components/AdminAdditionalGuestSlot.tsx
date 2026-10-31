import { Minus } from 'lucide-react';

import { requiresValidId } from '@/features/guest/form/lib/guestCounts';

import {
  Field,
  Input,
} from '@/features/dashboard/bookings/components/booking-detail/edit/BookingEditFields';
import type { BookingEditFormValues } from '@/features/dashboard/bookings/components/bookingEditFormShared';
import { BookingGuestDocReplacer } from '@/features/dashboard/bookings/components/BookingGuestDocReplacer';
import type { GuestDocAssetType } from '@/features/dashboard/bookings/hooks/useUploadBookingAsset';

import { Button } from '@/components/ui/button';

import type { UseFormRegister } from 'react-hook-form';

type AdditionalGuestNameField = 'guest2_name' | 'guest3_name' | 'guest4_name' | 'guest5_name';
type AdditionalGuestAgeField = 'guest2_age' | 'guest3_age' | 'guest4_age' | 'guest5_age';

type AdminAdditionalGuestSlotProps = {
  slotLabel: string;
  nameField: AdditionalGuestNameField;
  ageField: AdditionalGuestAgeField;
  bookingId: string;
  register: UseFormRegister<BookingEditFormValues>;
  guestAge?: number;
  validIdUrl?: string | null;
  assetType: GuestDocAssetType;
  onPreview: (label: string, rawUrl: string) => void | Promise<void>;
  /** When set, caps the age input max (e.g. fifth guest → 3). */
  maxAge?: number;
  agePlaceholder?: string;
  onRemove?: () => void;
};

export function AdminAdditionalGuestSlot({
  slotLabel,
  nameField,
  ageField,
  bookingId,
  register,
  guestAge,
  validIdUrl,
  assetType,
  onPreview,
  maxAge,
  agePlaceholder = 'Ex. 25',
  onRemove,
}: AdminAdditionalGuestSlotProps) {
  const showValidId = guestAge != null && !Number.isNaN(guestAge) && requiresValidId(guestAge);
  const nameId = `${nameField}`;
  const ageId = `${ageField}`;

  return (
    <div className="border-border/60 bg-muted/15 min-w-0 space-y-3 rounded-xl border p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground min-w-0 truncate text-xs font-medium">{slotLabel}</p>
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive min-h-[44px] min-w-[44px] shrink-0 cursor-pointer"
            onClick={onRemove}
            aria-label={`Remove ${slotLabel.toLowerCase()}`}
          >
            <Minus className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor={nameId}>
          <Input
            id={nameId}
            {...register(nameField)}
            placeholder="Full name (optional)"
            autoComplete="off"
          />
        </Field>
        <Field label="Age" htmlFor={ageId}>
          <Input
            id={ageId}
            type="number"
            min={0}
            max={maxAge ?? 120}
            inputMode="numeric"
            placeholder={agePlaceholder}
            className="tabular-nums"
            {...register(ageField, { valueAsNumber: true })}
          />
        </Field>
      </div>
      {showValidId ? (
        <BookingGuestDocReplacer
          bookingId={bookingId}
          assetType={assetType}
          label="Valid ID"
          currentUrl={validIdUrl}
          accept="image/*,.pdf"
          onPreview={onPreview}
        />
      ) : null}
    </div>
  );
}
