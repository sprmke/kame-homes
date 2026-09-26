import { useRef, useState, type FormEvent } from 'react';

import { CalendarRange, Check, Copy, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { TierBadge, TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import {
  useAddCalendarFeed,
  useCalendarSyncSettings,
  useRemoveCalendarFeed,
  useSetExportEnabled,
  useSyncFeedNow,
} from '@/features/dashboard/pricing/hooks/useCalendarSync';
import {
  CALENDAR_PROVIDER_LABELS,
  validateAirbnbCalendarUrl,
  type CalendarSyncEvent,
  type CalendarSyncFeed,
} from '@/features/dashboard/pricing/lib/calendarSyncApi';

import { FieldLabel } from '@/components/forms/FieldLabel';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/utils/format/bookingDisplay';

const HEALTH_TONE: Record<
  CalendarSyncFeed['health'],
  { label: string; variant: 'secondary' | 'outline' | 'destructive' }
> = {
  ok: { label: 'Synced', variant: 'secondary' },
  warning: { label: 'Retrying', variant: 'outline' },
  error: { label: 'Needs fix', variant: 'destructive' },
};

function ChannelSyncBodySkeleton() {
  return (
    <div className="space-y-5" role="status" aria-live="polite" aria-label="Loading channel sync">
      <div
        className="bg-muted grid h-10 w-full grid-cols-2 gap-1 rounded-lg p-1 max-lg:h-9"
        aria-hidden
      >
        <Skeleton className="bg-background h-full rounded-md" />
        <Skeleton className="h-full rounded-md" />
      </div>
      <div className="divide-border divide-y overflow-hidden rounded-xl border" aria-hidden>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-start gap-2 p-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="size-11 shrink-0 rounded-md" />
          </div>
        ))}
      </div>
      <Skeleton className="min-h-[44px] w-full rounded-lg" aria-hidden />
    </div>
  );
}

const FROM_AIRBNB_URL_HELP =
  'In Airbnb: open the listing Calendar → Availability → Connect calendars → Export calendar. Copy the link (starts with airbnb.com/calendar/ical/) and paste it here so those booked dates block here.';

const SHARE_WITH_AIRBNB_HELP =
  'Turns on a private calendar link for this property. Airbnb can then import your booked and blocked dates from our app.';

const PASTE_INTO_AIRBNB_HELP =
  'In Airbnb: listing Calendar → Availability → Connect calendars → Import calendar. Paste this link, name it, and save. Airbnb refreshes every few hours.';

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 min-w-[44px] shrink-0 gap-1.5"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error('Could not copy');
        }
      }}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
      <span className="sr-only">{label}</span>
    </Button>
  );
}

function eventLine(e: CalendarSyncEvent): string {
  const range = e.start_date && e.end_date ? ` ${e.start_date} → ${e.end_date}` : '';
  switch (e.action) {
    case 'block_created':
      return `Imported reservation${range}`;
    case 'block_updated':
      return `Reservation dates changed${range}`;
    case 'block_removed':
      return `Reservation removed${range}`;
    case 'conflict_detected':
      return `Conflict: overlaps another booking${range}`;
    case 'error':
      return `Sync error: ${String(e.detail?.reason ?? 'unknown')}`;
    case 'skipped':
      return `Skipped: ${String(e.detail?.reason ?? 'no change')}`;
    default:
      return `${e.action}${range}`;
  }
}

type ChannelSyncDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** View-only team members (`pricing.channels:view` without `:edit`). */
  readOnly?: boolean;
};

