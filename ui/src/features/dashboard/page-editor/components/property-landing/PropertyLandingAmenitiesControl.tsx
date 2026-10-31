import { useState } from 'react';

import { ChevronRight, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import { LimitedCountInput } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import {
  AMENITY_CATEGORIES,
  CUSTOM_AMENITY_MAX_LENGTH,
  type CustomAmenity,
} from '@/features/dashboard/org/lib/propertySettingsConstants';

import { Button } from '@/components/ui/button';
import { CheckboxDisplay } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type Props = {
  enabledAmenities: string[];
  customAmenities: CustomAmenity[];
  onEnabledChange: (ids: string[]) => void;
  onCustomChange: (amenities: CustomAmenity[]) => void;
  disabled?: boolean;
};

export function PropertyLandingAmenitiesControl({
  enabledAmenities,
  customAmenities,
  onEnabledChange,
  onCustomChange,
  disabled = false,
}: Props) {
  const [newInputs, setNewInputs] = useState<Record<string, string>>({});

  const toggleAmenity = (amenityId: string) => {
    const next = enabledAmenities.includes(amenityId)
      ? enabledAmenities.filter((id) => id !== amenityId)
      : [...enabledAmenities, amenityId];
    onEnabledChange(next);
  };

  const addCustomAmenity = (categoryId: string) => {
    const name = newInputs[categoryId]?.trim();
    if (!name) return;
    if (name.length > CUSTOM_AMENITY_MAX_LENGTH) {
      toast.error(`Custom amenities must be ${CUSTOM_AMENITY_MAX_LENGTH} characters or fewer`);
      return;
    }
    const amenity: CustomAmenity = {
      id: `custom_${categoryId}_${Date.now()}`,
      name,
      categoryId,
    };
    onCustomChange([...customAmenities, amenity]);
    onEnabledChange([...enabledAmenities, amenity.id]);
    setNewInputs((current) => ({ ...current, [categoryId]: '' }));
  };

  const removeCustomAmenity = (amenityId: string) => {
    onCustomChange(customAmenities.filter((entry) => entry.id !== amenityId));
    onEnabledChange(enabledAmenities.filter((id) => id !== amenityId));
  };

  return (
    <div className="space-y-4 px-4 py-3">
      <p className="text-muted-foreground text-xs">
        {enabledAmenities.length} selected
        {customAmenities.length > 0 ? ` · ${customAmenities.length} custom` : ''}
      </p>

      {AMENITY_CATEGORIES.map((category) => {
        const categoryCustom = customAmenities.filter((entry) => entry.categoryId === category.id);
        const totalCount = category.amenities.length + categoryCustom.length;
        const enabledCount =
          category.amenities.filter((entry) => enabledAmenities.includes(entry.id)).length +
          categoryCustom.filter((entry) => enabledAmenities.includes(entry.id)).length;

        return (
          <Collapsible
            key={category.id}
            defaultOpen
            className="border-border bg-card overflow-hidden rounded-xl border shadow-sm"
          >
            <CollapsibleTrigger className="hover:bg-muted/40 data-[state=open]:border-border/60 data-[state=open]:bg-muted/20 group flex min-h-[44px] w-full items-center justify-between border-b border-transparent px-4 py-3 text-left transition-colors">
              <div className="flex min-w-0 items-center gap-3">
                <category.icon className="text-muted-foreground size-5 shrink-0" aria-hidden />
                <span className="truncate text-sm font-medium">{category.name}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {enabledCount}/{totalCount}
                </span>
              </div>
              <ChevronRight
                className="text-muted-foreground size-4 shrink-0 transition-transform group-data-[state=open]:rotate-90"
                aria-hidden
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3 p-4">
                <div className="grid gap-2">
                  {category.amenities.map((amenity) => {
                    const enabled = enabledAmenities.includes(amenity.id);
                    return (
                      <button
                        key={amenity.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleAmenity(amenity.id)}
                        className={cn(
                          'flex min-h-[44px] items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                          enabled
                            ? 'border-border bg-background shadow-sm'
                            : 'border-border/60 hover:bg-muted/40'
                        )}
                      >
                        <CheckboxDisplay checked={enabled} />
                        <span className="min-w-0 flex-1">{amenity.name}</span>
                      </button>
                    );
                  })}

                  {categoryCustom.map((amenity) => {
                    const enabled = enabledAmenities.includes(amenity.id);
                    return (
                      <div
                        key={amenity.id}
                        className={cn(
                          'flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2.5',
                          enabled ? 'border-border bg-background shadow-sm' : 'border-border/60'
                        )}
                      >
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleAmenity(amenity.id)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left text-sm"
                        >
                          <CheckboxDisplay checked={enabled} />
                          <span className="truncate">{amenity.name}</span>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="min-h-[44px] min-w-[44px] shrink-0"
                          disabled={disabled}
                          onClick={() => removeCustomAmenity(amenity.id)}
                          aria-label={`Remove ${amenity.name}`}
                        >
                          <X className="size-4" aria-hidden />
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-2">
                  <LimitedCountInput
                    value={newInputs[category.id] ?? ''}
                    onChange={(event) =>
                      setNewInputs((current) => ({
                        ...current,
                        [category.id]: event.target.value,
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addCustomAmenity(category.id);
                      }
                    }}
                    disabled={disabled}
                    placeholder="Add custom amenity..."
                    maxLength={CUSTOM_AMENITY_MAX_LENGTH}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled || !newInputs[category.id]?.trim()}
                    onClick={() => addCustomAmenity(category.id)}
                    className="min-h-[44px]"
                  >
                    <Plus className="mr-1 size-4" aria-hidden />
                    Add
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
