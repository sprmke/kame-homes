import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

import { PageEditorRevealTarget } from '@/features/dashboard/page-editor/lib/pageEditorPreviewScroll';

import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export type SectionReorderItem = {
  id: string;
  label: string;
  visible: boolean;
  lockedVisible?: boolean;
};

type Props = {
  items: SectionReorderItem[];
  onReorder: (orderedIds: string[]) => void;
  onVisibilityChange: (id: string, visible: boolean) => void;
  className?: string;
  previewAnchorForItem?: (id: string) => string | null;
};

function SortableRow({
  item,
  onVisibilityChange,
  previewAnchor,
}: {
  item: SectionReorderItem;
  onVisibilityChange: (id: string, visible: boolean) => void;
  previewAnchor: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <PageEditorRevealTarget anchor={previewAnchor}>
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
        }}
        className={cn(
          'border-border flex min-h-[44px] items-center gap-1.5 border-b px-2 py-1.5 last:border-b-0 sm:px-3',
          isDragging && 'bg-accent/40 z-10 shadow-sm'
        )}
      >
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-md"
          aria-label={`Reorder ${item.label}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
        <Switch
          checked={item.visible}
          disabled={item.lockedVisible}
          onCheckedChange={(checked) => onVisibilityChange(item.id, checked)}
          aria-label={`Show ${item.label}`}
        />
      </div>
    </PageEditorRevealTarget>
  );
}

/** Drag-reorder + visibility list for page-editor sections. */
export function SectionReorderList({
  items,
  onReorder,
  onVisibilityChange,
  className,
  previewAnchorForItem,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex).map((item) => item.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className={cn('border-border min-w-0 overflow-hidden rounded-xl border', className)}>
          {items.map((item) => (
            <SortableRow
              key={item.id}
              item={item}
              onVisibilityChange={onVisibilityChange}
              previewAnchor={previewAnchorForItem?.(item.id) ?? null}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
