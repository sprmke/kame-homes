import { Button } from '@/components/ui/button';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalTitle } from '@/components/ui/responsive-modal';
import { PLATFORM_APP_NAME } from '@/lib/platformBranding';

type ForceUpdateSheetProps = {
  onUpdate: () => void;
};

/**
 * `forceUpdateBelow` tripped: this build must update before it keeps going.
 * Deliberately *not* the kill-switch — caches are kept, so the app does not have to
 * be reinstalled from the home screen (4.6).
 *
 * No dismiss control: the only action updates. It is still polite copy, and it
 * cannot appear over a form because the update controller never applies mid-task.
 */
export function ForceUpdateSheet({ onUpdate }: ForceUpdateSheetProps) {
  return (
    <ResponsiveModal open>
      <ResponsiveModalContent showCloseButton={false}>
        <ResponsiveModalTitle>Update needed to keep going</ResponsiveModalTitle>
        <p className="text-muted-foreground mt-1 text-sm leading-snug">
          {`This version of ${PLATFORM_APP_NAME} is too old to continue safely.`}
        </p>
        <Button className="mt-5 w-full" onClick={onUpdate}>
          Update
        </Button>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
