import { useState } from 'react';

import { Info, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import {
  usePropertyLifecycle,
  usePropertyLifecycleAction,
  usePropertyLifecycleImpact,
} from '@/features/dashboard/org/hooks/usePropertyLifecycle';
import { useDeleteProperty } from '@/features/dashboard/org/hooks/useDeleteProperty';
import {
  lifecyclePresentation,
  PROPERTY_LIFECYCLE_OPTIONS,
  type PropertyLifecycleAction,
  type PropertyLifecycleImpact,
} from '@/features/dashboard/org/lib/propertyLifecycle';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { semanticBadgeClasses, semanticBadgeDotClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

const ACTION_LABELS: Record<PropertyLifecycleAction, string> = {
  pause: 'Pause bookings',
  resume: 'Resume bookings',
  archive: 'Archive property',
  restore: 'Restore property',
};

const ACTION_TITLES: Record<PropertyLifecycleAction, string> = {
  pause: 'Pause new bookings?',
  resume: 'Resume new bookings?',
  archive: 'Archive this property?',
  restore: 'Restore this property?',
};

function CountLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function ImpactBody({ impact }: { impact: PropertyLifecycleImpact }) {
  const bookingCount = impact.bookings.blockingCount;
  return (
    <div className="space-y-4 text-sm">
      {bookingCount > 0 ? (
        <div className="border-destructive/40 bg-destructive/5 space-y-2 rounded-lg border p-3">
          <p className="text-destructive font-medium">Finish or cancel these bookings first.</p>
          <ul className="space-y-1">
            {impact.bookings.blocking.map((booking) => (
              <li key={booking.id} className="text-muted-foreground text-xs">
                {booking.guestName ?? 'Guest'} · {booking.status.split('_').join(' ').toLowerCase()}
                {booking.checkInDate ? ` · ${booking.checkInDate}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="font-medium">What stops</p>
        <div className="mt-1">
          <CountLine label="New bookings" value="Stops" />
          {impact.calendar.importFeeds > 0 ? (
            <CountLine label="Calendar imports" value={`${impact.calendar.importFeeds} feed(s)`} />
          ) : null}
          {impact.calendar.exportEnabled ? (
            <CountLine label="Calendar export" value="Disables" />
          ) : null}
          {impact.marketing.scheduledPosts > 0 ? (
            <CountLine label="Scheduled posts" value={`${impact.marketing.scheduledPosts}`} />
          ) : null}
        </div>
      </div>

      <div>
        <p className="font-medium">What keeps working</p>
        <div className="mt-1">
          <CountLine label="Guests with bookings" value="Stay guide and trip page" />
          <CountLine label="Refunds and reviews" value="Continue" />
        </div>
      </div>

      <div>
        <p className="font-medium">Team</p>
        <div className="mt-1">
          <CountLine
            label="Members with access"
            value={impact.team.members > 0 ? `${impact.team.members} (read only)` : 'None'}
          />
          {impact.team.pendingInvitations > 0 ? (
            <CountLine label="Pending invitations" value={`${impact.team.pendingInvitations}`} />
          ) : null}
        </div>
      </div>

      <div>
        <p className="font-medium">Billing</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {impact.subscription.billed
            ? 'Leaves your bill from the next cycle.'
            : 'Not on a paid plan right now.'}
        </p>
      </div>
    </div>
  );
}

function DeleteBody({
  impact,
  propertyName,
  confirmName,
  onConfirmNameChange,
}: {
  impact: PropertyLifecycleImpact | undefined;
  propertyName: string;
  confirmName: string;
  onConfirmNameChange: (value: string) => void;
}) {
  const blockerParts: string[] = [];
  if (impact) {
    if (impact.deleteBlockers.bookings > 0) {
      blockerParts.push(`${impact.deleteBlockers.bookings} booking(s)`);
    }
    if (impact.deleteBlockers.finance > 0) {
      blockerParts.push(
        `${impact.deleteBlockers.finance} finance entr${impact.deleteBlockers.finance === 1 ? 'y' : 'ies'}`
      );
    }
    if (impact.deleteBlockers.maintenance > 0) {
      blockerParts.push(`${impact.deleteBlockers.maintenance} maintenance item(s)`);
    }
    if (impact.deleteBlockers.importBatches > 0) {
      blockerParts.push(`${impact.deleteBlockers.importBatches} import batch(es)`);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        This can't be undone. It removes the property profile, media, and every record below.
      </p>
      {impact ? (
        <div className="rounded-lg border p-3">
          <CountLine label="Inbox threads" value={String(impact.cascade.inboxThreads)} />
          <CountLine label="Reviews" value={String(impact.cascade.reviews)} />
          <CountLine label="Payment history" value={String(impact.cascade.paymentTransactions)} />
          <CountLine label="Marketing records" value={String(impact.cascade.marketingRecords)} />
          <CountLine label="Team access" value={`${impact.team.members} member(s)`} />
        </div>
      ) : null}

      {blockerParts.length > 0 ? (
        <p className="text-destructive">
          Still referenced by {blockerParts.join(', ')}. Archive it instead.
        </p>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="delete-property-confirm" className="text-sm font-medium">
          Type {propertyName} to confirm
        </label>
        <Input
          id="delete-property-confirm"
          value={confirmName}
          onChange={(event) => onConfirmNameChange(event.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

export function PropertyListingStatusSection({
  orgSlug,
  propertyId,
  propertyName,
  canManage,
  canDelete,
  disabled = false,
  onPropertyChanged,
  onDeleted,
}: {
  orgSlug: string;
  propertyId: string;
  propertyName: string;
  canManage: boolean;
  canDelete: boolean;
  disabled?: boolean;
  onPropertyChanged?: (patch: {
    status: string;
    inactiveReason: string | null;
    archivedAt: string | null;
    pausedAt: string | null;
  }) => void;
  onDeleted?: () => void;
}) {
  const { data: lifecycle, isLoading, isError, refetch } = usePropertyLifecycle(propertyId);
  const lifecycleAction = usePropertyLifecycleAction(orgSlug);
  const deleteProperty = useDeleteProperty(orgSlug);

  const [compareOpen, setCompareOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PropertyLifecycleAction | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  const impactEnabled = pendingAction === 'archive' || deleteOpen;
  const impactQuery = usePropertyLifecycleImpact(propertyId, impactEnabled);
  const impact = impactQuery.data;

  const state = lifecycle?.state;
  const presentation = state ? lifecyclePresentation(state) : null;
  const allowed = new Set(lifecycle?.allowedActions ?? []);

  const runAction = async (action: PropertyLifecycleAction) => {
    try {
      const result = await lifecycleAction.mutateAsync({ propertyId, action });
      onPropertyChanged?.({
        status: result.property.status,
        inactiveReason: result.property.inactiveReason,
        archivedAt: result.property.archivedAt,
        pausedAt: result.property.pausedAt,
      });
      const labels: Record<PropertyLifecycleAction, string> = {
        pause: 'Bookings paused',
        resume: 'Bookings resumed',
        archive: 'Property archived',
        restore: 'Property restored',
      };
      toast.success(labels[action]);
      setPendingAction(null);
    } catch (error) {
      toast.error(friendlyToastError(error, `Could not ${action} this property`));
    }
  };

  const runDelete = async () => {
    try {
      await deleteProperty.mutateAsync({ propertyId, confirmName });
      toast.success('Property deleted');
      setDeleteOpen(false);
      onDeleted?.();
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not delete this property'));
    }
  };

  const pending = lifecycleAction.isPending;
  const deleteBlocked = (impact?.deleteBlockers.total ?? 0) > 0;

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="bg-muted/40 h-20 animate-pulse rounded-lg" aria-hidden />
      ) : isError || !lifecycle || !presentation ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <p className="text-muted-foreground text-sm">Could not load the listing status.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between sm:p-4">
            <div className="min-w-0 space-y-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                  semanticBadgeClasses(presentation.variant)
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    semanticBadgeDotClasses(presentation.variant)
                  )}
                  aria-hidden
                />
                {presentation.label}
              </span>
              <p className="text-card-description">{presentation.description}</p>
              {lifecycle.activationBlock ? (
                <p className="text-muted-foreground text-xs">{lifecycle.activationBlock.message}</p>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="settings-action gap-1.5"
                onClick={() => setCompareOpen(true)}
              >
                <Info className="size-3.5" aria-hidden />
                Compare options
              </Button>

              {allowed.has('pause') ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="settings-action"
                  disabled={disabled || pending || !canManage}
                  onClick={() => setPendingAction('pause')}
                >
                  Pause
                </Button>
              ) : null}

              {allowed.has('resume') ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="settings-action"
                  disabled={disabled || pending || !canManage}
                  onClick={() => setPendingAction('resume')}
                >
                  Resume
                </Button>
              ) : null}

              {allowed.has('archive') ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="settings-action"
                  disabled={disabled || pending || !canManage}
                  onClick={() => setPendingAction('archive')}
                >
                  Archive
                </Button>
              ) : null}

              {allowed.has('restore') ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="settings-action gap-1.5"
                  disabled={disabled || pending || !canManage}
                  onClick={() => setPendingAction('restore')}
                >
                  <ShieldCheck className="size-3.5" aria-hidden />
                  Restore
                </Button>
              ) : null}
            </div>
          </div>

          {canDelete ? (
            <div className="border-destructive/40 flex flex-col gap-2.5 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="space-y-0.5">
                <p className="text-destructive text-xs font-semibold sm:text-sm">Delete property</p>
                <p className="text-card-description">
                  Only for a property with no records. This can't be undone.
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="settings-action w-full sm:w-auto"
                disabled={disabled || deleteProperty.isPending}
                onClick={() => {
                  setConfirmName('');
                  setDeleteOpen(true);
                }}
              >
                Delete
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <ResponsiveModal open={compareOpen} onOpenChange={setCompareOpen}>
        <ResponsiveModalContent className="max-w-[min(calc(100vw-1.5rem),32rem)]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Pause, archive, or delete</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="space-y-3">
            {PROPERTY_LIFECYCLE_OPTIONS.map((option) => (
              <div key={option.key} className="rounded-lg border p-3">
                <p className="text-sm font-semibold">{option.title}</p>
                <p className="text-card-description">{option.summary}</p>
                <p className="text-muted-foreground mt-1 text-xs">Keeps: {option.keeps}</p>
                <p className="text-muted-foreground text-xs">Stops: {option.stops}</p>
              </div>
            ))}
          </div>
          <ResponsiveModalFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full sm:w-auto"
              onClick={() => setCompareOpen(false)}
            >
              Close
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <ResponsiveModal
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setPendingAction(null);
        }}
      >
        <ResponsiveModalContent className="max-w-[min(calc(100vw-1.5rem),30rem)]">
          {pendingAction ? (
            <>
              <ResponsiveModalHeader>
                <ResponsiveModalTitle>{ACTION_TITLES[pendingAction]}</ResponsiveModalTitle>
                <ResponsiveModalDescription>{propertyName}</ResponsiveModalDescription>
              </ResponsiveModalHeader>

              {pendingAction === 'archive' ? (
                impactQuery.isLoading ? (
                  <div className="bg-muted/40 h-24 animate-pulse rounded-lg" aria-hidden />
                ) : impact ? (
                  <ImpactBody impact={impact} />
                ) : null
              ) : null}

              {pendingAction === 'restore' ? (
                <p className="text-muted-foreground text-sm">
                  Calendar sync, the calendar export link, scheduled posts, Smart Pricing, Telegram,
                  and AI replies stay off until you turn them back on.
                </p>
              ) : null}

              <ResponsiveModalFooter className="flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] w-full sm:w-auto"
                  disabled={pending}
                  onClick={() => setPendingAction(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="min-h-[44px] w-full sm:w-auto"
                  disabled={
                    pending ||
                    (pendingAction === 'archive' && (impact?.bookings.blockingCount ?? 0) > 0)
                  }
                  onClick={() => void runAction(pendingAction)}
                >
                  {pending ? 'Working…' : ACTION_LABELS[pendingAction]}
                </Button>
              </ResponsiveModalFooter>
            </>
          ) : null}
        </ResponsiveModalContent>
      </ResponsiveModal>

      <ResponsiveModal
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !deleteProperty.isPending) setDeleteOpen(false);
        }}
      >
        <ResponsiveModalContent className="max-w-[min(calc(100vw-1.5rem),30rem)]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle className="text-destructive">
              Delete {propertyName}?
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>

          {impactQuery.isLoading ? (
            <div className="bg-muted/40 h-24 animate-pulse rounded-lg" aria-hidden />
          ) : (
            <DeleteBody
              impact={impact}
              propertyName={propertyName}
              confirmName={confirmName}
              onConfirmNameChange={setConfirmName}
            />
          )}

          <ResponsiveModalFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={deleteProperty.isPending}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={
                deleteProperty.isPending ||
                deleteBlocked ||
                confirmName.trim() !== propertyName.trim()
              }
              onClick={() => void runDelete()}
            >
              {deleteProperty.isPending ? 'Deleting…' : 'Delete property'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}
