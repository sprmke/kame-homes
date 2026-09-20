import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { GripVertical, MoveRight } from 'lucide-react';

import { AdminTableFlagsCell } from '@/features/dashboard/bookings/components/AdminDataTable';
import { BookingKanbanWorkflowModal } from '@/features/dashboard/bookings/components/BookingKanbanWorkflowModal';
import { BookingPropertyLabel } from '@/features/dashboard/bookings/components/BookingPropertyLabel';
import { GuestAvatar } from '@/features/dashboard/bookings/components/GuestAvatar';
import { StatusBadge } from '@/features/dashboard/bookings/components/StatusBadge';
import {
  bookingHasInvalidReceiptAi,
  bookingRequestsSurpriseDecor,
} from '@/features/dashboard/bookings/lib/bookingFlags';
import {
  canKanbanDropTo,
  KANBAN_COLUMNS,
  KANBAN_STATUS_CONFIG,
  kanbanColumnForBooking,
  kanbanValidDropTargets,
  shortStatusLabel,
} from '@/features/dashboard/bookings/lib/bookingStages';
import { statusLabel, type BookingStatus } from '@/features/dashboard/bookings/lib/bookingStatus';
import {
  DEFAULT_DOCUMENT_REQUIREMENTS,
  type DocumentRequirement,
} from '@/features/dashboard/bookings/lib/documentRequirements';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { BookingsCardGridSkeleton } from '@/components/skeletons/AdminSkeletons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatBookingDate, formatBookingDateShort } from '@/utils/format/bookingDisplay';
import { formatMoney } from '@/utils/format/currency';

type Props = {
  rows: BookingRow[];
  isLoading: boolean;
  error: string | null;
  isRefreshing?: boolean;
  showProperty?: boolean;
  /** Resolved per-property list (§4.5) — defaults to Azure-parity GAF + pet-on-has_pets. */
  documentRequirements?: DocumentRequirement[];
  /** When false, drag-to-transition is off and the modal Progress rail is read-only. */
  canMutateWorkflow?: boolean;
};

function guestName(row: BookingRow): string {
  return row.primary_guest_name || row.guest_facebook_name || row.guest_email || 'Guest';
}

function guestPax(row: BookingRow): number {
  return (row.number_of_adults ?? 0) + (row.number_of_children ?? 0);
}

function columnDroppableId(status: BookingStatus): string {
  return `col:${status}`;
}

function chipDroppableId(status: BookingStatus): string {
  return `chip:${status}`;
}

function parseDropTargetStatus(id: string | number): BookingStatus | null {
  const raw = String(id);
  const status = raw.startsWith('col:')
    ? (raw.slice(4) as BookingStatus)
    : raw.startsWith('chip:')
      ? (raw.slice(5) as BookingStatus)
      : null;
  if (!status) return null;
  return (KANBAN_COLUMNS as readonly string[]).includes(status) ? status : null;
}

/** Prefer pointer-within columns; fall back to closest center for empty columns. */
const kanbanCollision: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return closestCenter(args);
};

type KanbanCardBodyProps = {
  row: BookingRow;
  showProperty: boolean;
  /** Source card while its overlay is active — dim only the placeholder. */
  isPlaceholder?: boolean;
  /** DragOverlay clone — keep fully opaque with solid surface. */
  isOverlay?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  onOpen: (row: BookingRow) => void;
  /** Keyboard/screen-reader equivalent of a drag-drop — omit to hide the menu. */
  onMoveTo?: (row: BookingRow, targetStatus: BookingStatus) => void;
  moveTargets?: BookingStatus[];
};

