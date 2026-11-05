import { useState } from 'react';

import { LayoutTemplate, Maximize2, Minimize2, X } from 'lucide-react';

import type { ChatTemplateSnapshot } from '@/components/chat/chatTemplateSnapshot';

import { RichTextDisplay } from '@/features/dashboard/bookings/components/property-templates/RichTextDisplay';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

const CATEGORY_LABEL: Record<ChatTemplateSnapshot['category'], string> = {
  standard: 'Stay guide',
  custom: 'Custom',
};

/** Compact card inside a chat bubble. Tapping opens the full preview. */
export function ChatTemplateCard({
  snapshot,
  onOpen,
}: {
  snapshot: ChatTemplateSnapshot;
  onOpen: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Open template ${snapshot.name}`}
      className="focus-visible:ring-ring group/template block w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
    >
      <div className="border-border/60 flex items-center gap-2 border-b px-3 py-2">
        <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
          <LayoutTemplate className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-foreground block truncate text-[13px] font-semibold">
            {snapshot.name}
          </span>
          <span className="text-muted-foreground block text-[11px]">
            {CATEGORY_LABEL[snapshot.category]}
          </span>
        </span>
        <Maximize2 className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </div>
      {snapshot.sectionImageUrl ? (
        <img
          src={snapshot.sectionImageUrl}
          alt=""
          loading="lazy"
          className="max-h-40 w-full object-cover"
        />
      ) : null}
      <div className="relative max-h-32 overflow-hidden px-3 py-2.5">
        <RichTextDisplay content={snapshot.html} className="px-0 py-0" />
        <span className="from-card pointer-events-none absolute inset-x-0 bottom-0 block h-10 bg-gradient-to-t to-transparent" />
      </div>
      <span className="text-primary flex items-center px-3 pb-2 text-[11px] font-semibold">
        View template
      </span>
    </div>
  );
}

type PreviewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: ChatTemplateSnapshot | null;
  loading?: boolean;
  action?: {
    label: string;
    pending?: boolean;
    onClick: () => void;
  };
};

/** Full template preview. Bottom sheet below `lg`, centered dialog above. */
export function ChatTemplatePreviewDialog({
  open,
  onOpenChange,
  snapshot,
  loading = false,
  action,
}: PreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const title = snapshot?.name ?? 'Template';

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next) setExpanded(false);
        onOpenChange(next);
      }}
    >
      <ResponsiveModalContent
        showCloseButton={false}
        sheetLayout="split"
        className={cn(
          'flex max-h-[min(92dvh,760px)] flex-col gap-0 p-0 sm:max-w-2xl',
          expanded &&
            'left-0 top-0 h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-0 sm:max-w-none'
        )}
        aria-describedby={undefined}
      >
        <ResponsiveModalHeader className="border-border/60 flex flex-row items-center gap-2 border-b px-4 py-3 text-left">
          <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            <LayoutTemplate className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <ResponsiveModalTitle className="truncate text-sm font-semibold sm:text-base">
              {title}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="text-muted-foreground text-[11px] sm:text-xs">
              {snapshot ? CATEGORY_LABEL[snapshot.category] : 'Loading preview'}
            </ResponsiveModalDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden min-h-[44px] min-w-[44px] lg:inline-flex"
            aria-label={expanded ? 'Exit full screen' : 'Full screen'}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? (
              <Minimize2 className="size-4" aria-hidden />
            ) : (
              <Maximize2 className="size-4" aria-hidden />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </ResponsiveModalHeader>

        <div className={cn('min-h-0 flex-1 overflow-y-auto', expanded ? 'bg-card' : '')}>
          {snapshot?.sectionImageUrl ? (
            <img
              src={snapshot.sectionImageUrl}
              alt=""
              className="max-h-[42dvh] w-full object-cover"
            />
          ) : null}
          <div className={cn('mx-auto w-full', expanded ? 'max-w-3xl px-4 py-6' : 'px-4 py-4')}>
            {snapshot ? (
              <RichTextDisplay content={snapshot.html} className="px-0 py-0" />
            ) : (
              <div className="space-y-3 py-2" aria-busy={loading}>
                <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
                <div className="bg-muted h-4 w-full animate-pulse rounded" />
                <div className="bg-muted h-4 w-5/6 animate-pulse rounded" />
                <div className="bg-muted h-24 w-full animate-pulse rounded-lg" />
              </div>
            )}
          </div>
        </div>

        {action ? (
          <div className="border-border/60 bg-card flex items-center justify-end gap-2 border-t px-4 py-3 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)]">
            <Button
              type="button"
              variant="ghost"
              className="min-h-[44px]"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-[44px]"
              disabled={action.pending || !snapshot}
              onClick={action.onClick}
            >
              {action.pending ? 'Sending…' : action.label}
            </Button>
          </div>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
