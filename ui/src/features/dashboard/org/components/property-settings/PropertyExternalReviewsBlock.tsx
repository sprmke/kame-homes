import { useEffect, useMemo, useRef, useState } from 'react';

import { MessageSquare, Plus, Save, Star } from 'lucide-react';

import { GuestReviewStarRating } from '@/features/guest/sd-form/components/GuestReviewStarRating';

import { TelegramManageDialog } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramManageDialog';
import { withStorageUrlCacheBust } from '@/features/dashboard/bookings/lib/storageUrls';
import { MarketingResetConfirmDialog } from '@/features/dashboard/marketing/components/shared/MarketingResetConfirmDialog';
import { PropertyExternalReviewImageField } from '@/features/dashboard/org/components/property-settings/PropertyExternalReviewImageField';
import { PropertyExternalReviewStayPhotosField } from '@/features/dashboard/org/components/property-settings/PropertyExternalReviewStayPhotosField';
import { SettingsField } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import {
  applyExternalReviewDraftChange,
  createEmptyExternalReview,
  externalReviewDirty,
  externalReviewModerationLabel,
  externalReviewSourceLabel,
  externalReviewsAggregateLabel,
  getExternalReviewFieldErrors,
  isExternalReviewDraftValid,
  MAX_EXTERNAL_REVIEW_TEXT_LENGTH,
  MAX_PROPERTY_EXTERNAL_REVIEWS,
  type ExternalReviewSource,
  type ExternalReviewModerationStatus,
  type PropertyExternalReview,
} from '@/features/dashboard/org/lib/propertyExternalReviews';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

function aggregateToneClass(tone: ReturnType<typeof externalReviewsAggregateLabel>['tone']) {
  switch (tone) {
    case 'live':
      return 'font-medium text-emerald-800 dark:text-emerald-300';
    case 'pending':
    case 'mixed':
      return 'text-amber-800/90 dark:text-amber-200';
    default:
      return 'text-muted-foreground';
  }
}

function moderationDotClass(status: PropertyExternalReview['moderationStatus']) {
  switch (status) {
    case 'approved':
      return 'bg-emerald-500';
    case 'rejected':
      return 'bg-destructive';
    default:
      return 'bg-amber-500';
  }
}

/** New draft with only defaults — leave without prompting. */
function isPristineNewExternalReview(review: PropertyExternalReview): boolean {
  return (
    review.source === 'airbnb' &&
    !review.reviewerName.trim() &&
    !review.reviewText.trim() &&
    !review.imageUrl?.trim() &&
    review.stayPhotoUrls.length === 0 &&
    (review.starRating ?? 5) === 5
  );
}

type LeaveManageAction = { type: 'close' } | { type: 'select'; reviewId: string } | { type: 'add' };

function moderationBadgeVariant(
  status: ExternalReviewModerationStatus
): 'success' | 'secondary' | 'destructive' {
  switch (status) {
    case 'approved':
      return 'success';
    case 'rejected':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function reviewNavLabel(review: PropertyExternalReview, index: number) {
  const name = review.reviewerName.trim();
  if (name) return name;
  const snippet = review.reviewText.trim().slice(0, 32);
  if (snippet) return snippet;
  return `Review ${index + 1}`;
}

function MiniStarRating({ value, compact = false }: { value: number | null; compact?: boolean }) {
  const rating = value ?? 5;
  return (
    <span className="inline-flex items-center gap-px" aria-hidden>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            compact ? 'size-2' : 'size-3',
            star <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25'
          )}
        />
      ))}
    </span>
  );
}

function ReviewNavItem({
  review,
  index,
  selected,
  disabled,
  onSelect,
}: {
  review: PropertyExternalReview;
  index: number;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const thumbSource = review.stayPhotoUrls[0]?.trim() || review.imageUrl?.trim() || null;
  const thumb = thumbSource ? withStorageUrlCacheBust(thumbSource, null) : null;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-left transition-colors disabled:opacity-50',
        selected
          ? 'bg-primary/10 border-primary/25 border'
          : 'hover:bg-muted/50 border border-transparent'
      )}
    >
      <div
        className={cn(
          'border-border bg-muted/30 flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border',
          selected && 'border-primary/20'
        )}
      >
        {thumb ? (
          <img src={thumb} alt="" className="size-full object-cover" />
        ) : (
          <MessageSquare className="text-muted-foreground size-3.5" aria-hidden />
        )}
      </div>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-sm font-medium leading-tight',
            selected ? 'text-foreground' : 'text-foreground/90'
          )}
        >
          {reviewNavLabel(review, index)}
        </span>
        <span className="mt-1 flex items-center gap-1.5">
          <MiniStarRating value={review.starRating} />
          <span
            className={cn(
              'size-1 shrink-0 rounded-full',
              moderationDotClass(review.moderationStatus)
            )}
            aria-hidden
          />
          <span className="text-muted-foreground truncate text-[11px]">
            {externalReviewSourceLabel(review.source)}
          </span>
        </span>
      </span>
    </button>
  );
}

