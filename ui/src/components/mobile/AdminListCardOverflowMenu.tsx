import { useState, type ReactNode } from 'react';

import { MoreHorizontal } from 'lucide-react';

import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import { cn } from '@/lib/utils';

export type AdminListCardOverflowAction = {
  key: string;
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onSelect: () => void;
};

type Props = {
  /** Accessible name for the ⋯ trigger (e.g. “Actions for Meralco bill”). */
  label: string;
  sheetTitle?: string;
  actions: AdminListCardOverflowAction[];
  className?: string;
};

/**
 * Phone list-card overflow: one compact ⋯ control → bottom sheet of actions.
 * Prefer over inline edit/delete icon clusters that crowd dense rows.
 */
export function AdminListCardOverflowMenu({
  label,
  sheetTitle = 'Actions',
  actions,
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  if (actions.length === 0) return null;

  return (
    <div className={cn('shrink-0', className)} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="admin-overflow-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <MoreHorizontal className="size-3.5" aria-hidden />
      </button>
      <MobileChoiceSheet open={open} onOpenChange={setOpen} title={sheetTitle}>
        <div role="listbox" aria-label={sheetTitle}>
          {actions.map((action) => (
            <MobileChoiceItem
              key={action.key}
              label={action.label}
              icon={action.icon}
              className={
                action.destructive
                  ? 'text-destructive [&_.text-foreground]:text-destructive [&_.text-muted-foreground]:text-destructive'
                  : undefined
              }
              onSelect={() => {
                action.onSelect();
                setOpen(false);
              }}
            />
          ))}
        </div>
      </MobileChoiceSheet>
    </div>
  );
}