export function ChannelSyncDialog({
  open,
  onOpenChange,
  readOnly = false,
}: ChannelSyncDialogProps) {
  const gate = useFeatureGate('calendarSync');
  const { open: openUpgradeModal } = useUpgradeModal();
  const settings = useCalendarSyncSettings({
    enabled: open,
  });

  const addFeed = useAddCalendarFeed();
  const removeFeed = useRemoveCalendarFeed();
  const setEnabled = useSetExportEnabled();
  const syncNow = useSyncFeedNow();

  const [tab, setTab] = useState<'import' | 'export'>('import');
  const [adding, setAdding] = useState(false);
  const [icsUrl, setIcsUrl] = useState('');
  const [urlTouched, setUrlTouched] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<CalendarSyncFeed | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  /** Nested AlertDialog dismiss can bubble and close the parent modal — suppress briefly. */
  const suppressParentCloseRef = useRef(false);
  const nestedConfirmOpen = !!pendingRemove;

  const data = settings.data;
  const feeds = data?.feeds ?? [];
  const exportUrl = data?.export.urls?.airbnb ?? '';
  const exportEnabled = data?.export.enabled ?? false;
  const recentEvents = data?.recentEvents ?? [];
  const showAddForm = !readOnly && (adding || feeds.length === 0);
  const validationError = validateAirbnbCalendarUrl(icsUrl);
  /** Show errors only after the host types/changes the field (not on tab switch / blur). */
  const urlError = urlTouched ? validationError : null;
  /** Connect stays disabled until the URL passes Airbnb validation. */
  const canConnect = !validationError && !addFeed.isPending;

  const requireCalendarSyncPlan = (): boolean => {
    if (gate.canUse) return true;
    if (!gate.isLoading) openUpgradeModal('calendarSync');
    return false;
  };

  const resetAddForm = () => {
    setIcsUrl('');
    setUrlTouched(false);
    setAdding(false);
  };

  const closeNestedConfirm = (close: () => void) => {
    suppressParentCloseRef.current = true;
    close();
    window.setTimeout(() => {
      suppressParentCloseRef.current = false;
    }, 150);
  };

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    setUrlTouched(true);
    const error = validateAirbnbCalendarUrl(icsUrl);
    if (error) {
      toast.error(error);
      return;
    }
    if (!requireCalendarSyncPlan()) return;
    addFeed.mutate(
      { provider: 'airbnb', icsUrl: icsUrl.trim() },
      { onSuccess: () => resetAddForm() }
    );
  };

  const handleExportEnabledChange = (enabled: boolean) => {
    if (enabled && !requireCalendarSyncPlan()) return;
    setEnabled.mutate(enabled);
  };

  const addForm = (
    <form
      className={cn('space-y-3', feeds.length > 0 && 'border-border rounded-xl border p-3')}
      onSubmit={handleAdd}
      noValidate
    >
      <div className="space-y-1.5">
        <FieldLabel
          htmlFor="channel-url"
          label="Airbnb calendar URL"
          required
          help={FROM_AIRBNB_URL_HELP}
        />
        <Input
          id="channel-url"
          value={icsUrl}
          onChange={(e) => {
            setIcsUrl(e.target.value);
            setUrlTouched(true);
          }}
          placeholder="https://www.airbnb.com/calendar/ical/…"
          className="h-11"
          inputMode="url"
          autoFocus={showAddForm && tab === 'import'}
          error={!!urlError}
          aria-invalid={urlError ? true : undefined}
          aria-describedby={urlError ? 'channel-url-error' : undefined}
        />
        {urlError ? (
          <p id="channel-url-error" className="text-destructive text-xs">
            {urlError}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2 pt-1">
        {feeds.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] flex-1"
            onClick={resetAddForm}
            disabled={addFeed.isPending}
          >
            Cancel
          </Button>
        ) : null}
        <TierBadgeAnchor feature="calendarSync" className={feeds.length > 0 ? 'flex-1' : 'w-full'}>
          <Button type="submit" className="min-h-[44px] w-full" disabled={!canConnect}>
            {addFeed.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Connect'}
          </Button>
        </TierBadgeAnchor>
      </div>
    </form>
  );

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={(next) => {
          if (!next && (suppressParentCloseRef.current || nestedConfirmOpen)) return;
          if (!next) {
            resetAddForm();
            setTab('import');
            setActivityOpen(false);
          }
          onOpenChange(next);
        }}
      >
        <ResponsiveModalContent
          sheetLayout="split"
          className={cn(
            'flex max-h-[min(92dvh,44rem)] w-[min(calc(100vw-1.5rem),36rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(95vw,36rem)] sm:p-0'
          )}
          onEscapeKeyDown={(event) => {
            if (nestedConfirmOpen) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (nestedConfirmOpen) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (nestedConfirmOpen) event.preventDefault();
          }}
          onFocusOutside={(event) => {
            if (nestedConfirmOpen) event.preventDefault();
          }}
        >
          <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-0 border-b px-4 py-3 text-left sm:px-5 sm:py-4">
            <ResponsiveModalTitle className="text-base sm:text-lg">
              Channel sync
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="sr-only">
              Connect your Airbnb calendar so availability stays in sync.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5">
            {gate.isLoading || settings.isLoading ? (
              <ChannelSyncBodySkeleton />
            ) : settings.isError ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-destructive text-sm">
                  {(settings.error as Error)?.message ?? 'Could not load channel sync'}
                </p>
                <Button type="button" variant="outline" onClick={() => settings.refetch()}>
                  Retry
                </Button>
              </div>
            ) : (
              <Tabs
                value={tab}
                onValueChange={(v) => {
                  const next = v as 'import' | 'export';
                  setTab(next);
                  // Blur/tab switch must not leave a Required error on an empty field.
                  if (next !== 'import' && !icsUrl.trim()) setUrlTouched(false);
                }}
                className="space-y-5"
              >
                <TabsList className="grid h-10 w-full grid-cols-2 max-lg:h-9">
                  <TabsTrigger value="import" className="h-8 max-lg:h-7 max-lg:text-xs">
                    From Airbnb
                    {feeds.length > 0 ? (
                      <span className="text-muted-foreground ml-1.5 tabular-nums">
                        {feeds.length}
                      </span>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="export" className="h-8 max-lg:h-7 max-lg:text-xs">
                    To Airbnb
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="import" className="mt-0 space-y-4 focus-visible:ring-0">
                  {feeds.length === 0 && readOnly ? (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <div className="bg-muted/80 flex size-12 items-center justify-center rounded-full">
                        <CalendarRange className="text-muted-foreground size-5" aria-hidden />
                      </div>
                      <p className="text-foreground text-sm font-medium">No Airbnb calendar</p>
                      <p className="text-muted-foreground max-w-[18rem] text-xs">
                        No Airbnb calendar is connected for this property.
                      </p>
                    </div>
                  ) : (
                    <>
                      {feeds.length > 0 ? (
                        <ul className="divide-border divide-y overflow-hidden rounded-xl border">
                          {feeds.map((feed) => {
                            const tone = HEALTH_TONE[feed.health];
                            const name = feed.label || CALENDAR_PROVIDER_LABELS[feed.provider];
                            return (
                              <li key={feed.id} className="flex items-start gap-2 p-3">
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium">{name}</span>
                                    <Badge variant={tone.variant}>{tone.label}</Badge>
                                  </div>
                                  <p className="text-muted-foreground text-xs">
                                    {feed.lastSuccessAt
                                      ? `Synced ${formatRelative(feed.lastSuccessAt)}`
                                      : 'Not synced yet'}
                                    {feed.health === 'error' && feed.lastError
                                      ? ` · ${feed.lastError}`
                                      : ''}
                                  </p>
                                </div>
                                {!readOnly ? (
                                  <div className="flex shrink-0 items-center gap-0.5">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="size-11"
                                      disabled={syncNow.isPending && syncNow.variables === feed.id}
                                      onClick={() => syncNow.mutate(feed.id)}
                                      aria-label={`Sync ${name} now`}
                                    >
                                      {syncNow.isPending && syncNow.variables === feed.id ? (
                                        <Loader2 className="size-4 animate-spin" />
                                      ) : (
                                        <RefreshCw className="size-4" />
                                      )}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="text-muted-foreground hover:text-destructive size-11"
                                      onClick={() => setPendingRemove(feed)}
                                      aria-label={`Remove ${name}`}
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </div>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}

                      {showAddForm ? (
                        addForm
                      ) : !readOnly ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-[44px] w-full gap-1.5"
                          onClick={() => setAdding(true)}
                        >
                          <Plus className="size-4" aria-hidden />
                          Connect Airbnb
                        </Button>
                      ) : null}
                    </>
                  )}

                  {recentEvents.length > 0 ? (
                    <Collapsible open={activityOpen} onOpenChange={setActivityOpen}>
                      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex min-h-[44px] w-full items-center justify-between text-left text-sm font-medium">
                        Recent activity
                        <span className="text-xs tabular-nums">{recentEvents.length}</span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <ul className="space-y-1.5 pb-1">
                          {recentEvents.slice(0, 8).map((e) => (
                            <li
                              key={e.id}
                              className="text-muted-foreground flex justify-between gap-3 text-xs"
                            >
                              <span className="truncate">{eventLine(e)}</span>
                              <span className="shrink-0">{formatRelative(e.created_at)}</span>
                            </li>
                          ))}
                        </ul>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : null}
                </TabsContent>

                <TabsContent value="export" className="mt-0 space-y-5 focus-visible:ring-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <FieldLabel
                        htmlFor="channel-export-enabled"
                        label="Share with Airbnb"
                        help={SHARE_WITH_AIRBNB_HELP}
                        className="mb-0"
                      />
                      <TierBadge feature="calendarSync" />
                    </div>
                    <Switch
                      id="channel-export-enabled"
                      checked={exportEnabled}
                      onCheckedChange={handleExportEnabledChange}
                      disabled={readOnly || setEnabled.isPending || !data?.export.urls}
                    />
                  </div>

                  {exportEnabled && exportUrl ? (
                    <div className="space-y-1.5">
                      <FieldLabel
                        htmlFor="channel-export-url"
                        label="Paste into Airbnb"
                        help={PASTE_INTO_AIRBNB_HELP}
                      />
                      <div className="flex gap-2">
                        <Input
                          id="channel-export-url"
                          readOnly
                          value={exportUrl}
                          className="h-11 min-w-0 flex-1 font-mono text-xs"
                        />
                        <CopyButton value={exportUrl} label="Copy Airbnb export link" />
                      </div>
                    </div>
                  ) : data?.export.urls ? (
                    <p className="text-muted-foreground text-sm">
                      Turn on to copy a link for Airbnb’s import calendar.
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-sm">Export link unavailable.</p>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <AlertDialog
        open={!!pendingRemove}
        onOpenChange={(next) => {
          if (!next) closeNestedConfirm(() => setPendingRemove(null));
        }}
      >
        <AlertDialogContent onCloseAutoFocus={(event) => event.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              Imported dates stay as blocks so stays aren’t lost. Tick below to delete them too.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <RemoveFeedChoice
            key={pendingRemove?.id ?? 'none'}
            onConfirm={(deleteData) => {
              if (!pendingRemove) return;
              removeFeed.mutate(
                { feedId: pendingRemove.id, deleteData },
                {
                  onSettled: () => closeNestedConfirm(() => setPendingRemove(null)),
                }
              );
            }}
            pending={removeFeed.isPending}
          />
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RemoveFeedChoice({
  onConfirm,
  pending,
}: {
  onConfirm: (deleteData: boolean) => void;
  pending: boolean;
}) {
  const [deleteData, setDeleteData] = useState(false);
  return (
    <>
      <label className="flex min-h-[44px] items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={deleteData}
          onChange={(e) => setDeleteData(e.target.checked)}
          className="size-4"
        />
        Also delete dates this calendar added
      </label>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={(e) => {
            e.preventDefault();
            onConfirm(deleteData);
          }}
          disabled={pending}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : 'Remove'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}