function ReviewMobileNavTile({
  review,
  index,
  selected,
  disabled,
  onSelect,
}: {
  review: PropertyExternalReview;
  index: number;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const thumbSource = review.stayPhotoUrls[0]?.trim() || review.imageUrl?.trim() || null;
  const thumb = thumbSource ? withStorageUrlCacheBust(thumbSource, null) : null;
  const label = reviewNavLabel(review, index);

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-label={label}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex min-h-[44px] min-w-0 flex-1 flex-col items-center gap-1 rounded-lg border px-1 py-2 transition-colors disabled:opacity-50',
        selected
          ? 'bg-primary/10 border-primary/25'
          : 'border-border/60 hover:bg-muted/40 bg-background'
      )}
    >
      <div className="relative shrink-0">
        <div
          className={cn(
            'border-border bg-muted/30 flex size-9 items-center justify-center overflow-hidden rounded-md border',
            selected && 'border-primary/20'
          )}
        >
          {thumb ? (
            <img src={thumb} alt="" className="size-full object-cover" />
          ) : (
            <MessageSquare className="text-muted-foreground size-3.5" aria-hidden />
          )}
        </div>
        <span
          className={cn(
            'ring-background absolute -right-0.5 -top-0.5 size-1.5 rounded-full ring-1',
            moderationDotClass(review.moderationStatus)
          )}
          aria-hidden
        />
      </div>
      <span className="w-full truncate text-center text-[10px] font-medium leading-tight">
        {label}
      </span>
      <MiniStarRating value={review.starRating} compact />
    </button>
  );
}

function ReviewListToolbar({
  reviewCount,
  atLimit,
  disabled,
  onAdd,
  className,
}: {
  reviewCount: number;
  atLimit: boolean;
  disabled?: boolean;
  onAdd: () => void;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 items-center justify-between gap-3', className)}>
      <span className="text-muted-foreground min-w-0 truncate text-xs font-medium tabular-nums sm:text-sm">
        {reviewCount}/{MAX_PROPERTY_EXTERNAL_REVIEWS} reviews
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || atLimit}
        className="min-h-[44px] shrink-0 gap-1.5"
        onClick={onAdd}
      >
        <Plus className="size-4" />
        Add
      </Button>
    </div>
  );
}

