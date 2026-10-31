import { useEffect, useState } from 'react';

import { Minus, Plus, UserRound } from 'lucide-react';

import { GuestFormValidIdUpload } from '@/features/guest/form/components/GuestFormValidIdUpload';
import { PropertyGuestLimitReminder } from '@/features/guest/form/components/PropertyGuestLimitReminder';
import {
  computeOccupancyGuestCountsByAge,
  shouldShowGuestLimitMessage,
  FIFTH_PARTY_GUEST_MAX_AGE,
  formatGuestAgeInputValue,
  getActivePartySize,
  getDefaultAgeForGuestFormPartyGuest,
  guestPartyPositionLabel,
  getInitialVisibleGuestCount,
  isPartyOverflowGuest,
  MAX_GUESTS,
  parseGuestAgeInputChange,
  requiresValidId,
  type PropertyGuestCapacity,
  DEFAULT_PROPERTY_GUEST_CAPACITY,
} from '@/features/guest/form/lib/guestCounts';
import type { GuestFormData } from '@/features/guest/form/schemas/guestFormSchema';

import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toCapitalCase } from '@/utils/text/formatters';
import { handleNameInputChange } from '@/utils/text/helpers';

import type { UseFormReturn } from 'react-hook-form';

type GuestNameField =
  'primaryGuestName' | 'guest2Name' | 'guest3Name' | 'guest4Name' | 'guest5Name';
type GuestAgeField = 'primaryGuestAge' | 'guest2Age' | 'guest3Age' | 'guest4Age' | 'guest5Age';
type GuestValidIdField =
  'validId' | 'guest2ValidId' | 'guest3ValidId' | 'guest4ValidId' | 'guest5ValidId';

type GuestSlotConfig = {
  index: number;
  nameField: GuestNameField;
  ageField: GuestAgeField;
  validIdField: GuestValidIdField;
};

const GUEST_SLOTS: GuestSlotConfig[] = [
  {
    index: 1,
    nameField: 'primaryGuestName',
    ageField: 'primaryGuestAge',
    validIdField: 'validId',
  },
  {
    index: 2,
    nameField: 'guest2Name',
    ageField: 'guest2Age',
    validIdField: 'guest2ValidId',
  },
  {
    index: 3,
    nameField: 'guest3Name',
    ageField: 'guest3Age',
    validIdField: 'guest3ValidId',
  },
  {
    index: 4,
    nameField: 'guest4Name',
    ageField: 'guest4Age',
    validIdField: 'guest4ValidId',
  },
  {
    index: 5,
    nameField: 'guest5Name',
    ageField: 'guest5Age',
    validIdField: 'guest5ValidId',
  },
];

type GuestFormGuestsSectionProps = {
  form: UseFormReturn<GuestFormData>;
  validIdPreviews: Record<string, string | null>;
  validIdImageErrors: Record<string, boolean>;
  onValidIdPreviewChange: (field: string, preview: string | null) => void;
  onValidIdImageErrorChange: (field: string, hasError: boolean) => void;
  /** Bumps when an existing booking is loaded so visible guest slots expand. */
  seedKey?: string | number;
  guestCapacity?: PropertyGuestCapacity;
};

function clearGuestSlot(
  form: UseFormReturn<GuestFormData>,
  slot: GuestSlotConfig,
  onValidIdPreviewChange: (field: string, preview: string | null) => void,
  onValidIdImageErrorChange: (field: string, hasError: boolean) => void
) {
  const previewKey = String(slot.validIdField);
  form.setValue(slot.nameField, '');
  form.setValue(slot.ageField, null as unknown as number | undefined);
  form.setValue(slot.validIdField, undefined);
  onValidIdPreviewChange(previewKey, null);
  onValidIdImageErrorChange(previewKey, false);
}

