import { Pencil } from 'lucide-react';

import type { LinkableParkingBooking } from '@/features/guest/marketing/parkings/hooks/useLinkableParkingBookings';
import type { ParkingRegistrationValues } from '@/features/guest/marketing/parkings/lib/parkingRegistrationSchema';
import { PARKING_LINKED_CONFIRM_TITLE } from '@/features/guest/marketing/parkings/lib/parkingRequestEntryCopy';

import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatParkingStayRange } from '@/utils/format/parkingStayDisplay';

import type { UseFormReturn } from 'react-hook-form';

type Props = {
  booking: LinkableParkingBooking;
  form: UseFormReturn<ParkingRegistrationValues>;
  isSubmitting: boolean;
  onBack: () => void;
  onEditDetails: () => void;
  onSubmit: () => void;
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground shrink-0 text-xs font-medium">{label}</dt>
      <dd className="text-foreground min-w-0 truncate text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

export function ParkingLinkedStayConfirm({
  booking,
  form,
  isSubmitting,
  onBack,
  onEditDetails,
  onSubmit,
}: Props) {
  const values = form.watch();
  const stayName = booking.propertyName?.trim() || 'Your stay';
  const stayRange = formatParkingStayRange(booking.checkInDate, booking.checkOutDate);
  const parkingRange = formatParkingStayRange(values.checkInDate, values.checkOutDate);
  const needsVehicleType = !values.vehicleType;
  const vehicleLabel =
    values.vehicleType === 'motorcycle' ? 'Motorcycle' : values.vehicleType === 'car' ? 'Car' : '';

  const vehicleLine = [vehicleLabel, values.carPlateNumber, values.carBrandModel, values.carColor]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          {PARKING_LINKED_CONFIRM_TITLE}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground -mt-1 h-9 shrink-0 gap-1.5 px-2"
          onClick={onEditDetails}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Edit
        </Button>
      </div>

      <div className="border-border/70 divide-border/60 divide-y rounded-xl border px-4">
        <dl>
          <SummaryRow label="Stay" value={[stayName, stayRange].filter(Boolean).join(' · ')} />
          <SummaryRow label="Guest" value={values.guestName} />
          <SummaryRow
            label="Contact"
            value={[values.email, values.phone].filter(Boolean).join(' · ')}
          />
          <SummaryRow label="Unit" value={values.unitNumber} />
          <SummaryRow label="Parking" value={parkingRange ?? ''} />
          {vehicleLine ? <SummaryRow label="Vehicle" value={vehicleLine} /> : null}
        </dl>

        {needsVehicleType ? (
          <div className="py-3">
            <FormField
              control={form.control}
              name="vehicleType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Vehicle type <span className="text-destructive">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="car">Car</SelectItem>
                      <SelectItem value="motorcycle">Motorcycle</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          onClick={onBack}
          disabled={isSubmitting}
        >
          Back
        </Button>
        <Button
          type="button"
          className="min-h-[44px] min-w-[9.5rem]"
          onClick={onSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting…' : 'Submit request'}
        </Button>
      </div>
    </div>
  );
}
