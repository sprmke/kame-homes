import { useCallback, useState } from 'react';

import {
  GuestProfileForm,
  type GuestProfileFormState,
} from '@/features/guest/account/components/GuestProfileForm';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { cn } from '@/lib/utils';

const PROFILE_FORM_ID = 'guest-profile-modal-form';

type GuestProfileModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GuestProfileModal({ open, onOpenChange }: GuestProfileModalProps) {
  const [formState, setFormState] = useState<GuestProfileFormState | null>(null);

  const closeModal = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) setFormState(null);
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  const {
    onOpenChange: handleOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open,
    onOpenChange: closeModal,
    isDirty: Boolean(formState?.isDirty),
    onSave: () => formState?.saveAsync() ?? false,
    onDiscard: () => formState?.reset(),
  });

  const handleCancel = requestClose;

  const ignoreLocationSuggestionsOutside = useCallback((event: Event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('[data-kame-location-suggestions]')) {
      event.preventDefault();
    }
  }, []);

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          aria-describedby={undefined}
          onPointerDownOutside={ignoreLocationSuggestionsOutside}
          onInteractOutside={ignoreLocationSuggestionsOutside}
          className={cn(
            'flex h-[min(90dvh,40rem)] max-h-[min(90dvh,40rem)] w-[min(calc(100vw-1.5rem),28rem)] max-w-none flex-col gap-0 overflow-hidden p-0',
            'sm:h-[min(90dvh,40rem)] sm:max-h-[min(90dvh,40rem)] sm:w-[min(calc(100vw-1.5rem),28rem)] sm:max-w-[28rem] sm:p-0'
          )}
        >
          <ResponsiveModalHeader className="border-border shrink-0 space-y-1 border-b px-5 pb-3.5 pr-14 pt-5 text-left sm:px-6">
            <ResponsiveModalTitle>Profile</ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
            <GuestProfileForm
              embedded
              hideFooter
              formId={PROFILE_FORM_ID}
              onFormStateChange={setFormState}
            />
          </div>

          <ResponsiveModalFooter className="border-border shrink-0 gap-2 border-t px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
              onClick={handleCancel}
              disabled={formState?.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form={PROFILE_FORM_ID}
              className="min-h-11 w-full sm:w-auto"
              disabled={!formState?.isDirty || !formState?.isValid || formState?.isPending}
            >
              {formState?.isPending ? 'Saving…' : 'Save'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
