import { useCallback, useState } from 'react';

import { User } from 'lucide-react';

import { GuestForm, type GuestFormEmbedNav } from '@/features/guest/form/components/GuestForm';
import { GuestFormStepNavigation } from '@/features/guest/form/components/GuestFormStepNavigation';
import { GuestDialogShell } from '@/features/guest/marketing/shared/components/GuestDialogShell';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { ResponsiveModalTitle } from '@/components/ui/responsive-modal';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { dateToString } from '@/utils/format/dates';

export interface GuestBookingFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertySlug: string;
  propertyName?: string;
  checkIn: Date | null;
  checkOut: Date | null;
  numberOfAdults?: number;
  numberOfChildren?: number;
}

export function GuestBookingFormModal({
  open,
  onOpenChange,
  propertySlug,
  checkIn,
  checkOut,
  numberOfAdults,
  numberOfChildren,
}: GuestBookingFormModalProps) {
  const checkInDate = checkIn ? dateToString(checkIn) : null;
  const checkOutDate = checkOut ? dateToString(checkOut) : null;
  const formKey = `${propertySlug}:${checkInDate ?? ''}:${checkOutDate ?? ''}:${numberOfAdults ?? ''}:${numberOfChildren ?? ''}`;

  const [embedNav, setEmbedNav] = useState<GuestFormEmbedNav | null>(null);

  const handleNavChange = useCallback((nav: GuestFormEmbedNav | null) => {
    setEmbedNav(nav);
  }, []);

  const [formDirty, setFormDirty] = useState(false);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setEmbedNav(null);
        setFormDirty(false);
      }
      onOpenChange(next);
    },
    [onOpenChange]
  );

  const { onOpenChange: guardedOpenChange, dialogProps } = useGuardedClose({
    open,
    onOpenChange: handleOpenChange,
    isDirty: formDirty,
  });

  return (
    <>
      <GuestDialogShell
        open={open}
        onOpenChange={guardedOpenChange}
        title={
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
              <User className="text-primary h-3.5 w-3.5" />
            </div>
            <ResponsiveModalTitle className="text-foreground text-base font-semibold">
              Guest Form
            </ResponsiveModalTitle>
          </div>
        }
        // Comfortable form width — wider than calendar, not full desktop.
        sizeClassName="max-w-[min(calc(100vw-1.5rem),36rem)] sm:max-w-[min(90vw,40rem)]"
        heightClassName="max-h-[min(92dvh,48rem)]"
        bodyClassName="px-5 py-4 sm:px-6"
        footer={
          embedNav?.show ? (
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
        {open && checkInDate && checkOutDate ? (
          <GuestForm
            key={formKey}
            embed={{
              checkInDate,
              checkOutDate,
              numberOfAdults,
              numberOfChildren,
              compactChrome: true,
              onNavChange: handleNavChange,
              onDirtyChange: setFormDirty,
            }}
          />
        ) : null}
      </GuestDialogShell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
