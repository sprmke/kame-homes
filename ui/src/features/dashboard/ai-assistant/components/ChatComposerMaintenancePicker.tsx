import { format, parseISO } from 'date-fns';
import { Wrench } from 'lucide-react';

import {
  ChatComposerContextPicker,
  type ContextPickerGroup,
} from '@/features/dashboard/ai-assistant/components/ChatComposerContextPicker';
import {
  ChatComposerPickerRow,
  ChatComposerPickerTrigger,
} from '@/features/dashboard/ai-assistant/components/ChatComposerPickerRow';
import type { ComposerPickerSharedProps } from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';
import { useMaintenanceItems } from '@/features/dashboard/maintenance/hooks/useMaintenanceItems';
import {
  DEFAULT_MAINTENANCE_QUERY,
  type MaintenanceItem,
} from '@/features/dashboard/maintenance/lib/types';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

function groupByScheduledMonth(items: MaintenanceItem[]): ContextPickerGroup<MaintenanceItem>[] {
  const map = new Map<string, ContextPickerGroup<MaintenanceItem>>();
  for (const item of items) {
    const key = item.scheduled_on.slice(0, 7);
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    let label = key;
    try {
      label = format(parseISO(`${key}-01`), 'MMMM yyyy');
    } catch {
      /* keep key */
    }
    map.set(key, { key, label, items: [item] });
  }
  return [...map.values()];
}

export function ChatComposerMaintenancePicker({
  selectedIds,
  onSelect,
  disabled,
  overlayContainer,
  pageEntityId,
}: ComposerPickerSharedProps) {
  const propertyId = usePropertyIdParam();
  const { data, isLoading } = useMaintenanceItems(
    { ...DEFAULT_MAINTENANCE_QUERY, limit: 80 },
    { enabled: Boolean(propertyId) }
  );
  const items = data ?? [];

  return (
    <ChatComposerContextPicker
      items={items}
      getItemId={(item) => item.id}
      searchHaystack={(item) =>
        [item.label, item.category, item.scheduled_on, item.notes].filter(Boolean).join(' ')
      }
      groupBy={groupByScheduledMonth}
      pageEntityId={pageEntityId}
      renderRow={(item, { selected, hint, onSelect: pick }) => (
        <ChatComposerPickerRow
          title={item.label}
          subtitle={item.scheduled_on}
          hint={hint}
          selected={selected}
          onSelect={pick}
        />
      )}
      selectedIds={selectedIds}
      onSelect={(item) =>
        onSelect({
          type: 'maintenance_item',
          id: item.id,
          propertyId,
          label: item.label,
        })
      }
      searchPlaceholder="Reminder"
      searchAriaLabel="Search reminders"
      listAriaLabel="Reminders"
      emptyLabel="No reminders"
      isLoading={isLoading}
      overlayContainer={overlayContainer}
      trigger={
        <ChatComposerPickerTrigger
          icon={Wrench}
          label="Pin a reminder"
          pressed={selectedIds.size > 0}
          disabled={disabled}
        />
      }
    />
  );
}