function KanbanCardBody({
  row,
  showProperty,
  isPlaceholder,
  isOverlay,
  dragHandleProps,
  onOpen,
  onMoveTo,
  moveTargets = [],
}: KanbanCardBodyProps) {
  const name = guestName(row);
  const pax = guestPax(row);
  const hasInvalidReceiptAi = bookingHasInvalidReceiptAi(row);
  const hasAnyFlags =
    Boolean(row.need_parking) ||
    Boolean(row.has_pets) ||
    bookingRequestsSurpriseDecor(row.guest_requests_surprise_decor) ||
    hasInvalidReceiptAi;

  return (
    <div
      onClick={() => onOpen(row)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(row);
        }
      }}
      role="button"
      tabIndex={isOverlay ? -1 : 0}
      aria-label={`Open workflow for ${name}`}
      className={cn(
        'border-border/50 group relative cursor-pointer overflow-hidden rounded-xl border shadow-sm transition-all duration-200',
        'bg-card dark:shadow-none',
        !isOverlay && 'hover:-translate-y-0.5',
        'focus-visible:ring-sidebar-primary/40 outline-none focus-visible:ring-2',
        isPlaceholder && 'opacity-40',
        isOverlay && 'border-sidebar-primary/50 shadow-elevated-lg ring-sidebar-primary/30 ring-2'
      )}
    >
      {onMoveTo && moveTargets.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/80 absolute right-8 top-1 z-10 flex size-7 items-center justify-center rounded-md opacity-70 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={`Move ${name} to another status`}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                // Stop the card's own Enter/Space "open workflow" handler from
                // also firing when this trigger is activated via keyboard —
                // Radix's own menu key handling (Enter/Space/Arrows/Escape) is
                // attached to this same element and still runs regardless.
                e.stopPropagation();
              }}
            >
              <MoveRight className="size-3.5" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {moveTargets.map((target) => (
              <DropdownMenuItem key={target} onSelect={() => onMoveTo(row, target)}>
                {statusLabel(target)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {dragHandleProps ? (
        <button
          type="button"
          className="text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/80 absolute right-1 top-1 z-10 flex size-7 cursor-grab items-center justify-center rounded-md opacity-70 transition-opacity active:cursor-grabbing group-hover:opacity-100"
          aria-label={`Drag ${name}`}
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-3.5" aria-hidden />
        </button>
      ) : null}

      <div className="p-3 pb-2">
        <div className="flex items-center gap-2.5">
          <GuestAvatar name={name} validIdUrl={row.valid_id_url} size="md" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-bold leading-tight">{name}</p>
            <p className="text-data-secondary truncate">{row.guest_email}</p>
            {showProperty ? (
              <BookingPropertyLabel name={row.property_name} className="mt-0.5 font-medium" />
            ) : null}
          </div>
        </div>

        <div className="mt-2.5">
          <p className="text-overline">Stay</p>
          <p className="text-data-primary mt-0.5 whitespace-nowrap">
            {formatBookingDateShort(row.check_in_date)}
            <span className="text-muted-foreground/50 mx-1.5 font-light">→</span>
            {formatBookingDate(row.check_out_date)}
          </p>
          <p className="text-data-secondary mt-0.5">
            {row.number_of_nights} {row.number_of_nights === 1 ? 'night' : 'nights'}
            <span className="text-muted-foreground/50 mx-1.5">·</span>
            {pax} {pax === 1 ? 'guest' : 'guests'}
          </p>
        </div>
      </div>

      <div className="border-separator bg-muted/20 dark:bg-muted/30 flex items-center justify-between gap-2 border-t px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {hasAnyFlags ? (
            <AdminTableFlagsCell
              need_parking={row.need_parking}
              has_pets={row.has_pets}
              guest_requests_surprise_decor={row.guest_requests_surprise_decor}
              has_invalid_receipt_ai={hasInvalidReceiptAi}
            />
          ) : (
            <span className="text-caption text-muted-foreground/50">No flags</span>
          )}
        </div>
        {row.booking_rate != null ? (
          <span className="text-table-amount shrink-0">{formatMoney(row.booking_rate)}</span>
        ) : null}
      </div>
    </div>
  );
}

type KanbanCardProps = {
  row: BookingRow;
  showProperty: boolean;
  onOpen: (row: BookingRow) => void;
  disabled?: boolean;
  onMoveTo?: (row: BookingRow, targetStatus: BookingStatus) => void;
  documentRequirements: DocumentRequirement[];
};

function KanbanCard({
  row,
  showProperty,
  onOpen,
  disabled,
  onMoveTo,
  documentRequirements,
}: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: row.id,
    data: { row },
    disabled,
  });
  const moveTargets = useMemo(
    () => kanbanValidDropTargets(row, documentRequirements),
    [row, documentRequirements]
  );

  return (
    <div ref={setNodeRef}>
      <KanbanCardBody
        row={row}
        showProperty={showProperty}
        isPlaceholder={isDragging}
        dragHandleProps={{ ...listeners, ...attributes }}
        onOpen={onOpen}
        onMoveTo={disabled ? undefined : onMoveTo}
        moveTargets={moveTargets}
      />
    </div>
  );
}

