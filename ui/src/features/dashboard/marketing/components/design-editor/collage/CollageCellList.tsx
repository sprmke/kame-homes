import { useMemo, useRef, useState } from 'react';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { ImagesGrid } from 'openpolotno/side-panel/side-panel';
import { toast } from 'sonner';

import { PropertyMediaUploadButton } from '@/features/dashboard/marketing/components/design-editor/polotno/PropertyMediaUploadButton';
import {
  mergePropertyMediaItems,
  type MarketingUploads,
} from '@/features/dashboard/marketing/components/design-editor/polotno/useMarketingUploads';
import { useUploadMarketingAsset } from '@/features/dashboard/marketing/hooks/useUploadMarketingAsset';
import {
  clearCollageCell,
  enterCellCropMode,
  fillCollageCells,
  getCollageCells,
  getSelectedCollageCellId,
  selectCollageCell,
  setCollageCellPhoto,
  swapCollageCells,
} from '@/features/dashboard/marketing/lib/collage/collageStoreOps';
import type { CollageCellState } from '@/features/dashboard/marketing/lib/collage/collageTypes';
import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';
import type { PropertyMediaItem } from '@/features/dashboard/marketing/lib/polotno/propertyMedia';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PropertyMediaGridItem = { url: string; preview: string };

type CellThumbProps = {
  cell: CollageCellState;
  selected: boolean;
  onSelect: () => void;
};

function CellThumb({ cell, selected, onSelect }: CellThumbProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cell.cellId,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
      className={cn(
        'bg-muted relative aspect-square min-h-[44px] touch-manipulation overflow-hidden rounded-lg',
        selected ? 'ring-primary ring-2 ring-offset-2' : 'ring-border ring-1',
        isDragging && 'z-20 scale-[1.03] opacity-90 shadow-lg'
      )}
      {...attributes}
      {...listeners}
    >
      {cell.src ? (
        <img src={cell.src} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-xs">
          <Plus className="size-4" aria-hidden />
        </div>
      )}
    </button>
  );
}

type Props = {
  store: PolotnoStore;
  propertyImages: PropertyMediaItem[];
  uploads: MarketingUploads;
};

export const CollageCellList = observer(function CollageCellList({
  store,
  propertyImages,
  uploads,
}: Props) {
  const cells = getCollageCells(store);
  const selectedCellId = getSelectedCollageCellId(store);
  const { sessionUploads, isUploading, appendFiles } = uploads;
  const { mutateAsync: uploadAsset } = useUploadMarketingAsset();
  const [replacing, setReplacing] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const allImages = useMemo(
    () => mergePropertyMediaItems(propertyImages, sessionUploads),
    [propertyImages, sessionUploads]
  );

  const emptyCount = cells.filter((cell) => !cell.src).length;
  const selectedCell = cells.find((cell) => cell.cellId === selectedCellId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    void swapCollageCells(store, String(active.id), String(over.id));
  };

  const handleFillAll = () => {
    const urls = allImages.map((item) => item.url);
    if (!urls.length) {
      toast.error('No photos yet. Upload one first');
      return;
    }
    void fillCollageCells(store, urls);
  };

  const handlePhotoSelect = (url: string) => {
    const targetCellId = selectedCellId ?? cells.find((cell) => !cell.src)?.cellId;
    if (!targetCellId) {
      toast.error('Every cell is full. Select one to replace it');
      return;
    }
    void setCollageCellPhoto(store, targetCellId, url);
  };

  const handleReplaceFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !selectedCellId) return;
    setReplacing(true);
    try {
      const result = await uploadAsset(file);
      await setCollageCellPhoto(store, selectedCellId, result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setReplacing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Cells</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[36px]"
          disabled={emptyCount === 0}
          onClick={handleFillAll}
        >
          Fill all
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={cells.map((cell) => cell.cellId)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-4 gap-2 lg:grid-cols-3">
            {cells.map((cell) => (
              <CellThumb
                key={cell.cellId}
                cell={cell}
                selected={cell.cellId === selectedCellId}
                onSelect={() => selectCollageCell(store, cell.cellId)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {selectedCell ? (
        <div className="flex flex-wrap gap-2">
          {selectedCell.src ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-[36px]"
              onClick={() => enterCellCropMode(store, selectedCell.cellId)}
            >
              Adjust photo
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-[36px]"
            disabled={replacing}
            onClick={() => replaceInputRef.current?.click()}
          >
            {replacing ? 'Uploading…' : 'Replace'}
          </Button>
          {selectedCell.src ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-[36px] gap-1"
              onClick={() => void clearCollageCell(store, selectedCell.cellId)}
            >
              <X className="size-3.5" aria-hidden />
              Clear
            </Button>
          ) : null}
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void handleReplaceFile(event.target.files);
              event.target.value = '';
            }}
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Gallery
        </p>
        <PropertyMediaUploadButton
          disabled={isUploading}
          onFilesSelected={(files) => appendFiles(files)}
        />
        {allImages.length > 0 ? (
          <div className="kame-image-grid">
            <ImagesGrid
              images={allImages}
              isLoading={isUploading}
              hideNoResults
              getPreview={(item: PropertyMediaGridItem) => item.preview}
              onSelect={(item: PropertyMediaGridItem) => handlePhotoSelect(item.url)}
            />
          </div>
        ) : (
          <p className="text-muted-foreground text-center text-sm">No images yet</p>
        )}
      </div>
    </div>
  );
});
