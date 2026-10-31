import { Bell } from 'lucide-react';

import { ChatComposerContextPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerContextPicker';
import {
  ChatComposerPickerRow,
  ChatComposerPickerTrigger,
} from '@/features/dashboard/ai-assistant/components/ChatComposerPickerRow';
import {
  ASSISTANT_NOTIFICATION_MODULE_IDS,
  ASSISTANT_NOTIFICATION_MODULE_LABELS,
  type ComposerPickerSharedProps,
} from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';

const NOTIFICATION_MODULES = [...ASSISTANT_NOTIFICATION_MODULE_IDS].map((id) => ({
  id,
  label: ASSISTANT_NOTIFICATION_MODULE_LABELS[id] ?? id,
}));

export function ChatComposerNotificationPicker({
  selectedIds,
  onSelect,
  disabled,
  overlayContainer,
  pageEntityId,
}: ComposerPickerSharedProps) {
  return (
    <ChatComposerContextPicker
      items={[...NOTIFICATION_MODULES]}
      getItemId={(module) => module.id}
      searchHaystack={(module) => module.label}
      pageEntityId={pageEntityId}
      renderRow={(module, { selected, hint, onSelect: pick }) => (
        <ChatComposerPickerRow
          title={module.label}
          hint={hint}
          selected={selected}
          onSelect={pick}
        />
      )}
      selectedIds={selectedIds}
      onSelect={(module) =>
        onSelect({
          type: 'notification_module',
          id: module.id,
          label: module.label,
        })
      }
      searchPlaceholder="Module"
      searchAriaLabel="Search modules"
      listAriaLabel="Modules"
      emptyLabel="No modules"
      overlayContainer={overlayContainer}
      trigger={
        <ChatComposerPickerTrigger
          icon={Bell}
          label="Pin a module"
          pressed={selectedIds.size > 0}
          disabled={disabled}
        />
      }
    />
  );
}
