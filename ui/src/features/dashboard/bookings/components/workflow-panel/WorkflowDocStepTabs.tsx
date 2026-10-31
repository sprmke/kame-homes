/**
 * Nested Pending Documents sub-steps as tabs.
 *
 * Pending Documents is the one pipeline stage with children (GAF, parking, pet,
 * or any configured requirement). Keeping them as a tab strip inside a single
 * deck slide preserves the stage-per-slide model instead of leaking a second
 * navigation axis into the deck itself. The per-tab icon carries completion so
 * the strip doubles as the sub-step checklist.
 */

import { CheckCircle2, Circle } from 'lucide-react';

import type {
  PendingDocNestedItem,
  PendingDocNestedKey,
} from '@/features/dashboard/bookings/lib/workflow';
import { shortDocStepLabel } from '@/features/dashboard/bookings/lib/workflowStageDeck';

import { SegmentedControl } from '@/components/ui/sliding-tabs';

type Props = {
  items: PendingDocNestedItem[];
  value: PendingDocNestedKey;
  onChange: (key: PendingDocNestedKey) => void;
  disabled?: boolean;
};

export function WorkflowDocStepTabs({ items, value, onChange, disabled }: Props) {
  if (items.length < 2) return null;

  return (
    <SegmentedControl
      value={value}
      onChange={onChange}
      size="compact"
      aria-label="Document steps"
      className="w-full"
      listClassName="flex w-full"
      triggerClassName="min-w-0 flex-1 px-2 lg:px-2"
      options={items.map((item) => ({
        value: item.key,
        label: <span className="min-w-0 truncate">{shortDocStepLabel(item.label)}</span>,
        ariaLabel: `${item.label}: ${item.completed ? 'complete' : 'incomplete'}`,
        icon: item.completed ? CheckCircle2 : Circle,
        disabled,
        className: item.completed
          ? '[&>svg]:text-primary'
          : '[&>svg]:text-muted-foreground/40 [&>svg]:size-3.5',
      }))}
    />
  );
}
