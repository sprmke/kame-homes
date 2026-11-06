import type { ComponentType } from 'react';

import { Copy, Replace, Scissors, SlidersHorizontal, Trash2, X } from 'lucide-react';

import { mobileFloatingToolbarClassName } from '@/components/mobile/BottomTabBar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Action = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

type Props = {
  canSplit: boolean;
  canReplace: boolean;
  readOnly?: boolean;
  onDone: () => void;
  onSplit: () => void;
  onEdit: () => void;
  onReplace: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

/**
 * Phone action bar for a selected clip. Replaces the editor dock while something is selected;
 * the first button clears the selection and brings the dock back. Every action is a 44 px target.
 */
export function VideoMobileActionBar({
  canSplit,
  canReplace,
  readOnly,
  onDone,
  onSplit,
  onEdit,
  onReplace,
  onDuplicate,
  onDelete,
}: Props) {
  const actions: Action[] = [
    { key: 'edit', label: 'Edit', icon: SlidersHorizontal, onSelect: onEdit },
    {
      key: 'split',
      label: 'Split',
      icon: Scissors,
      onSelect: onSplit,
      disabled: readOnly || !canSplit,
    },
    ...(canReplace
      ? [
          {
            key: 'replace',
            label: 'Replace',
            icon: Replace,
            onSelect: onReplace,
            disabled: readOnly,
          },
        ]
      : []),
    { key: 'duplicate', label: 'Copy', icon: Copy, onSelect: onDuplicate, disabled: readOnly },
    {
      key: 'delete',
      label: 'Delete',
      icon: Trash2,
      onSelect: onDelete,
      disabled: readOnly,
      destructive: true,
    },
  ];

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--mobile-bottom-bar-h)+0.5rem)] z-40 touch-manipulation px-4"
      role="toolbar"
      aria-label="Clip actions"
    >
      <div className={cn(mobileFloatingToolbarClassName, 'px-3 py-2.5')}>
        <div className="pointer-events-auto flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0"
            aria-label="Done"
            onClick={onDone}
          >
            <X className="size-4" aria-hidden />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.key}
                  type="button"
                  variant="ghost"
                  disabled={action.disabled}
                  className={cn(
                    'h-auto min-h-[44px] min-w-0 flex-1 flex-col gap-0.5 px-1 py-1 text-[10px] font-medium leading-tight',
                    action.destructive && 'text-destructive'
                  )}
                  onClick={action.onSelect}
                >
                  <Icon className="size-[18px] shrink-0" aria-hidden />
                  <span className="max-w-full truncate">{action.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