type KanbanColumnProps = {
  status: BookingStatus;
  rows: BookingRow[];
  showProperty: boolean;
  onOpen: (row: BookingRow) => void;
  onMoveTo?: (row: BookingRow, targetStatus: BookingStatus) => void;
  draggedRow: BookingRow | null;
  documentRequirements: DocumentRequirement[];
  columnRef?: (status: BookingStatus, el: HTMLDivElement | null) => void;
  /** Disables card drag when the member lacks workflow permission. */
  dragDisabled?: boolean;
};

function KanbanColumn({
  status,
  rows,
  showProperty,
  onOpen,
  onMoveTo,
  draggedRow,
  documentRequirements,
  columnRef,
  dragDisabled = false,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnDroppableId(status),
    data: { status },
  });
  const canDrop = draggedRow ? canKanbanDropTo(draggedRow, status, documentRequirements) : false;
  const currentCol = draggedRow ? kanbanColumnForBooking(draggedRow, documentRequirements) : null;
  const isSourceColumn = Boolean(draggedRow && currentCol === status);
  const showDropHint = Boolean(draggedRow && !isSourceColumn);

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        columnRef?.(status, el);
      }}
      className={cn(
        'border-border/50 bg-card flex flex-col rounded-xl border shadow-sm transition-[box-shadow,border-color,background-color] duration-150 dark:shadow-none',
        showDropHint &&
          canDrop &&
          'border-emerald-500/55 bg-emerald-500/[0.04] dark:border-emerald-400/50 dark:bg-emerald-500/10',
        showDropHint &&
          !canDrop &&
          'border-destructive/45 bg-destructive/[0.03] dark:border-destructive/40 dark:bg-destructive/10',
        isOver && canDrop && 'ring-2 ring-emerald-500/55 dark:ring-emerald-400/50',
        isOver && showDropHint && !canDrop && 'ring-destructive/50 ring-2',
        isOver && canDrop && 'cursor-copy',
        isOver && showDropHint && !canDrop && 'cursor-not-allowed'
      )}
    >
      <div className="border-separator flex items-center gap-2 border-b px-3 py-2.5">
        <StatusBadge status={status} className="max-w-[calc(100%-2rem)]" />
        <span className="bg-muted text-muted-foreground ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-semibold tabular-nums">
          {rows.length}
        </span>
      </div>

      <div className="min-h-[12rem] flex-1 space-y-2.5 p-2.5">
        {rows.map((row) => (
          <KanbanCard
            key={row.id}
            row={row}
            showProperty={showProperty}
            onOpen={onOpen}
            onMoveTo={onMoveTo}
            documentRequirements={documentRequirements}
            disabled={dragDisabled || Boolean(draggedRow && draggedRow.id !== row.id)}
          />
        ))}

        {rows.length === 0 ? (
          <div className="border-border/60 text-muted-foreground flex h-24 items-center justify-center rounded-lg border border-dashed text-xs">
            No bookings
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BookingsEmptyState() {
  return (
    <div className="border-border/50 bg-card flex flex-col items-center justify-center gap-3 rounded-xl border py-20 text-center">
      <div className="bg-muted flex size-9 items-center justify-center rounded-full">
        <span className="text-muted-foreground text-lg leading-none">∅</span>
      </div>
      <div>
        <p className="text-section-title text-foreground font-bold">No bookings found</p>
        <p className="text-caption mt-1">Adjust your filters or clear the search.</p>
      </div>
    </div>
  );
}

function BookingsErrorState({ error }: { error: string }) {
  return (
    <div className="border-border/50 bg-card flex flex-col items-center justify-center gap-3 rounded-xl border py-20 text-center">
      <div className="flex size-9 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/15">
        <span className="text-base font-black leading-none text-red-500">!</span>
      </div>
      <div>
        <p className="text-section-title text-foreground font-bold">Could not load bookings</p>
        <p className="text-caption mt-1 max-w-xs">{error}</p>
      </div>
    </div>
  );
}

function KanbanDestinationChip({
  status,
  active,
  muted,
  onHover,
}: {
  status: BookingStatus;
  /** Drop target while a card is being dragged. */
  active: boolean;
  /** Invalid for the current drag — visible but not a drop target. */
  muted: boolean;
  onHover: (status: BookingStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: chipDroppableId(status),
    data: { status, kind: 'chip' },
    disabled: !active,
  });

  const fullLabel = statusLabel(status);
  const compactLabel = shortStatusLabel(status);
  const Icon = KANBAN_STATUS_CONFIG[status]?.icon;

  return (
    <div
      ref={setNodeRef}
      onPointerEnter={() => onHover(status)}
      title={fullLabel}
      aria-label={fullLabel}
      className={cn(
        'inline-flex min-h-11 items-center rounded-lg border px-2.5 text-xs font-semibold transition-colors',
        'gap-1.5',
        active &&
          cn(
            'cursor-copy border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
            'hover:bg-emerald-500/15',
            isOver && 'bg-emerald-500/20 ring-2 ring-emerald-500/50'
          ),
        !active &&
          !muted &&
          'border-border/70 bg-muted/40 text-foreground hover:bg-muted/70 cursor-pointer',
        muted && 'border-border/50 bg-muted/20 text-muted-foreground cursor-default opacity-55'
      )}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      <span className="leading-snug">{compactLabel}</span>
    </div>
  );
}

type DestinationRailProps = {
  draggedRow: BookingRow | null;
  validTargets: BookingStatus[];
  onScrollTo: (status: BookingStatus) => void;
};

/** Always mounted so the board does not jump when a drag starts. */
function KanbanDestinationRail({ draggedRow, validTargets, onScrollTo }: DestinationRailProps) {
  const validSet = useMemo(() => new Set(validTargets), [validTargets]);
  const isDragging = Boolean(draggedRow);
  const name = draggedRow ? guestName(draggedRow) : null;

  return (
    <div
      className="border-border/60 bg-card/95 supports-[backdrop-filter]:bg-card/80 sticky top-0 z-20 mb-3 min-w-0 overflow-x-hidden rounded-xl border px-3 py-2.5 shadow-sm backdrop-blur-md dark:shadow-none"
      role="region"
      aria-label={name ? `Move ${name}` : 'Jump to status column'}
    >
      <div className="flex flex-wrap gap-2">
        {KANBAN_COLUMNS.map((status) => {
          const isValidTarget = validSet.has(status);
          return (
            <KanbanDestinationChip
              key={status}
              status={status}
              active={isDragging && isValidTarget}
              muted={isDragging && !isValidTarget}
              onHover={onScrollTo}
            />
          );
        })}
      </div>
    </div>
  );
}

export function BookingKanban({
  rows,
  isLoading,
  error,
  isRefreshing,
  showProperty = false,
  documentRequirements = DEFAULT_DOCUMENT_REQUIREMENTS,
  canMutateWorkflow = true,
}: Props) {
  const [draggedRow, setDraggedRow] = useState<BookingRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [previewRow, setPreviewRow] = useState<BookingRow | null>(null);
  const [kanbanTargetStatus, setKanbanTargetStatus] = useState<BookingStatus | null>(null);
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const columnElsRef = useRef<Partial<Record<BookingStatus, HTMLDivElement | null>>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  );

  const openWorkflow = useCallback((row: BookingRow, targetStatus?: BookingStatus) => {
    setActiveBookingId(row.id);
    setPreviewRow(row);
    setKanbanTargetStatus(targetStatus ?? null);
    setModalOpen(true);
  }, []);

  const handleCardOpen = useCallback(
    (row: BookingRow) => {
      openWorkflow(row);
    },
    [openWorkflow]
  );

  /** Keyboard/screen-reader equivalent of a successful drag-drop onto a column. */
  const handleMoveTo = useCallback(
    (row: BookingRow, targetStatus: BookingStatus) => {
      if (!canMutateWorkflow) return;
      if (!canKanbanDropTo(row, targetStatus, documentRequirements)) return;
      openWorkflow(row, targetStatus);
    },
    [canMutateWorkflow, documentRequirements, openWorkflow]
  );

  const scrollColumnIntoView = useCallback((status: BookingStatus) => {
    const el = columnElsRef.current[status];
    const scroller = boardScrollRef.current;
    if (!el || !scroller) return;
    const elLeft = el.offsetLeft;
    const elRight = elLeft + el.offsetWidth;
    const viewLeft = scroller.scrollLeft;
    const viewRight = viewLeft + scroller.clientWidth;
    if (elLeft < viewLeft + 12) {
      scroller.scrollTo({ left: Math.max(0, elLeft - 16), behavior: 'smooth' });
    } else if (elRight > viewRight - 12) {
      scroller.scrollTo({
        left: elRight - scroller.clientWidth + 16,
        behavior: 'smooth',
      });
    }
  }, []);

  const setColumnEl = useCallback((status: BookingStatus, el: HTMLDivElement | null) => {
    columnElsRef.current[status] = el;
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const row = event.active.data.current?.row as BookingRow | undefined;
    if (row) setDraggedRow(row);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const row = (event.active.data.current?.row as BookingRow | undefined) ?? draggedRow;
      setDraggedRow(null);
      if (!canMutateWorkflow) return;
      const overId = event.over?.id;
      if (!row || overId == null) return;
      const targetStatus = parseDropTargetStatus(overId);
      if (!targetStatus) return;
      if (!canKanbanDropTo(row, targetStatus, documentRequirements)) return;
      openWorkflow(row, targetStatus);
    },
    [canMutateWorkflow, draggedRow, documentRequirements, openWorkflow]
  );

  const handleDragCancel = useCallback(() => {
    setDraggedRow(null);
  }, []);

  useEffect(() => {
    if (!draggedRow) return;
    const previous = document.body.style.cursor;
    document.body.style.cursor = 'grabbing';
    return () => {
      document.body.style.cursor = previous;
    };
  }, [draggedRow]);

  const validTargets = useMemo(
    () => (draggedRow ? kanbanValidDropTargets(draggedRow, documentRequirements) : []),
    [draggedRow, documentRequirements]
  );

  const rowsByStatus = useMemo(() => {
    const map = Object.fromEntries(KANBAN_COLUMNS.map((s) => [s, [] as BookingRow[]])) as Record<
      BookingStatus,
      BookingRow[]
    >;

    for (const row of rows) {
      const col = kanbanColumnForBooking(row, documentRequirements);
      if (!col || col === 'CANCELLED') continue;
      map[col]?.push(row);
    }
    return map;
  }, [rows, documentRequirements]);

  if (error) return <BookingsErrorState error={error} />;
  if (isLoading) return <BookingsCardGridSkeleton />;
  if (rows.length === 0) return <BookingsEmptyState />;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={kanbanCollision}
        autoScroll={{ threshold: { x: 0.18, y: 0.2 }, acceleration: 12 }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <KanbanDestinationRail
          draggedRow={draggedRow}
          validTargets={validTargets}
          onScrollTo={scrollColumnIntoView}
        />

        <div
          ref={boardScrollRef}
          className={cn(
            'flex gap-2.5 overflow-x-auto pb-4 transition-opacity duration-300 sm:gap-3',
            isRefreshing && 'opacity-60'
          )}
        >
          {KANBAN_COLUMNS.map((status) => (
            <div key={status} className="w-[15.5rem] shrink-0 sm:w-[16.5rem]">
              <KanbanColumn
                status={status}
                rows={rowsByStatus[status] ?? []}
                showProperty={showProperty}
                onOpen={handleCardOpen}
                onMoveTo={canMutateWorkflow ? handleMoveTo : undefined}
                draggedRow={draggedRow}
                documentRequirements={documentRequirements}
                columnRef={setColumnEl}
                dragDisabled={!canMutateWorkflow}
              />
            </div>
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {draggedRow ? (
            <div className="bg-card w-[15.5rem] rotate-1 sm:w-[16.5rem]">
              <KanbanCardBody
                row={draggedRow}
                showProperty={showProperty}
                isOverlay
                onOpen={() => undefined}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <BookingKanbanWorkflowModal
        bookingId={activeBookingId}
        open={modalOpen}
        targetStatus={kanbanTargetStatus}
        canMutate={canMutateWorkflow}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setActiveBookingId(null);
            setPreviewRow(null);
            setKanbanTargetStatus(null);
          }
        }}
        previewRow={previewRow}
      />
    </>
  );
}
