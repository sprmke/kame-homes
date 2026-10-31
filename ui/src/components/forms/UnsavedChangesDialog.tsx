import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export type UnsavedChangesDialogProps = {
  open: boolean;
  /** Stay on the page / keep the modal open. Also fires on Esc. */
  onKeepEditing: () => void;
  onDiscard: () => void;
  /** Omit when the draft cannot be saved from here; the Save button is then hidden. */
  onSave?: () => void;
  isSaving?: boolean;
  /** Wording only: `leave` for navigation, `close` for a modal or sheet. */
  action?: 'leave' | 'close';
};

/**
 * The one confirmation shown whenever a dirty form would be lost. Rendered by
 * `UnsavedChangesProvider` (route changes) and `useGuardedClose` (modals).
 * `AlertDialog` is the sanctioned centered dialog on phones (mobile-native-ui).
 */
export function UnsavedChangesDialog({
  open,
  onKeepEditing,
  onDiscard,
  onSave,
  isSaving = false,
  action = 'leave',
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && !isSaving && onKeepEditing()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {onSave ? 'Save your changes?' : 'Discard your changes?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {onSave
              ? 'You have unsaved changes. Save them first, or discard them.'
              : 'You have unsaved changes that will be lost.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={isSaving} className="mt-0">
            Keep editing
          </AlertDialogCancel>
          <Button type="button" variant="outline" onClick={onDiscard} disabled={isSaving}>
            Discard
          </Button>
          {onSave ? (
            <Button type="button" onClick={onSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : action === 'close' ? 'Save & close' : 'Save & leave'}
            </Button>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