export function GuestFormGuestsSection({
  form,
  validIdPreviews,
  validIdImageErrors,
  onValidIdPreviewChange,
  onValidIdImageErrorChange,
  seedKey,
  guestCapacity = DEFAULT_PROPERTY_GUEST_CAPACITY,
}: GuestFormGuestsSectionProps) {
  const maxVisibleGuests = Math.min(
    MAX_GUESTS,
    guestCapacity.maxAdults + guestCapacity.maxChildren
  );
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    const values = form.getValues();
    const fromSlots = getInitialVisibleGuestCount([
      { name: values.primaryGuestName, age: values.primaryGuestAge },
      { name: values.guest2Name, age: values.guest2Age },
      { name: values.guest3Name, age: values.guest3Age },
      { name: values.guest4Name, age: values.guest4Age },
      { name: values.guest5Name, age: values.guest5Age },
    ]);
    const fromCounts = Math.min(
      maxVisibleGuests,
      Math.max(1, (values.numberOfAdults ?? 1) + (values.numberOfChildren ?? 0))
    );
    setVisibleCount(Math.max(fromSlots, fromCounts));
  }, [seedKey, form, maxVisibleGuests]);

  const watchedGuests = form.watch([
    'primaryGuestName',
    'primaryGuestAge',
    'guest2Name',
    'guest2Age',
    'guest3Name',
    'guest3Age',
    'guest4Name',
    'guest4Age',
    'guest5Name',
    'guest5Age',
  ]);

  const partyGuests = [
    {
      name: watchedGuests[0] as string,
      age: watchedGuests[1] as number | undefined,
    },
    {
      name: watchedGuests[2] as string,
      age: watchedGuests[3] as number | undefined,
    },
    {
      name: watchedGuests[4] as string,
      age: watchedGuests[5] as number | undefined,
    },
    {
      name: watchedGuests[6] as string,
      age: watchedGuests[7] as number | undefined,
    },
    {
      name: watchedGuests[8] as string,
      age: watchedGuests[9] as number | undefined,
    },
  ];
  const partySize = Math.max(getActivePartySize(partyGuests), visibleCount);

  const visiblePartyGuests = partyGuests.slice(0, visibleCount);

  const occupancyAgeCounts = computeOccupancyGuestCountsByAge(
    visiblePartyGuests.map(({ name, age }) => ({
      age: name?.trim() || age != null ? age : undefined,
    }))
  );

  const showGuestLimitInfo = shouldShowGuestLimitMessage(
    occupancyAgeCounts.adults,
    occupancyAgeCounts.children,
    guestCapacity,
    partySize
  );

  const visibleSlots = GUEST_SLOTS.slice(0, visibleCount);

  const handleRemoveLastGuest = () => {
    if (visibleCount <= 1) return;
    const slot = GUEST_SLOTS[visibleCount - 1];
    clearGuestSlot(form, slot, onValidIdPreviewChange, onValidIdImageErrorChange);
    setVisibleCount((count) => count - 1);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {visibleSlots.map((slot) => {
          const isPrimary = slot.index === 1;
          const partyPosition = slot.index;
          const isOverflowPartyGuest = isPartyOverflowGuest(
            partyPosition,
            partySize,
            guestCapacity
          );
          const age = form.watch(slot.ageField) as number | undefined;
          const previewKey = slot.validIdField;
          const nameValue = form.watch(slot.nameField);
          const guestName = typeof nameValue === 'string' ? nameValue.trim() : '';
          const showValidId = age != null && !Number.isNaN(age) && requiresValidId(age);
          const ageRequired = isPrimary || guestName.length > 0;
          const isLastVisible = slot.index === visibleCount;
          const partyLabel = guestPartyPositionLabel(partyPosition);

          return (
            <section
              key={slot.index}
              className="border-border/80 bg-background/60 space-y-4 rounded-xl border p-4 sm:p-5"
            >
              <div className="border-separator flex items-start justify-between gap-3 border-b pb-3">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <UserRound className="size-4" aria-hidden />
                  </div>
                  <h3 className="text-foreground text-sm font-bold">
                    {partyLabel}
                    {isPrimary && <span className="text-destructive"> *</span>}
                  </h3>
                </div>
                {!isPrimary && isLastVisible && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground min-h-[44px] shrink-0"
                    onClick={handleRemoveLastGuest}
                    aria-label={`Remove ${partyLabel.toLowerCase()}`}
                  >
                    <Minus className="size-4" aria-hidden />
                  </Button>
                )}
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
                <FormField
                  control={form.control}
                  name={slot.nameField}
                  render={({ field }) => (
                    <FormItem className="min-w-0">
                      <FormLabel>
                        Name
                        {isPrimary && <span className="text-destructive"> *</span>}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={`Complete name of ${partyLabel}`}
                          {...field}
                          value={field.value?.toString() ?? ''}
                          onChange={(event) =>
                            handleNameInputChange(event, field.onChange, toCapitalCase)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={slot.ageField}
                  render={({ field }) => (
                    <FormItem className="min-w-0">
                      <FormLabel>
                        Age
                        {ageRequired && <span className="text-destructive"> *</span>}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder={isOverflowPartyGuest ? '3' : 'Ex. 25'}
                          value={formatGuestAgeInputValue(field.value)}
                          onChange={(event) => {
                            let next = parseGuestAgeInputChange(event.target.value);
                            if (
                              isOverflowPartyGuest &&
                              next != null &&
                              next > FIFTH_PARTY_GUEST_MAX_AGE
                            ) {
                              next = FIFTH_PARTY_GUEST_MAX_AGE;
                            }
                            field.onChange(next);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {showValidId && (
                <FormField
                  control={form.control}
                  name={slot.validIdField}
                  render={({ field: { onChange, value, ...field } }) => (
                    <GuestFormValidIdUpload
                      preview={validIdPreviews[previewKey] ?? null}
                      value={value as File | undefined}
                      imageLoadError={validIdImageErrors[previewKey] ?? false}
                      onChange={onChange}
                      onPreviewChange={(preview) => onValidIdPreviewChange(previewKey, preview)}
                      onImageLoadErrorChange={(hasError) =>
                        onValidIdImageErrorChange(previewKey, hasError)
                      }
                      fieldProps={field}
                    />
                  )}
                />
              )}
            </section>
          );
        })}
      </div>

      {showGuestLimitInfo && (
        <PropertyGuestLimitReminder capacity={guestCapacity} partySize={partySize} />
      )}

      {visibleCount < maxVisibleGuests && (
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] w-full"
          onClick={() => {
            setVisibleCount((count) => {
              const next = Math.min(maxVisibleGuests, count + 1);
              const slot = GUEST_SLOTS[next - 1];
              if (form.getValues(slot.ageField) == null) {
                form.setValue(
                  slot.ageField,
                  getDefaultAgeForGuestFormPartyGuest(slot.index, next, guestCapacity)
                );
              }
              return next;
            });
          }}
        >
          <Plus className="size-4" aria-hidden />
          Add more guest
        </Button>
      )}
    </div>
  );
}
