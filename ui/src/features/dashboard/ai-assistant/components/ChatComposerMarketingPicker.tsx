import { LayoutTemplate } from 'lucide-react';

import { ChatComposerContextPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerContextPicker';
import {
  ChatComposerPickerRow,
  ChatComposerPickerTrigger,
} from '@/features/dashboard/ai-assistant/components/ChatComposerPickerRow';
import type { ComposerPickerSharedProps } from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';
import {
  useMarketingTemplates,
  type MarketingTemplateRecord,
} from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

const CONTENT_TYPE_LABEL: Record<MarketingTemplateRecord['contentType'], string> = {
  calendar: 'Calendar',
  design: 'Design',
  video: 'Video',
};

export function ChatComposerMarketingPicker({
  selectedIds,
  onSelect,
  disabled,
  overlayContainer,
  pageEntityId,
}: ComposerPickerSharedProps) {
  const propertyId = usePropertyIdParam();
  const { data, isLoading } = useMarketingTemplates();
  const templates = data ?? [];

  return (
    <ChatComposerContextPicker
      items={templates}
      getItemId={(template) => template.id}
      searchHaystack={(template) =>
        `${template.name} ${CONTENT_TYPE_LABEL[template.contentType]} ${template.platform ?? ''}`
      }
      groupBy={(items) => {
        const map = new Map<string, MarketingTemplateRecord[]>();
        for (const item of items) {
          const list = map.get(item.contentType) ?? [];
          list.push(item);
          map.set(item.contentType, list);
        }
        return [...map.entries()].map(([key, groupItems]) => ({
          key,
          label: CONTENT_TYPE_LABEL[key as MarketingTemplateRecord['contentType']] ?? key,
          items: groupItems,
        }));
      }}
      pageEntityId={pageEntityId}
      renderRow={(template, { selected, hint, onSelect: pick }) => (
        <ChatComposerPickerRow
          title={template.name}
          subtitle={CONTENT_TYPE_LABEL[template.contentType]}
          hint={hint}
          selected={selected}
          onSelect={pick}
        />
      )}
      selectedIds={selectedIds}
      onSelect={(template) =>
        onSelect({
          type: 'marketing_template',
          id: template.id,
          propertyId,
          label: template.name,
        })
      }
      searchPlaceholder="Template"
      searchAriaLabel="Search templates"
      listAriaLabel="Templates"
      emptyLabel="No templates"
      isLoading={isLoading}
      overlayContainer={overlayContainer}
      trigger={
        <ChatComposerPickerTrigger
          icon={LayoutTemplate}
          label="Pin a template"
          pressed={selectedIds.size > 0}
          disabled={disabled}
        />
      }
    />
  );
}
