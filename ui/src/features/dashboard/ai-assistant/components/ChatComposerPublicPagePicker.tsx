import { FileText } from 'lucide-react';

import { ChatComposerContextPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerContextPicker';
import {
  ChatComposerPickerRow,
  ChatComposerPickerTrigger,
} from '@/features/dashboard/ai-assistant/components/ChatComposerPickerRow';
import type { ComposerPickerSharedProps } from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';
import {
  useCustomPages,
  type CustomPageDto,
  type CustomPageType,
} from '@/features/dashboard/custom-pages/hooks/useCustomPages';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

const PAGE_LABELS: Record<CustomPageType, string> = {
  stay_guide: 'Stay guide',
  property_showcase: 'Showcase',
};

const FALLBACK_PAGES: CustomPageDto[] = [
  { pageType: 'stay_guide', templateKey: 'stay_guide', updatedAt: '' },
];

export function ChatComposerPublicPagePicker({
  selectedIds,
  onSelect,
  disabled,
  overlayContainer,
  pageEntityId,
}: ComposerPickerSharedProps) {
  const propertyId = usePropertyIdParam();
  const { data, isLoading } = useCustomPages();
  const pages = isLoading ? [] : data && data.length > 0 ? data : FALLBACK_PAGES;

  return (
    <ChatComposerContextPicker
      items={pages}
      getItemId={(page) => page.pageType}
      searchHaystack={(page) => PAGE_LABELS[page.pageType] ?? page.pageType}
      pageEntityId={pageEntityId}
      renderRow={(page, { selected, hint, onSelect: pick }) => (
        <ChatComposerPickerRow
          title={PAGE_LABELS[page.pageType] ?? page.pageType}
          hint={hint}
          selected={selected}
          onSelect={pick}
        />
      )}
      selectedIds={selectedIds}
      onSelect={(page) =>
        onSelect({
          type: 'public_page',
          id: page.pageType,
          propertyId,
          label: PAGE_LABELS[page.pageType] ?? page.pageType,
        })
      }
      searchPlaceholder="Page"
      searchAriaLabel="Search pages"
      listAriaLabel="Pages"
      emptyLabel="No pages"
      isLoading={isLoading}
      overlayContainer={overlayContainer}
      trigger={
        <ChatComposerPickerTrigger
          icon={FileText}
          label="Pin a page"
          pressed={selectedIds.size > 0}
          disabled={disabled}
        />
      }
    />
  );
}
