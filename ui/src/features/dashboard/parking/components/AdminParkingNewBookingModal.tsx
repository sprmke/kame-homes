import { useCallback, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { useQueryClient } from '@tanstack/react-query';
import { Car, CalendarDays, Mail, Phone, User } from 'lucide-react';
import { toast } from 'sonner';

import { ParkingRegistrationForm } from '@/features/guest/marketing/parkings/components/ParkingRegistrationForm';
import { useSubmitParkingBookingRequest } from '@/features/guest/marketing/parkings/hooks/useSubmitParkingBookingRequest';
import type { ParkingRegistrationValues } from '@/features/guest/marketing/parkings/lib/parkingRegistrationSchema';

import {
  AdminBookingSuccessSummary,
  type AdminBookingSuccessRow,
} from '@/features/dashboard/bookings/components/AdminBookingSuccessSummary';
import { BOOKINGS_QUERY_KEY } from '@/features/dashboard/bookings/hooks/useBookings';
import { parkingBookingDetailPath } from '@/features/dashboard/org/lib/tenantPaths';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { cn } from '@/lib/utils';
import { formatDateToLongFormat } from '@/utils/format/dates';

/** Server error codes/messages mapped to admin-facing copy — mirrors the public parking modal. */
const SUBMIT_ERROR_MESSAGES: Record<string, string> = {
  no_parking_available: 'No parking slots are available for these dates',
  'Parking not found': 'This parking listing is no longer available',
  'Organization not found': 'This parking listing is no longer available',
  'checkOutDate must be after checkInDate': 'Check-out date must be after check-in date',
};

export interface AdminParkingNewBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string | null;
  parkingSlug: string | null;
  parkingId: string;
  towerLabel?: string | null;
}

type ParkingBookingResult = {
  bookingId: string;
  values: ParkingRegistrationValues;
};

function toSuccessRows(values: ParkingRegistrationValues): AdminBookingSuccessRow[] {
  return [
    {
      icon: CalendarDays,
      label: 'Parking dates',
      value: `${formatDateToLongFormat(values.checkInDate)} - ${formatDateToLongFormat(values.checkOutDate)}`,
    },
    { icon: User, label: 'Guest', value: values.guestName },
    { icon: Mail, label: 'Email', value: values.email },
    { icon: Phone, label: 'Phone', value: values.phone },
    {
      icon: Car,
      label: 'Vehicle',
      value: `${values.carPlateNumber}: ${values.carBrandModel} (${values.carColor})`,
    },
  ];
}

export function AdminParkingNewBookingModal({
  open,
  onOpenChange,
  orgSlug,
  parkingSlug,
  parkingId,
  towerLabel,
}: AdminParkingNewBookingModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const submitRequest = useSubmitParkingBookingRequest();

  const [view, setView] = useState<'form' | 'success'>('form');
  const [result, setResult] = useState<ParkingBookingResult | null>(null);
  const [formKey, setFormKey] = useState(0);

  const [formDirty, setFormDirty] = useState(false);

  const resetState = useCallback(() => {
    setView('form');
    setResult(null);
    setFormDirty(false);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) resetState();
      onOpenChange(next);
    },
    [onOpenChange, resetState]
  );

  const { onOpenChange: guardedOpenChange, dialogProps } = useGuardedClose({
    open,
    onOpenChange: handleOpenChange,
    isDirty: view === 'form' && formDirty,
    onDiscard: () => setFormDirty(false),
  });

  const handleSubmit = useCallback(
    async (values: ParkingRegistrationValues) => {
      try {
        const submitResult = await submitRequest.mutateAsync({
          parkingId,
          checkInDate: values.checkInDate,
          checkOutDate: values.checkOutDate,
          vehicleType: values.vehicleType,
          primaryGuestName: values.guestName,
          guestEmail: values.email,
          guestPhone: values.phone,
          unitNumber: values.unitNumber,
          carPlateNumber: values.carPlateNumber,
          carBrandModel: values.carBrandModel,
          carColor: values.carColor,
          notes: values.notes,
        });
        void queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
        setFormDirty(false);
        setResult({ bookingId: submitResult.bookingId, values });
        setView('success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not submit parking request';
        toast.error(SUBMIT_ERROR_MESSAGES[message] ?? 'Could not submit parking request');
      }
    },
    [parkingId, queryClient, submitRequest]
  );

  const handleAddAnother = useCallback(() => {
    setView('form');
    setResult(null);
    setFormDirty(false);
    setFormKey((key) => key + 1);
  }, []);

  const handleViewBooking = useCallback(() => {
    if (!result || !orgSlug || !parkingSlug) return;
    onOpenChange(false);
    navigate(parkingBookingDetailPath(orgSlug, parkingSlug, result.bookingId));
  }, [navigate, onOpenChange, orgSlug, parkingSlug, result]);

  return (
    <ResponsiveModal open={open} onOpenChange={guardedOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        className={cn(
          'flex h-[min(90dvh,48rem)] max-h-[min(90dvh,48rem)] w-[min(calc(100vw-1.5rem),36rem)] max-w-none flex-col gap-0 overflow-hidden p-0',
          'sm:w-[min(90vw,40rem)] sm:max-w-[40rem] sm:p-0'
        )}
      >
        <ResponsiveModalHeader className="border-border shrink-0 border-b px-5 pb-3 pt-4 text-left sm:px-6">
          <ResponsiveModalTitle className="text-foreground text-base font-semibold">
            New booking
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [-webkit-overflow-scrolling:touch] sm:px-6">
          {view === 'success' && result ? (
            <AdminBookingSuccessSummary
              title="Booking created"
              rows={toSuccessRows(result.values)}
              onAddAnother={handleAddAnother}
              onViewBooking={handleViewBooking}
            />
          ) : open ? (
            <ParkingRegistrationForm
              key={formKey}
              towerLabel={towerLabel}
              onSubmit={handleSubmit}
              onDirtyChange={setFormDirty}
            />
          ) : null}
        </div>
      </ResponsiveModalContent>
      <UnsavedChangesDialog {...dialogProps} />
    </ResponsiveModal>
  );
}
