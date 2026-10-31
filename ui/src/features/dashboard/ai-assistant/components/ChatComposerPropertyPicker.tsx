import { Building2 } from 'lucide-react';

import { ChatComposerContextPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerContextPicker';
import {
  ChatComposerPickerRow,
  ChatComposerPickerTrigger,
} from '@/features/dashboard/ai-assistant/components/ChatComposerPickerRow';
import type { ComposerPickerSharedProps } from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';
import { useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useOrgSlugParam, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import type { Property } from '@/features/dashboard/org/types';

function propertySubtitle(property: Property): string | undefined {
  const parts = [property.residenceName, property.tower, property.unitNumber].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function propertySearchHaystack(property: Property): string {
  return [property.name, property.slug, propertySubtitle(property), property.address]
    .filter(Boolean)
    .join(' ');
}

export function ChatComposerPropertyPicker({
  selectedIds,
  onSelect,
  disabled,
  overlayContainer,
  pageEntityId,
}: ComposerPickerSharedProps) {
  const orgSlug = useOrgSlugParam();
  const propertyId = usePropertyIdParam();
  const { data, isLoading } = useProperties(orgSlug ?? undefined);
  const properties = data?.properties ?? [];

  return (
    <ChatComposerContextPicker
      items={properties}
      getItemId={(property) => property.id}
      searchHaystack={propertySearchHaystack}
      pageEntityId={pageEntityId ?? propertyId}
      renderRow={(property, { selected, hint, onSelect: pick }) => (
        <ChatComposerPickerRow
          title={property.name}
          subtitle={propertySubtitle(property)}
          hint={hint}
          selected={selected}
          onSelect={pick}
        />
      )}
      selectedIds={selectedIds}
      onSelect={(property) =>
        onSelect({
          type: 'property',
          id: property.id,
          propertyId: property.id,
          label: property.name,
        })
      }
      searchPlaceholder="Property"
      searchAriaLabel="Search properties"
      listAriaLabel="Properties"
      emptyLabel="No properties"
      isLoading={isLoading}
      overlayContainer={overlayContainer}
      trigger={
        <ChatComposerPickerTrigger
          icon={Building2}
          label="Pin a property"
          pressed={selectedIds.size > 0}
          disabled={disabled}
        />
      }
    />
  );
}
