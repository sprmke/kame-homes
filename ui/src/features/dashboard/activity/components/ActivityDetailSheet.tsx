import type { ReactNode } from 'react';

import {
  activityActorLabel,
  activityCategoryLabel,
  ACTIVITY_SEVERITY_META,
  type ActivityEvent,
} from '@/features/dashboard/activity/lib/activityCatalog';
import {
  activityAbsoluteTime,
  activitySummaryWithoutLeadingActor,
  formatActivityActorParts,
  formatChangeValue,
  friendlyActivitySummary,
  friendlyDeviceLabel,
  friendlyMetadataFacts,
  friendlySourceLabel,
} from '@/features/dashboard/activity/lib/activityFormat';

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

type Props = {
  event: ActivityEvent | null;
  onOpenChange: (open: boolean) => void;
};

function Field({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2 py-2 text-sm sm:grid-cols-[7rem_1fr]">
      <span className="text-muted-foreground text-xs font-medium sm:text-sm">{label}</span>
      <span className="min-w-0 break-words text-sm">{value}</span>
    </div>
  );
}

export function ActivityDetailSheet({ event, onOpenChange }: Props) {
  const meta = event ? ACTIVITY_SEVERITY_META[event.severity] : null;
  const summary = event
    ? (() => {
        const friendly = friendlyActivitySummary(event.summary, event.metadata);
        const actorPrimary =
          event.actorDisplayName?.trim() ||
          event.actorEmail?.trim() ||
          activityActorLabel(event.actorType);
        return friendly.toLowerCase().startsWith(actorPrimary.toLowerCase())
          ? activitySummaryWithoutLeadingActor(friendly, actorPrimary)
          : friendly;
      })()
    : '';
  const actorParts = event
    ? formatActivityActorParts({
        displayName: event.actorDisplayName,
        email: event.actorEmail,
        typeLabel: activityActorLabel(event.actorType),
        role: event.actorRole,
      })
    : null;
  const device = event ? friendlyDeviceLabel(event.userAgent) : null;
  const detailFacts = event ? friendlyMetadataFacts(event.metadata) : [];
  const target =
    event?.targetLabel?.trim() ||
    (event?.targetId && !/^[0-9a-f-]{36}$/i.test(event.targetId) ? event.targetId : null);

  return (
    <ResponsiveModal open={Boolean(event)} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        className="flex max-h-[min(92dvh,720px)] flex-col gap-0 p-0 sm:max-w-lg"
        showCloseButton
      >
        {event && meta && actorParts ? (
          <>
            <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-1 border-b px-4 pb-3 pt-4 text-left sm:px-5">
              <ResponsiveModalTitle className="text-base leading-snug">
                {summary}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription>
                {activityCategoryLabel(event.category)}
              </ResponsiveModalDescription>
            </ResponsiveModalHeader>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
              <div className="divide-border/60 divide-y">
                <Field
                  label="Severity"
                  value={
                    <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', meta.badge)}>
                      {meta.label}
                    </span>
                  }
                />
                <Field
                  label="Actor"
                  value={
                    <>
                      {actorParts.primary}
                      {actorParts.secondary ? (
                        <span className="text-muted-foreground ml-1 text-xs">
                          ({actorParts.secondary})
                        </span>
                      ) : null}
                    </>
                  }
                />
                <Field label="When" value={activityAbsoluteTime(event.createdAt)} />
                <Field label="Source" value={friendlySourceLabel(event.source)} />
                <Field label="Target" value={target} />
                <Field label="From" value={event.ipPrefix} />
                <Field label="Device" value={device} />
                {detailFacts.map((fact) => (
                  <Field key={fact.label} label={fact.label} value={fact.value} />
                ))}
              </div>

              {event.changes && event.changes.length > 0 ? (
                <div className="mt-5">
                  <h3 className="text-section-title mb-2">Changes</h3>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[280px] text-sm">
                      <thead className="bg-muted/50 text-muted-foreground text-xs">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Field</th>
                          <th className="px-3 py-2 text-left font-medium">From</th>
                          <th className="px-3 py-2 text-left font-medium">To</th>
                        </tr>
                      </thead>
                      <tbody className="divide-border/60 divide-y">
                        {event.changes.map((c) => (
                          <tr key={c.field}>
                            <td className="px-3 py-2 align-top font-medium">
                              {c.field.replace(/_/g, ' ')}
                            </td>
                            <td className="text-muted-foreground px-3 py-2 align-top">
                              {formatChangeValue(c.from)}
                            </td>
                            <td className="px-3 py-2 align-top">{formatChangeValue(c.to)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
