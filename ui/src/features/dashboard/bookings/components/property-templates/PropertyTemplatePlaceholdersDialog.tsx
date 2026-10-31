import * as React from 'react';

import { TelegramPlaceholdersReference } from '@/features/dashboard/bookings/components/TelegramPlaceholdersReference';

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: readonly string[];
  sampleVars?: Record<string, string>;
  onInsertToken?: (token: string) => void;
};

function placeholdersModalWidthClass(lineCount: number): string {
  if (lineCount > 36) return 'sm:max-w-[min(95vw,56rem)]';
  if (lineCount > 20) return 'sm:max-w-[min(95vw,52rem)]';
  return 'sm:max-w-[min(95vw,48rem)]';
}

export function PropertyTemplatePlaceholdersDialog({
  open,
  onOpenChange,
  lines,
  sampleVars,
  onInsertToken,
}: Props) {
  const widthClass = placeholdersModalWidthClass(lines.length);

  const handleInsertToken = React.useCallback(
    (token: string) => {
      onInsertToken?.(token);
      onOpenChange(false);
    },
    [onInsertToken, onOpenChange]
  );

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        className={cn(
          'flex max-h-[min(92dvh,780px)] flex-col gap-0 overflow-hidden p-0 sm:p-0',
          widthClass
        )}
      >
        <ResponsiveModalHeader className="border-border/60 shrink-0 border-b px-4 py-3 sm:px-5 sm:py-4">
          <ResponsiveModalTitle className="text-base sm:text-lg">Placeholders</ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <TelegramPlaceholdersReference
            lines={[...lines]}
            sampleVars={sampleVars}
            onInsertToken={handleInsertToken}
          />
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