function ReviewEditorPanel({
  review,
  index,
  disabled,
  onChange,
  onDeleteRequest,
  deleteDisabled,
  onSaveRequest,
  saveDisabled,
  saveBusy,
  reviewDirty,
  isNewReview,
}: {
  review: PropertyExternalReview;
  index: number;
  disabled?: boolean;
  onChange: (next: PropertyExternalReview) => void;
  onDeleteRequest?: () => void;
  deleteDisabled?: boolean;
  onSaveRequest?: () => void;
  saveDisabled?: boolean;
  saveBusy?: boolean;
  reviewDirty?: boolean;
  isNewReview?: boolean;
}) {
  const fieldErrors = getExternalReviewFieldErrors(review);
  const hasStarted =
    Boolean(review.reviewerName.trim()) ||
    Boolean(review.reviewText.trim()) ||
    Boolean(review.imageUrl?.trim()) ||
    review.stayPhotoUrls.length > 0;
  const showFieldErrors = Boolean(reviewDirty) && (!isNewReview || hasStarted);
  const canSave = Boolean(reviewDirty) && isExternalReviewDraftValid(review);

  return (
    <div className="min-w-0 flex-1 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h4 className="text-foreground text-sm font-semibold sm:text-[15px]">
            Review {index + 1}
          </h4>
          <Badge variant={moderationBadgeVariant(review.moderationStatus)}>
            {externalReviewModerationLabel(review.moderationStatus)}
          </Badge>
        </div>
        {onDeleteRequest || onSaveRequest ? (
          <div className="flex shrink-0 items-center gap-2">
            {onDeleteRequest ? (
              <Button
                type="button"
                variant="outline-destructive"
                size="sm"
                disabled={deleteDisabled}
                className="h-8 px-2.5 text-xs"
                onClick={onDeleteRequest}
              >
                Delete
              </Button>
            ) : null}
            {onSaveRequest ? (
              <Button
                type="button"
                variant="outline-success"
                size="sm"
                disabled={saveDisabled || !canSave}
                className="h-8 gap-1 px-2.5 text-xs"
                onClick={onSaveRequest}
              >
                <Save className="size-3.5" aria-hidden />
                {saveBusy ? 'Saving...' : 'Save'}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsField id={`review-source-${review.id}`} label="Source" required>
            <Select
              value={review.source}
              disabled={disabled}
              onValueChange={(value: ExternalReviewSource) =>
                onChange({ ...review, source: value })
              }
            >
              <SelectTrigger id={`review-source-${review.id}`} className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="airbnb">Airbnb</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>

          <SettingsField
            id={`review-reviewer-${review.id}`}
            label="Reviewer"
            required
            error={showFieldErrors ? fieldErrors.reviewerName : null}
          >
            <Input
              id={`review-reviewer-${review.id}`}
              disabled={disabled}
              value={review.reviewerName}
              onChange={(event) => onChange({ ...review, reviewerName: event.target.value })}
              className="h-10"
              autoComplete="off"
              aria-invalid={showFieldErrors && Boolean(fieldErrors.reviewerName)}
            />
          </SettingsField>
        </div>

        <SettingsField label="Rating" required>
          <GuestReviewStarRating
            size="compact"
            value={review.starRating ?? 5}
            disabled={disabled}
            onChange={(starRating) => onChange({ ...review, starRating })}
          />
        </SettingsField>

        <SettingsField
          id={`review-text-${review.id}`}
          label="Review"
          required
          error={showFieldErrors ? fieldErrors.reviewText : null}
        >
          <div className="space-y-3">
            <Textarea
              id={`review-text-${review.id}`}
              disabled={disabled}
              value={review.reviewText}
              onChange={(event) => onChange({ ...review, reviewText: event.target.value })}
              rows={4}
              maxLength={MAX_EXTERNAL_REVIEW_TEXT_LENGTH}
              className="min-h-[112px] resize-y"
              aria-invalid={showFieldErrors && Boolean(fieldErrors.reviewText)}
            />
            <p className="text-muted-foreground text-xs tabular-nums">
              {review.reviewText.length}/{MAX_EXTERNAL_REVIEW_TEXT_LENGTH}
            </p>
          </div>
        </SettingsField>

        <SettingsField
          label="Review Images (optional)"
          error={showFieldErrors ? fieldErrors.stayPhotoUrls : null}
        >
          <PropertyExternalReviewStayPhotosField
            reviewId={review.id}
            stayPhotoUrls={review.stayPhotoUrls}
            disabled={disabled}
            onStayPhotoUrlsChange={(stayPhotoUrls) => onChange({ ...review, stayPhotoUrls })}
          />
        </SettingsField>

        <Separator className="bg-border/60" />

        <SettingsField
          label="Proof screenshot"
          required
          error={showFieldErrors ? fieldErrors.imageUrl : null}
        >
          <PropertyExternalReviewImageField
            reviewId={review.id}
            imageUrl={review.imageUrl}
            disabled={disabled}
            onImageUrlChange={(imageUrl) => onChange({ ...review, imageUrl })}
          />
        </SettingsField>
      </div>
    </div>
  );
}

export function PropertyExternalReviewsBlock({
  reviews,
  baselineReviews,
  disabled,
  onReviewsChange,
  onInteract,
  onSaveReview,
  savingReviewId,
}: {
  reviews: PropertyExternalReview[];
  baselineReviews?: PropertyExternalReview[];
  disabled?: boolean;
  onReviewsChange: (reviews: PropertyExternalReview[]) => void;
  onInteract: () => void;
  onSaveReview?: (reviewId: string) => void;
  savingReviewId?: string | null;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<LeaveManageAction | null>(null);
  /** Blocks parent dismiss while nested alert is closing (Radix outside-click race). */
  const suppressManageCloseRef = useRef(false);

  const armSuppressManageClose = () => {
    suppressManageCloseRef.current = true;
    window.setTimeout(() => {
      suppressManageCloseRef.current = false;
    }, 0);
  };

  const nestedOverlayOpen = deleteConfirmOpen || discardConfirmOpen;

  const visibleReviews = useMemo(() => reviews.slice(0, MAX_PROPERTY_EXTERNAL_REVIEWS), [reviews]);
  const reviewCount = visibleReviews.length;
  const atLimit = reviewCount >= MAX_PROPERTY_EXTERNAL_REVIEWS;
  const aggregate = externalReviewsAggregateLabel(visibleReviews);

  const selectedIndex = visibleReviews.findIndex((review) => review.id === selectedId);
  const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const activeReview = visibleReviews[activeIndex] ?? null;
  const activeReviewBaseline = activeReview
    ? baselineReviews?.find((review) => review.id === activeReview.id)
    : undefined;
  const activeReviewDirty = activeReview
    ? externalReviewDirty(activeReview, activeReviewBaseline)
    : false;
  const activeReviewSaving = activeReview != null && savingReviewId === activeReview.id;
  const activeHasUnsavedWork = Boolean(
    activeReview &&
    (activeReviewBaseline ? activeReviewDirty : !isPristineNewExternalReview(activeReview))
  );

  useEffect(() => {
    if (!manageOpen) return;
    if (visibleReviews.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!visibleReviews.some((review) => review.id === selectedId)) {
      setSelectedId(visibleReviews[0]?.id ?? null);
    }
  }, [manageOpen, visibleReviews, selectedId]);

  function updateReview(index: number, next: PropertyExternalReview) {
    onInteract();
    const current = visibleReviews[index];
    const merged = current ? applyExternalReviewDraftChange(current, next) : next;
    onReviewsChange(visibleReviews.map((review, i) => (i === index ? merged : review)));
  }

  function removeReview(id: string) {
    onInteract();
    const index = visibleReviews.findIndex((review) => review.id === id);
    const nextReviews = visibleReviews.filter((review) => review.id !== id);
    onReviewsChange(nextReviews);
    const fallback = nextReviews[Math.min(index, nextReviews.length - 1)]?.id ?? null;
    setSelectedId(fallback);
  }

  /** Drop / revert the active draft, then navigate (Add / switch / close). */
  function executeLeave(action: LeaveManageAction, revertDirty: boolean) {
    let nextReviews = visibleReviews;

    if (activeReview) {
      if (!activeReviewBaseline) {
        nextReviews = visibleReviews.filter((review) => review.id !== activeReview.id);
      } else if (revertDirty && externalReviewDirty(activeReview, activeReviewBaseline)) {
        nextReviews = visibleReviews.map((review) =>
          review.id === activeReview.id ? activeReviewBaseline : review
        );
      }
    }

    if (action.type === 'add') {
      if (nextReviews.length >= MAX_PROPERTY_EXTERNAL_REVIEWS) {
        if (nextReviews !== visibleReviews) {
          onInteract();
          onReviewsChange(nextReviews);
        }
        setSelectedId(nextReviews[nextReviews.length - 1]?.id ?? null);
        return;
      }
      const created = createEmptyExternalReview();
      onInteract();
      onReviewsChange([...nextReviews, created]);
      setSelectedId(created.id);
      return;
    }

    if (nextReviews !== visibleReviews) {
      onInteract();
      onReviewsChange(nextReviews);
    }

    if (action.type === 'select') {
      setSelectedId(action.reviewId);
      return;
    }

    setManageOpen(false);
  }

  function requestLeave(action: LeaveManageAction) {
    if (action.type === 'select' && action.reviewId === activeReview?.id) return;

    if (activeHasUnsavedWork) {
      setPendingLeave(action);
      setDiscardConfirmOpen(true);
      return;
    }

    executeLeave(action, false);
  }

  function addReview() {
    requestLeave({ type: 'add' });
  }

  return (
    <>
      <div className="bg-muted/40 flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3">
        <p className="min-w-0 text-xs font-medium sm:text-sm">
          {reviewCount} of {MAX_PROPERTY_EXTERNAL_REVIEWS} external reviews
          <span className={cn('font-normal', aggregateToneClass(aggregate.tone))}>
            {' '}
            · {aggregate.label}
          </span>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="settings-action"
          onClick={() => setManageOpen(true)}
        >
          Manage
        </Button>
      </div>

      <TelegramManageDialog
        open={manageOpen}
        onOpenChange={(open) => {
          if (open) {
            setManageOpen(true);
            return;
          }
          if (nestedOverlayOpen || suppressManageCloseRef.current) return;
          requestLeave({ type: 'close' });
        }}
        title="External reviews"
        size="sidebar"
        nestedOverlayOpen={nestedOverlayOpen}
        bodyClassName="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto py-4 md:max-h-[min(calc(92dvh-7rem),680px)] md:overflow-hidden md:py-5"
      >
        {reviewCount === 0 ? (
          <div className="border-border/60 bg-muted/10 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed px-4 py-12">
            <div className="border-border bg-background mb-4 flex size-12 items-center justify-center rounded-xl border shadow-sm">
              <MessageSquare className="text-primary size-5" aria-hidden />
            </div>
            <p className="text-muted-foreground mb-4 max-w-xs text-center text-sm leading-snug">
              Add Airbnb or Facebook reviews to show on your public listing.
            </p>
            <Button
              type="button"
              disabled={disabled}
              className="min-h-[44px] gap-2"
              onClick={addReview}
            >
              <Plus className="size-4" />
              Add review
            </Button>
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row md:overflow-hidden">
            <div
              className="md:border-border/60 flex w-full min-w-0 shrink-0 flex-col md:w-[15rem] md:border-r md:pr-4 lg:w-[18rem]"
              role="tablist"
              aria-label="Reviews"
            >
              <ReviewListToolbar
                reviewCount={reviewCount}
                atLimit={atLimit}
                disabled={disabled}
                onAdd={addReview}
                className="mb-2 shrink-0"
              />

              <div className="flex min-w-0 gap-1.5 md:hidden">
                {visibleReviews.map((review, index) => (
                  <ReviewMobileNavTile
                    key={review.id}
                    review={review}
                    index={index}
                    selected={review.id === activeReview?.id}
                    disabled={disabled}
                    onSelect={() => requestLeave({ type: 'select', reviewId: review.id })}
                  />
                ))}
              </div>

              <div className="hidden min-w-0 flex-col gap-1 md:flex md:min-h-0 md:flex-1 md:overflow-y-auto">
                {visibleReviews.map((review, index) => (
                  <ReviewNavItem
                    key={review.id}
                    review={review}
                    index={index}
                    selected={review.id === activeReview?.id}
                    disabled={disabled}
                    onSelect={() => requestLeave({ type: 'select', reviewId: review.id })}
                  />
                ))}
              </div>
            </div>

            {activeReview ? (
              <div className="border-border/60 mt-4 min-h-0 min-w-0 flex-1 border-t pb-5 sm:px-5 md:mt-0 md:overflow-y-auto md:overscroll-contain md:border-t-0">
                <ReviewEditorPanel
                  key={activeReview.id}
                  review={activeReview}
                  index={activeIndex}
                  disabled={disabled}
                  onChange={(next) => updateReview(activeIndex, next)}
                  onDeleteRequest={() => {
                    setPendingDeleteId(activeReview.id);
                    setDeleteConfirmOpen(true);
                  }}
                  deleteDisabled={disabled || Boolean(savingReviewId)}
                  onSaveRequest={onSaveReview ? () => onSaveReview(activeReview.id) : undefined}
                  saveDisabled={disabled || Boolean(savingReviewId)}
                  saveBusy={activeReviewSaving}
                  reviewDirty={activeReviewDirty}
                  isNewReview={!activeReviewBaseline}
                />
              </div>
            ) : null}
          </div>
        )}
      </TelegramManageDialog>

      <MarketingResetConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          if (!open) armSuppressManageClose();
          setDeleteConfirmOpen(open);
          if (!open) setPendingDeleteId(null);
        }}
        title="Delete review?"
        description="Save changes to remove it from your listing."
        confirmLabel="Delete"
        overlayClassName="z-[110]"
        contentClassName="z-[111]"
        onConfirm={() => {
          armSuppressManageClose();
          if (pendingDeleteId) removeReview(pendingDeleteId);
          setPendingDeleteId(null);
          setDeleteConfirmOpen(false);
        }}
      />

      <UnsavedChangesDialog
        open={discardConfirmOpen}
        action="close"
        onKeepEditing={() => {
          armSuppressManageClose();
          setDiscardConfirmOpen(false);
          setPendingLeave(null);
        }}
        onDiscard={() => {
          armSuppressManageClose();
          const action = pendingLeave;
          setPendingLeave(null);
          setDiscardConfirmOpen(false);
          if (action) executeLeave(action, true);
        }}
      />
    </>
  );
}
