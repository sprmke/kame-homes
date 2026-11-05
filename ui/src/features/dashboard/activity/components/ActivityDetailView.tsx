import { useEffect, useRef, useState, type ReactNode } from 'react';

import { ChevronLeft } from 'lucide-react';

import {
  activityCategoryLabel,
  type ActivityEvent,
} from '@/features/dashboard/activity/lib/activityCatalog';
import {
  activityAbsoluteTime,
  buildActivityDetail,
  formatChangeValue,
  friendlySourceLabel,
} from '@/features/dashboard/activity/lib/activityFormat';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function Field({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2 py-2 text-sm sm:grid-cols-[7rem_1fr]">
      <span className="text-muted-foreground text-xs font-medium sm:text-sm">{label}</span>
      <span className="min-w-0 break-words text-sm">{value}</span>
    </div>
  );
}

/** Severity / actor / source rows plus the per-field changes table. */
export function ActivityDetailBody({ event }: { event: ActivityEvent }) {
  const detail = buildActivityDetail(event);

  return (
    <>
      <div className="divide-border/60 divide-y">
        <Field
          label="Severity"
          value={
            <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', detail.meta.badge)}>
              {detail.meta.label}
            </span>
          }
        />
        <Field
          label="Actor"
          value={
            <>
              {detail.actorParts.primary}
              {detail.actorParts.secondary ? (
                <span className="text-muted-foreground ml-1 text-xs">
                  ({detail.actorParts.secondary})
                </span>
              ) : null}
            </>
          }
        />
        <Field label="When" value={activityAbsoluteTime(event.createdAt)} />
        <Field label="Source" value={friendlySourceLabel(event.source)} />
        <Field label="Target" value={detail.target} />
        <Field label="From" value={event.ipPrefix} />
        <Field label="Device" value={detail.device} />
        {detail.facts.map((fact) => (
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
    </>
  );
}

type PanelProps = {
  event: ActivityEvent | null;
  onBack: () => void;
};

/**
 * In-place detail view for the Activity log. Slides over the list inside the
 * same modal, so opening a row never stacks a second dialog on top.
 */
export function ActivityDetailPanel({ event, onBack }: PanelProps) {
  const backRef = useRef<HTMLButtonElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Keep the last event rendered while the pane slides out.
  const [shown, setShown] = useState<ActivityEvent | null>(event);

  useEffect(() => {
    if (event) setShown(event);
  }, [event]);

  useEffect(() => {
    if (!event) return;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    backRef.current?.focus({ preventScroll: true });
  }, [event]);

  // Close the detail first; the surrounding modal only sees the next Escape.
  useEffect(() => {
    if (!event) return;
    const onKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key !== 'Escape' || keyboardEvent.defaultPrevented) return;
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      onBack();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [event, onBack]);

  const open = Boolean(event);
  const detail = shown ? buildActivityDetail(shown) : null;

  return (
    <div
      className={cn(
        'bg-card absolute inset-0 flex flex-col transition-transform ease-out will-change-transform motion-reduce:transition-none',
        open ? 'translate-x-0 duration-300' : 'pointer-events-none translate-x-full duration-200'
      )}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="border-border/60 flex shrink-0 items-center gap-1 border-b pb-2">
        <Button
          ref={backRef}
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-[44px] gap-1 px-2 text-sm font-medium"
          onClick={onBack}
        >
          <ChevronLeft className="size-4" aria-hidden />
          Back
        </Button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-3">
        {shown && detail ? (
          <>
            <h2 className="text-card-title text-foreground leading-snug">{detail.summary}</h2>
            <p className="text-muted-foreground mt-1 text-xs font-medium">
              {activityCategoryLabel(shown.category)}
            </p>
            <div className="mt-3">
              <ActivityDetailBody event={shown} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
