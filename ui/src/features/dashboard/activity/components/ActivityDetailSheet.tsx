import { ActivityDetailBody } from '@/features/dashboard/activity/components/ActivityDetailView';
import {
  activityCategoryLabel,
  type ActivityEvent,
} from '@/features/dashboard/activity/lib/activityCatalog';
import { buildActivityDetail } from '@/features/dashboard/activity/lib/activityFormat';

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

type Props = {
  event: ActivityEvent | null;
  onOpenChange: (open: boolean) => void;
};

export function ActivityDetailSheet({ event, onOpenChange }: Props) {
  const detail = event ? buildActivityDetail(event) : null;

  return (
    <ResponsiveModal open={Boolean(event)} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        className="flex max-h-[min(92dvh,720px)] flex-col gap-0 p-0 sm:max-w-lg"
        showCloseButton
      >
        {event && detail ? (
          <>
            <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-1 border-b px-4 pb-3 pt-4 text-left sm:px-5">
              <ResponsiveModalTitle className="text-base leading-snug">
                {detail.summary}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription>
                {activityCategoryLabel(event.category)}
              </ResponsiveModalDescription>
            </ResponsiveModalHeader>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
              <ActivityDetailBody event={event} />
            </div>
          </>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
