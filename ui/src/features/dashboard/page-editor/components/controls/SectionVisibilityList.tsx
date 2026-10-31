import { PageEditorRevealTarget } from '@/features/dashboard/page-editor/lib/pageEditorPreviewScroll';

import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export type SectionVisibilityItem = {
  id: string;
  label: string;
  visible: boolean;
};

type Props = {
  items: SectionVisibilityItem[];
  onVisibilityChange: (id: string, visible: boolean) => void;
  className?: string;
  previewAnchorForItem?: (id: string) => string | null;
};

/** Fixed-order list with visibility toggles only (no drag reorder). */
export function SectionVisibilityList({
  items,
  onVisibilityChange,
  className,
  previewAnchorForItem,
}: Props) {
  return (
    <div className={cn('min-w-0', className)}>
      {items.map((item) => (
        <PageEditorRevealTarget key={item.id} anchor={previewAnchorForItem?.(item.id) ?? null}>
          <div className="border-border flex min-h-[44px] items-center gap-2 border-b px-4 py-2 last:border-b-0">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
            <Switch
              checked={item.visible}
              onCheckedChange={(checked) => onVisibilityChange(item.id, checked)}
              aria-label={`Show ${item.label}`}
            />
          </div>
        </PageEditorRevealTarget>
      ))}
    </div>
  );
}
