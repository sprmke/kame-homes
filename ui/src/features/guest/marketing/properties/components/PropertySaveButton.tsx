import { useEffect, useRef, useState } from 'react';

import { motion, useReducedMotion } from 'framer-motion';
import { Heart } from 'lucide-react';

import { usePropertySave } from '@/features/guest/marketing/properties/hooks/usePropertySave';

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
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PropertySaveButtonProps = {
  propertySlug: string;
  variant: 'card' | 'carousel' | 'list' | 'pill';
  className?: string;
  /** When set, tapping a saved heart opens a confirm dialog before unsaving. */
  confirmUnsave?: boolean;
  propertyName?: string;
};

function SaveHeartIcon({
  active,
  size = 'md',
  burst,
}: {
  active: boolean;
  size?: 'sm' | 'md';
  burst: number;
}) {
  const reduceMotion = useReducedMotion();
  const iconClass = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  if (reduceMotion) {
    return <Heart className={cn(iconClass, active && 'fill-current')} aria-hidden />;
  }

  return (
    <span className="relative flex items-center justify-center">
      {active && burst > 0 ? (
        <motion.span
          key={`burst-${burst}`}
          className="pointer-events-none absolute inset-0 rounded-full bg-rose-400/45"
          initial={{ scale: 0.6, opacity: 0.75 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        />
      ) : null}
      <motion.span
        initial={false}
        animate={
          active ? { scale: [1, 1.28, 0.94, 1], rotate: [0, -8, 6, 0] } : { scale: 1, rotate: 0 }
        }
        transition={{
          duration: active ? 0.42 : 0.2,
          ease: active ? [0.34, 1.56, 0.64, 1] : [0.4, 0, 0.2, 1],
        }}
      >
        <Heart
          className={cn(
            iconClass,
            'transition-[fill,color] duration-200',
            active && 'fill-current'
          )}
          aria-hidden
        />
      </motion.span>
    </span>
  );
}

export function PropertySaveButton({
  propertySlug,
  variant,
  className,
  confirmUnsave = false,
  propertyName,
}: PropertySaveButtonProps) {
  const { isSaved, toggleSave, isPending } = usePropertySave(propertySlug);
  const reduceMotion = useReducedMotion();
  const [burstKey, setBurstKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const prevSavedRef = useRef(isSaved);

  useEffect(() => {
    if (isSaved && !prevSavedRef.current) {
      setBurstKey((key) => key + 1);
    }
    prevSavedRef.current = isSaved;
  }, [isSaved]);

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (confirmUnsave && isSaved) {
      setConfirmOpen(true);
      return;
    }

    toggleSave(event);
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleConfirmUnsave = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setConfirmOpen(false);
    toggleSave();
  };

  const handleDialogOpenChange = (open: boolean) => {
    setConfirmOpen(open);
  };

  const unsaveDialog = confirmUnsave ? (
    <AlertDialog open={confirmOpen} onOpenChange={handleDialogOpenChange}>
      <AlertDialogContent
        className="max-w-[min(calc(100vw-1.5rem),24rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Remove from favorites?</AlertDialogTitle>
          {propertyName ? (
            <AlertDialogDescription>
              {propertyName} will be removed from your saved properties.
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-[44px]" onClick={(event) => event.stopPropagation()}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[44px]"
            onClick={handleConfirmUnsave}
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  if (variant === 'pill') {
    return (
      <>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isPending}
          className={cn(
            'min-h-[44px] gap-2 rounded-full backdrop-blur-sm transition-colors duration-300',
            isSaved
              ? 'bg-rose-500 text-white hover:bg-rose-600'
              : 'bg-background/90 hover:bg-background',
            className
          )}
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          aria-pressed={isSaved}
          aria-label={isSaved ? 'Unsave property' : 'Save property'}
        >
          <SaveHeartIcon active={isSaved} burst={burstKey} />
          <span className="@sm:inline hidden">{isSaved ? 'Saved' : 'Save'}</span>
        </Button>
        {unsaveDialog}
      </>
    );
  }

  const revealOnHover = variant === 'card';

  const buttonClass = cn(
    'absolute right-3 top-3 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2 shadow-lg backdrop-blur-sm',
    revealOnHover &&
      !isSaved &&
      'translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100',
    isSaved
      ? 'bg-rose-500 text-white opacity-100 shadow-rose-500/25'
      : 'bg-white/90 text-slate-600 hover:bg-white hover:text-rose-500 dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:text-rose-400',
    variant === 'carousel' && 'opacity-100',
    isPending && 'pointer-events-none opacity-80',
    className
  );

  if (reduceMotion) {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          disabled={isPending}
          aria-pressed={isSaved}
          aria-label={isSaved ? 'Unsave property' : 'Save property'}
          className={cn(buttonClass, 'transition-colors duration-300')}
        >
          <Heart className={cn('h-4 w-4', isSaved && 'fill-current')} />
        </button>
        {unsaveDialog}
      </>
    );
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        disabled={isPending}
        aria-pressed={isSaved}
        aria-label={isSaved ? 'Unsave property' : 'Save property'}
        className={buttonClass}
        whileTap={{ scale: 0.92 }}
        animate={
          isSaved
            ? { scale: 1, boxShadow: '0 10px 24px -8px rgba(244, 63, 94, 0.45)' }
            : { scale: 1, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }
        }
        transition={{ type: 'spring', stiffness: 520, damping: 28 }}
      >
        <SaveHeartIcon active={isSaved} burst={burstKey} />
      </motion.button>
      {unsaveDialog}
    </>
  );
}
