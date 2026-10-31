import { Check } from 'lucide-react';

import { VideoClipThumbnail } from '@/features/dashboard/marketing/components/video-editor/VideoClipThumbnail';
import type { PropertyMediaItem } from '@/features/dashboard/marketing/lib/polotno/propertyMedia';

import { cn } from '@/lib/utils';

type Props = {
  images: PropertyMediaItem[];
  selectedUrl: string | null;
  onSelect: (url: string) => void;
  columns?: 2 | 3;
};

export function PropertyImagePicker({ images, selectedUrl, onSelect, columns = 3 }: Props) {
  if (images.length === 0) {
    return <p className="text-muted-foreground text-xs">No property media</p>;
  }

  return (
    <div className={cn('grid gap-2', columns === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
      {images.map((item) => {
        const selected = selectedUrl === item.url;
        return (
          <button
            key={item.url}
            type="button"
            aria-label={item.type === 'video' ? 'Select video' : 'Select photo'}
            aria-pressed={selected}
            onClick={() => onSelect(item.url)}
            className={cn(
              'border-border relative aspect-square overflow-hidden rounded-lg border bg-neutral-900/[0.04] shadow-sm transition-all',
              'hover:ring-primary/30 hover:shadow',
              selected ? 'ring-primary shadow-md ring-2' : 'ring-1 ring-transparent'
            )}
          >
            <VideoClipThumbnail url={item.preview} mediaType={item.type} className="size-full" />
            {selected ? (
              <span className="bg-primary absolute right-1 top-1 flex size-5 items-center justify-center rounded-full shadow-sm">
                <Check className="text-primary-foreground size-3" strokeWidth={3} aria-hidden />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
