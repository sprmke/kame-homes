import { useEffect, useMemo, useState } from 'react';

import { CalendarDays, CreditCard, KeyRound, Loader2, Pin, Plus, Search, Zap } from 'lucide-react';

import { StatusBadge } from '@/features/dashboard/bookings/components/StatusBadge';
import { useAppSettings } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { type BookingRow } from '@/features/dashboard/bookings/lib/types';
import { useInboxMatchedBooking } from '@/features/dashboard/inbox/hooks/useInboxMatchedBooking';
import {
  useInboxBookingShareRows,
  useInboxPropertyShareRows,
  type InboxShareRow,
} from '@/features/dashboard/inbox/lib/inboxBookingShareRows';
import { buildCheckInPackContent } from '@/features/dashboard/inbox/lib/inboxCheckInPack';
import { formatPaymentMethodsChatText } from '@/features/dashboard/inbox/lib/inboxInsertContent';
import type { InboxPinnedSnippet } from '@/features/dashboard/inbox/lib/inboxPinnedSnippets';
import {
  bookingGuestName,
  bookingSearchHaystack,
  bookingStayRange,
} from '@/features/dashboard/inbox/lib/inboxShareBookingItems';
import type { InboxConversation, InboxTemplate } from '@/features/dashboard/inbox/types/inbox';
import { legacyGcashQrForPaymentMethods } from '@/features/dashboard/lib/storedMediaDisplay';
import { normalizePaymentMethodsDraft } from '@/features/dashboard/org/lib/paymentMethods';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';
import { buildPropertyGuestPublicPages } from '@/features/dashboard/property/lib/propertyGuestPublicPages';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** Guest pages that only open on Pro+ (`propertyShowcase`): Showcase and Stay Guide. */
const PROPERTY_SHOWCASE_PAGE_IDS = new Set(['showcase', 'stay-guide']);

function ShareRowButton({
  row,
  onSelect,
  onUpgrade,
}: {
  row: InboxShareRow;
  onSelect: (value: string) => void;
  onUpgrade?: (feature: PlanFeatureKey) => void;
}) {
  const locked = row.lockedFeature;
  const disabled = !locked && (row.pending || !row.url);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (locked) onUpgrade?.(locked);
        else if (row.url) onSelect(row.url);
      }}
      className={cn(
        'native-press focus-visible:ring-ring flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm',
        'focus-visible:outline-none focus-visible:ring-2',
        disabled ? 'text-muted-foreground/60' : 'hover:bg-muted/60'
      )}
    >
      <span className="min-w-0 flex-1 truncate">{row.label}</span>
      {locked ? <TierBadge feature={locked} /> : null}
      {!locked && row.pending ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
      ) : null}
    </button>
  );
}

function BookingResultRow({
  row,
  selected,
  onSelect,
}: {
  row: BookingRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'native-press focus-visible:ring-ring flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 py-2 text-left',
        'focus-visible:outline-none focus-visible:ring-2',
        selected ? 'bg-primary/10' : 'hover:bg-muted/60'
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-sm font-medium">
          {bookingGuestName(row)}
        </span>
        <span className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1 text-xs">
          <CalendarDays className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{bookingStayRange(row)}</span>
        </span>
      </span>
      <StatusBadge
        status={row.status}
        className="max-w-[8.5rem] shrink-0 px-1.5 py-0 text-[10px] font-semibold"
      />
    </button>
  );
}

type Props = {
  conversation: InboxConversation;
  propertySlug: string;
  propertyId: string | null;
  mapsUrl?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  templates?: InboxTemplate[];
  pinnedSnippets?: InboxPinnedSnippet[];
  mergeSnippet?: (text: string) => string;
  disabled?: boolean;
  onInsertUrl: (url: string) => void;
  onInsertText: (text: string) => void;
};

