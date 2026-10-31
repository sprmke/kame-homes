import { useEffect, useMemo, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, HelpCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AdminListPagination,
  AdminListPerPageSelect,
} from '@/features/dashboard/bookings/components/AdminListToolbar';
import { AdminPageHeader } from '@/features/dashboard/bookings/components/AdminPageHeader';
import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { SuperAdminFaqEditorDialog } from '@/features/dashboard/super-admin/components/super-admin-support/SuperAdminFaqEditorDialog';
import { SuperAdminHelpFaqsSummaryCards } from '@/features/dashboard/super-admin/components/super-admin-support/SuperAdminHelpFaqsSummaryCards';
import {
  useDeleteHelpCenterFaq,
  useHelpCenterFaqsAdmin,
  useUpdateHelpCenterFaq,
  type AdminHelpCenterFaq,
} from '@/features/dashboard/super-admin/hooks/useHelpCenterFaqsAdmin';

import { SuperAdminAdminListBodySkeleton } from '@/components/skeletons/SuperAdminSkeletons';
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
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import {
  ADMIN_DEFAULT_PAGE_SIZE,
  buildPageItems,
  normalizeAdminPageLimit,
} from '@/lib/table/pagination';
import { cn } from '@/lib/utils';

function FaqRow({
  faq,
  onEdit,
  onDeleteRequest,
}: {
  faq: AdminHelpCenterFaq;
  onEdit: () => void;
  onDeleteRequest: () => void;
}) {
  const updateFaq = useUpdateHelpCenterFaq();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: faq.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'border-border bg-card flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4',
        !faq.is_published && 'opacity-60',
        isDragging && 'bg-accent/40 z-10 shadow-sm'
      )}
    >
      <div className="flex min-w-0 flex-1 gap-2">
        <button
          type="button"
          aria-label="Drag to reorder"
          className="text-muted-foreground hover:text-foreground -my-1 -ml-1.5 flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-medium">{faq.question}</p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{faq.answer}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Switch
          checked={faq.is_published}
          onCheckedChange={(checked) =>
            updateFaq.mutate(
              { id: faq.id, isPublished: checked },
              {
                onError: (error) => toast.error(friendlyToastError(error, 'Could not update FAQ')),
              }
            )
          }
          aria-label={faq.is_published ? 'Published' : 'Unpublished'}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Edit FAQ"
          onClick={onEdit}
          className="size-9"
        >
          <Pencil className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Delete FAQ"
          onClick={onDeleteRequest}
          className="text-destructive size-9"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export function SuperAdminHelpFaqsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');
  const limit = normalizeAdminPageLimit(
    Number(searchParams.get('limit') ?? String(ADMIN_DEFAULT_PAGE_SIZE))
  );
  const { data, isLoading, error } = useHelpCenterFaqsAdmin({ page, limit });
  const updateFaq = useUpdateHelpCenterFaq();
  const deleteFaq = useDeleteHelpCenterFaq();

  const [editingFaq, setEditingFaq] = useState<AdminHelpCenterFaq | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminHelpCenterFaq | null>(null);
  const [orderOverrides, setOrderOverrides] = useState<Record<string, string[]>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const faqs = useMemo(() => data?.faqs ?? [], [data]);
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const pageItems = buildPageItems(page, pageCount);

  const setPage = (nextPage: number) =>
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (nextPage === 1) sp.delete('page');
        else sp.set('page', String(nextPage));
        return sp;
      },
      { replace: true }
    );

  const setLimit = (nextLimit: number) =>
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (nextLimit === ADMIN_DEFAULT_PAGE_SIZE) sp.delete('limit');
        else sp.set('limit', String(nextLimit));
        sp.delete('page');
        return sp;
      },
      { replace: true }
    );

  const categories = useMemo(() => Array.from(new Set(faqs.map((f) => f.category))), [faqs]);

  const groupedByCategory = useMemo(() => {
    const byCategory = new Map<string, AdminHelpCenterFaq[]>();
    for (const faq of faqs) {
      const list = byCategory.get(faq.category) ?? [];
      list.push(faq);
      byCategory.set(faq.category, list);
    }
    return Array.from(byCategory.entries()).map(([category, items]) => {
      const overrideIds = orderOverrides[category];
      if (!overrideIds) return [category, items] as const;
      const byId = new Map(items.map((item) => [item.id, item]));
      const ordered = overrideIds
        .map((id) => byId.get(id))
        .filter((item): item is AdminHelpCenterFaq => Boolean(item));
      const missing = items.filter((item) => !overrideIds.includes(item.id));
      return [category, [...ordered, ...missing]] as const;
    });
  }, [faqs, orderOverrides]);

  // Drop the optimistic override for a category once the server-confirmed order matches it,
  // so a slow refetch never causes the list to flash back to the pre-drag order.
  useEffect(() => {
    setOrderOverrides((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      let changed = false;
      const next = { ...prev };
      for (const [category, orderIds] of Object.entries(prev)) {
        const actualIds = faqs.filter((f) => f.category === category).map((f) => f.id);
        const matches =
          actualIds.length === orderIds.length && actualIds.every((id, i) => id === orderIds[i]);
        if (matches) {
          delete next[category];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [faqs]);

  const handleDragEnd = async (category: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const list = groupedByCategory.find(([cat]) => cat === category)?.[1] ?? [];
    const oldIndex = list.findIndex((faq) => faq.id === active.id);
    const newIndex = list.findIndex((faq) => faq.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove([...list], oldIndex, newIndex);
    setOrderOverrides((prev) => ({ ...prev, [category]: reordered.map((faq) => faq.id) }));

    const targetSortOrders = list.map((faq) => faq.sort_order);
    const updates = reordered
      .map((faq, index) => ({ faq, sortOrder: targetSortOrders[index] }))
      .filter(({ faq, sortOrder }) => faq.sort_order !== sortOrder);

    try {
      await Promise.all(
        updates.map(({ faq, sortOrder }) => updateFaq.mutateAsync({ id: faq.id, sortOrder }))
      );
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not reorder FAQs'));
      setOrderOverrides((prev) => {
        const next = { ...prev };
        delete next[category];
        return next;
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteFaq.mutateAsync(deleteTarget.id);
      toast.success('FAQ deleted');
      setDeleteTarget(null);
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not delete FAQ'));
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <AdminPageHeader
        title="FAQs"
        subtitle="Curated FAQs shown to hosts."
        actions={
          <Button type="button" onClick={() => setEditingFaq('new')} className="min-h-[44px]">
            <Plus className="size-4" aria-hidden />
            Add FAQ
          </Button>
        }
      />

      {isLoading ? (
        <SuperAdminAdminListBodySkeleton metricCount={4} />
      ) : error ? (
        <p className="text-destructive text-sm">Could not load FAQs.</p>
      ) : (
        <>
          <SuperAdminHelpFaqsSummaryCards faqs={faqs} />

          <div className="flex justify-end">
            <AdminListPerPageSelect limit={limit} onChange={setLimit} />
          </div>

          {groupedByCategory.length === 0 ? (
            <SuperAdminEmptyState icon={HelpCircle} title="No FAQs yet" />
          ) : (
            groupedByCategory.map(([category, items]) => (
              <div key={category} className="space-y-2">
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                  {category}
                </p>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => void handleDragEnd(category, event)}
                >
                  <SortableContext
                    items={items.map((faq) => faq.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {items.map((faq) => (
                        <FaqRow
                          key={faq.id}
                          faq={faq}
                          onEdit={() => setEditingFaq(faq)}
                          onDeleteRequest={() => setDeleteTarget(faq)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            ))
          )}

          {pageCount > 1 ? (
            <AdminListPagination
              ariaLabel="FAQs pagination"
              page={page}
              pageCount={pageCount}
              pageItems={pageItems}
              isLoading={isLoading}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      <SuperAdminFaqEditorDialog
        faq={editingFaq}
        categories={categories}
        onOpenChange={(open) => {
          if (!open) setEditingFaq(null);
        }}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this FAQ?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from the Help & Support FAQ list for hosts. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
