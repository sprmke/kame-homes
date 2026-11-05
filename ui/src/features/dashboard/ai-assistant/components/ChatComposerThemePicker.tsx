import { Palette } from 'lucide-react';

import { ChatComposerContextPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerContextPicker';
import {
  ChatComposerPickerRow,
  ChatComposerPickerTrigger,
} from '@/features/dashboard/ai-assistant/components/ChatComposerPickerRow';
import type { ComposerPickerSharedProps } from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';
import {
  useMarketingThemes,
  type MarketingThemeRecord,
} from '@/features/dashboard/marketing/hooks/useMarketingThemes';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

export function ChatComposerThemePicker({
  selectedIds,
  onSelect,
  disabled,
  overlayContainer,
  pageEntityId,
}: ComposerPickerSharedProps) {
  const propertyId = usePropertyIdParam();
  const { data, isLoading } = useMarketingThemes();
  const themes = data?.themes ?? [];

  return (
    <ChatComposerContextPicker
      items={themes}
      getItemId={(theme) => theme.id}
      searchHaystack={(theme) => `${theme.name} ${theme.source}`}
      pageEntityId={pageEntityId}
      renderRow={(theme: MarketingThemeRecord, { selected, hint, onSelect: pick }) => (
        <ChatComposerPickerRow
          title={theme.name}
          subtitle={theme.source}
          hint={hint}
          selected={selected}
          onSelect={pick}
        />
      )}
      selectedIds={selectedIds}
      onSelect={(theme) =>
        onSelect({
          type: 'marketing_theme',
          id: theme.id,
          propertyId,
          label: theme.name,
        })
      }
      searchPlaceholder="Theme"
      searchAriaLabel="Search themes"
      listAriaLabel="Themes"
      emptyLabel="No themes"
      isLoading={isLoading}
      overlayContainer={overlayContainer}
      trigger={
        <ChatComposerPickerTrigger
          icon={Palette}
          label="Pin a theme"
          pressed={selectedIds.size > 0}
          disabled={disabled}
        />
      }
    />
  );
}
