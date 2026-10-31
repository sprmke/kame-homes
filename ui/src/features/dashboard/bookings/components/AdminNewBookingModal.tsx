import { useCallback, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Mail, Phone, User, Users } from 'lucide-react';

import {
  GuestForm,
  type GuestFormEmbedNav,
  type GuestFormSubmitSuccess,
} from '@/features/guest/form/components/GuestForm';
import { GuestFormStepNavigation } from '@/features/guest/form/components/GuestFormStepNavigation';
import { GuestDialogShell } from '@/features/guest/marketing/shared/components/GuestDialogShell';

import {
  AdminBookingSuccessSummary,
  type AdminBookingSuccessRow,
} from '@/features/dashboard/bookings/components/AdminBookingSuccessSummary';
import { BOOKINGS_QUERY_KEY } from '@/features/dashboard/bookings/hooks/useBookings';
import { bookingDetailPath } from '@/features/dashboard/org/lib/tenantPaths';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { ResponsiveModalTitle } from '@/components/ui/responsive-modal';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { formatDateToLongFormat } from '@/utils/format/dates';

export interface AdminNewBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string | null;
  propertySlug: string | null;
}

function toSuccessRows(result: GuestFormSubmitSuccess): AdminBookingSuccessRow[] {
  const { bookingData } = result;
  const guestNames = [
    bookingData.primaryGuestName,
    bookingData.guest2Name,
    bookingData.guest3Name,
    bookingData.guest4Name,
    bookingData.guest5Name,
  ].filter(Boolean);
  const totalGuests = bookingData.numberOfAdults + bookingData.numberOfChildren;

  return [
    {
      icon: CalendarDays,
      label: 'Stay dates',
      value: `${formatDateToLongFormat(bookingData.checkInDate)} - ${formatDateToLongFormat(bookingData.checkOutDate)}`,
    },
    {
      icon: User,
      label: 'Guests',
      value: `${guestNames.join(', ')} (${totalGuests} guest${totalGuests === 1 ? '' : 's'})`,
    },
    { icon: Mail, label: 'Email', value: bookingData.guestEmail },
    { icon: Phone, label: 'Phone', value: bookingData.guestPhoneNumber },
  ];
}

export function AdminNewBookingModal({
  open,
  onOpenChange,
  orgSlug,
  propertySlug,
}: AdminNewBookingModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [view, setView] = useState<'form' | 'success'>('form');
  const [result, setResult] = useState<GuestFormSubmitSuccess | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [embedNav, setEmbedNav] = useState<GuestFormEmbedNav | null>(null);

  const [formDirty, setFormDirty] = useState(false);

  const resetState = useCallback(() => {
    setView('form');
    setResult(null);
    setEmbedNav(null);
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

  const handleSubmitSuccess = useCallback(
    (submitResult: GuestFormSubmitSuccess) => {
      void queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
      setFormDirty(false);
      setResult(submitResult);
      setView('success');
    },
    [queryClient]
  );

  const handleAddAnother = useCallback(() => {
    setView('form');
    setResult(null);
    setEmbedNav(null);
    setFormDirty(false);
    setResetKey((key) => key + 1);
  }, []);

  const handleViewBooking = useCallback(() => {
    if (!result || !orgSlug || !propertySlug) return;
    onOpenChange(false);
    navigate(bookingDetailPath(orgSlug, propertySlug, result.bookingId));
  }, [navigate, onOpenChange, orgSlug, propertySlug, result]);

  return (
    <>
      <GuestDialogShell
        open={open}
        onOpenChange={guardedOpenChange}
        title={
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
              <Users className="text-primary h-3.5 w-3.5" />
            </div>
            <ResponsiveModalTitle className="text-foreground text-base font-semibold">
              New Booking
            </ResponsiveModalTitle>
          </div>
        }
        sizeClassName="max-w-[min(calc(100vw-1.5rem),36rem)] sm:max-w-[min(90vw,40rem)]"
        heightClassName="max-h-[min(92dvh,48rem)]"
        bodyClassName="px-5 py-4 sm:px-6"
        footer={
          view === 'form' && embedNav?.show ? (
            <GuestFormStepNavigation
              bare
              currentStep={embedNav.currentStep}
              stepCount={embedNav.stepCount}
              isSubmitting={embedNav.isSubmitting}
              canProceed={embedNav.canProceed}
              submitReady={embedNav.submitReady}
              onBack={embedNav.onBack}
              onNext={embedNav.onNext}
              onSubmit={embedNav.onSubmit}
            />
          ) : null
        }
      >
        {view === 'success' && result ? (
          <AdminBookingSuccessSummary
            title="Booking created"
            rows={toSuccessRows(result)}
            onAddAnother={handleAddAnother}
            onViewBooking={handleViewBooking}
          />
        ) : open ? (
          <GuestForm
            key={resetKey}
            embed={{
              compactChrome: true,
              skipAuthGate: true,
              onNavChange: setEmbedNav,
              onSubmitSuccess: handleSubmitSuccess,
              onDirtyChange: setFormDirty,
            }}
          />
        ) : null}
      </GuestDialogShell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
