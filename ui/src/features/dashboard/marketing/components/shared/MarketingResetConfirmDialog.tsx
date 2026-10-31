import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  contentClassName?: string;
  overlayClassName?: string;
};

export function MarketingResetConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = 'Reset to default?',
  description = 'All unsaved changes will be lost.',
  confirmLabel = 'Reset',
  contentClassName,
  overlayClassName,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        overlayClassName={overlayClassName}
        className={cn('max-w-[min(calc(100vw-1.5rem),24rem)]', contentClassName)}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              buttonVariants({ variant: 'destructive' }),
              '!bg-destructive hover:!bg-destructive/90 [background-image:none]'
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