/** Unified composer insert menu: links, pages, booking docs, payment info, maps. */
export function InboxInsertMenu({
  conversation,
  propertySlug,
  propertyId,
  mapsUrl,
  checkInTime,
  checkOutTime,
  templates = [],
  pinnedSnippets = [],
  mergeSnippet,
  disabled,
  onInsertUrl,
  onInsertText,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const { canUse: canUseQuickReplies, isLoading: quickRepliesLoading } =
    useFeatureGate('quickReplies');
  const { open: openUpgradeModal } = useUpgradeModal();

  const {
    booking: matchedBooking,
    bookings,
    isLoading: bookingsLoading,
  } = useInboxMatchedBooking(conversation);

  useEffect(() => {
    if (!open) return;
    if (selectedBooking) return;
    if (matchedBooking) setSelectedBooking(matchedBooking);
  }, [open, matchedBooking, selectedBooking]);

  const propertyRows = useInboxPropertyShareRows(propertySlug);
  const bookingRows = useInboxBookingShareRows(propertySlug, selectedBooking);

  const { data: appSettings } = useAppSettings();
  const paymentMethods = useMemo(() => {
    if (!appSettings) return [];
    const legacyGcashQr = legacyGcashQrForPaymentMethods(
      appSettings.gcashQrImageUrl,
      appSettings.fieldSources.gcashQrImageUrl
    );
    return normalizePaymentMethodsDraft(appSettings.paymentMethods, {
      paymentProvider: appSettings.paymentProvider,
      gcashName: appSettings.gcashName,
      gcashNumber: appSettings.gcashNumber,
      gcashQrImageUrl: legacyGcashQr,
    });
  }, [appSettings]);

  const paymentText = useMemo(() => formatPaymentMethodsChatText(paymentMethods), [paymentMethods]);

  const { canUse: canShareLivePages, isLoading: livePagesGateLoading } =
    useFeatureGate('propertyShowcase');
  const livePagesLocked = !canShareLivePages && !livePagesGateLoading;

  const publicPages = useMemo(() => {
    if (!propertyId) return [];
    return buildPropertyGuestPublicPages(propertySlug, propertyId).filter((page) =>
      ['showcase', 'stay-guide', 'listing'].includes(page.id)
    );
  }, [propertySlug, propertyId]);

  const needle = query.trim().toLowerCase();
  const filteredBookings = needle
    ? bookings.filter((row) => bookingSearchHaystack(row).toLowerCase().includes(needle))
    : bookings;

  const closeAndReset = () => {
    setOpen(false);
    setQuery('');
    setSelectedBooking(null);
  };

  const insertUrl = (url: string) => {
    onInsertUrl(url);
    closeAndReset();
  };

  const insertText = (text: string) => {
    onInsertText(text);
    closeAndReset();
  };

  // Upgrade modal stacks above this popover; close it so focus lands in the modal.
  const openUpgrade = (feature: PlanFeatureKey) => {
    closeAndReset();
    openUpgradeModal(feature);
  };

  const insertPinnedSnippet = (body: string) => {
    const merged = mergeSnippet ? mergeSnippet(body) : body;
    insertText(merged);
  };

  const insertSnippet = (body: string) => {
    if (!canUseQuickReplies) {
      if (!quickRepliesLoading) openUpgradeModal('quickReplies');
      return;
    }
    const merged = mergeSnippet ? mergeSnippet(body) : body;
    insertText(merged);
  };

  const snippetTemplates = templates.slice(0, 8);

  const mapsLink = mapsUrl?.trim() ?? '';

  const checkInPackText = useMemo(() => {
    const stayGuideUrl = bookingRows.find((row) => row.key === 'stay-guide')?.url;
    return buildCheckInPackContent({
      propertySlug,
      checkInTime,
      checkOutTime,
      mapsUrl: mapsLink,
      stayGuideUrl,
    });
  }, [propertySlug, checkInTime, checkOutTime, mapsLink, bookingRows]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery('');
          setSelectedBooking(null);
        }
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-10 min-h-[44px] min-w-[44px]"
              disabled={disabled}
              aria-label="Insert link or info"
            >
              <Plus className="size-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">Insert</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="start"
        side="top"
        className="w-[min(calc(100vw-2rem),24rem)] p-0"
        onWheel={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="max-h-96 overflow-y-auto p-2">
          {pinnedSnippets.length > 0 ? (
            <>
              <p className="text-muted-foreground px-2 pb-1.5 pt-1 text-xs font-medium">Pinned</p>
              <div className="mb-1">
                {pinnedSnippets.map((snippet) => (
                  <button
                    key={snippet.id}
                    type="button"
                    onClick={() => insertPinnedSnippet(snippet.bodyText)}
                    className={cn(
                      'native-press focus-visible:ring-ring flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm',
                      'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2'
                    )}
                  >
                    <Pin className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium">{snippet.title}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {snippetTemplates.length > 0 ? (
            <>
              <p className="text-muted-foreground px-2 pb-1.5 pt-1 text-xs font-medium">Snippets</p>
              <div className="mb-1">
                {snippetTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => insertSnippet(template.body_text)}
                    className={cn(
                      'native-press focus-visible:ring-ring flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm',
                      'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2'
                    )}
                  >
                    <Zap className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium">{template.title}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          <p className="text-muted-foreground px-2 pb-1.5 pt-1 text-xs font-medium">Property</p>
          <div>
            {propertyRows.map((row) => (
              <ShareRowButton key={row.key} row={row} onSelect={insertUrl} />
            ))}
          </div>

          {publicPages.length > 0 ? (
            <>
              <p className="text-muted-foreground px-2 pb-1.5 pt-3 text-xs font-medium">Pages</p>
              <div>
                {publicPages.map((page) => (
                  <ShareRowButton
                    key={page.id}
                    row={{
                      key: page.id,
                      label: page.label,
                      url: `${window.location.origin}${page.path}`,
                      ...(livePagesLocked && PROPERTY_SHOWCASE_PAGE_IDS.has(page.id)
                        ? { lockedFeature: 'propertyShowcase' as const }
                        : {}),
                    }}
                    onSelect={insertUrl}
                    onUpgrade={openUpgrade}
                  />
                ))}
              </div>
            </>
          ) : null}

          {mapsLink ? (
            <>
              <p className="text-muted-foreground px-2 pb-1.5 pt-3 text-xs font-medium">Location</p>
              <ShareRowButton
                row={{ key: 'maps', label: 'Map link', url: mapsLink }}
                onSelect={insertUrl}
              />
            </>
          ) : null}

          {paymentText ? (
            <>
              <p className="text-muted-foreground px-2 pb-1.5 pt-3 text-xs font-medium">Payment</p>
              <button
                type="button"
                onClick={() => insertText(paymentText)}
                className={cn(
                  'native-press focus-visible:ring-ring flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm',
                  'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2'
                )}
              >
                <CreditCard className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">Payment methods</span>
              </button>
            </>
          ) : null}

          {checkInPackText ? (
            <>
              <p className="text-muted-foreground px-2 pb-1.5 pt-3 text-xs font-medium">Packs</p>
              <button
                type="button"
                onClick={() => insertText(checkInPackText)}
                className={cn(
                  'native-press focus-visible:ring-ring flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm',
                  'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2'
                )}
              >
                <KeyRound className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">Check-in pack</span>
              </button>
            </>
          ) : null}

          <p className="text-muted-foreground px-2 pb-1.5 pt-3 text-xs font-medium">Booking</p>
          {selectedBooking ? (
            <div className="mb-1.5">
              <BookingResultRow
                row={selectedBooking}
                selected
                onSelect={() => setSelectedBooking(null)}
              />
              {matchedBooking?.id === selectedBooking.id ? (
                <p className="text-muted-foreground px-2 pb-1 text-[11px]">Matched to this guest</p>
              ) : null}
              {bookingRows.length > 0 ? (
                <div className="border-border/60 mt-1 border-t pt-1">
                  {bookingRows.map((row) => (
                    <ShareRowButton
                      key={row.key}
                      row={row}
                      onSelect={insertUrl}
                      onUpgrade={openUpgrade}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground px-2 py-2 text-xs">
                  Nothing shareable for this booking yet.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="relative px-1 pb-1.5">
                <Search
                  className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Guest, date, or status"
                  aria-label="Search bookings"
                  className="h-9 pl-8"
                />
              </div>
              {bookingsLoading ? (
                <div className="space-y-1 p-1" aria-busy="true">
                  <Skeleton className="h-11 w-full rounded-lg" />
                  <Skeleton className="h-11 w-full rounded-lg" />
                </div>
              ) : filteredBookings.length === 0 ? (
                <p className="text-muted-foreground px-2 py-4 text-center text-sm">No bookings</p>
              ) : (
                <div role="listbox" aria-label="Bookings" className="max-h-48 overflow-y-auto">
                  {filteredBookings.map((row) => (
                    <BookingResultRow
                      key={row.id}
                      row={row}
                      selected={false}
                      onSelect={() => setSelectedBooking(row)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
