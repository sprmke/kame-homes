import { ChevronRight, Plus, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import {
  LimitedCountInput,
  PropertySettingsSectionAlert,
} from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import {
  CUSTOM_PARKING_AMENITY_MAX_LENGTH,
  PARKING_AMENITY_CATEGORY,
  PARKING_AMENITY_CATEGORY_ID,
  type CustomParkingAmenity,
} from '@/features/dashboard/parking/lib/parkingFeaturesConstants';

import { Button } from '@/components/ui/button';
import { CheckboxDisplay } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export type ParkingFeaturesDraft = {
  enabledParkingAmenities: string[];
  customParkingAmenities: CustomParkingAmenity[];
};

type Props = {
  draft: ParkingFeaturesDraft;
  onChange: (next: ParkingFeaturesDraft) => void;
  disabled?: boolean;
  newCustomInput: string;
  onNewCustomInputChange: (value: string) => void;
  banner?: string;
};

export function ParkingFeaturesSection({
  draft,
  onChange,
  disabled = false,
  newCustomInput,
  onNewCustomInputChange,
  banner,
}: Props) {
  const category = PARKING_AMENITY_CATEGORY;
  const categoryCustom = draft.customParkingAmenities.filter(
    (entry) => entry.categoryId === PARKING_AMENITY_CATEGORY_ID
  );
  const totalCount = category.amenities.length + categoryCustom.length;
  const enabledCount =
    category.amenities.filter((entry) => draft.enabledParkingAmenities.includes(entry.id)).length +
    categoryCustom.filter((entry) => draft.enabledParkingAmenities.includes(entry.id)).length;

  const toggleAmenity = (amenityId: string) => {
    const next = draft.enabledParkingAmenities.includes(amenityId)
      ? draft.enabledParkingAmenities.filter((id) => id !== amenityId)
      : [...draft.enabledParkingAmenities, amenityId];
    onChange({ ...draft, enabledParkingAmenities: next });
  };

  const addCustomAmenity = () => {
    const name = newCustomInput.trim();
    if (!name) return;
    if (name.length > CUSTOM_PARKING_AMENITY_MAX_LENGTH) {
      toast.error(
        `Custom amenities must be ${CUSTOM_PARKING_AMENITY_MAX_LENGTH} characters or fewer`
      );
      return;
    }
    const amenity: CustomParkingAmenity = {
      id: `custom_${PARKING_AMENITY_CATEGORY_ID}_${Date.now()}`,
      name,
      categoryId: PARKING_AMENITY_CATEGORY_ID,
    };
    onChange({
      enabledParkingAmenities: [...draft.enabledParkingAmenities, amenity.id],
      customParkingAmenities: [...draft.customParkingAmenities, amenity],
    });
    onNewCustomInputChange('');
  };

  const removeCustomAmenity = (amenityId: string) => {
    onChange({
      customParkingAmenities: draft.customParkingAmenities.filter(
        (entry) => entry.id !== amenityId
      ),
      enabledParkingAmenities: draft.enabledParkingAmenities.filter((id) => id !== amenityId),
    });
  };

  return (
    <AdminSection
      id="features"
      title="Amenities"
      icon={Sparkles}
      description="What's included with this slot."
    >
      {banner ? <PropertySettingsSectionAlert message={banner} /> : null}

      <div className="bg-muted/40 rounded-lg border px-4 py-3">
        <p className="text-sm font-medium">
          {draft.enabledParkingAmenities.length} amenities selected
          {draft.customParkingAmenities.length > 0
            ? ` · ${draft.customParkingAmenities.length} custom`
            : ''}
        </p>
      </div>

      <Collapsible
        defaultOpen
        className="border-border bg-card overflow-hidden rounded-xl border shadow-sm"
      >
        <CollapsibleTrigger className="hover:bg-muted/40 data-[state=open]:border-border/60 data-[state=open]:bg-muted/20 group flex min-h-[44px] w-full items-center justify-between border-b border-transparent px-4 py-3 text-left transition-colors">
          <div className="flex min-w-0 items-center gap-3">
            <category.icon className="text-muted-foreground size-5 shrink-0" aria-hidden />
            <span className="truncate font-medium">{category.name}</span>
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
            <div className="grid gap-2 sm:grid-cols-2">
              {category.amenities.map((amenity) => {
                const enabled = draft.enabledParkingAmenities.includes(amenity.id);
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
                const enabled = draft.enabledParkingAmenities.includes(amenity.id);
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

            <div className="flex flex-col gap-2 sm:flex-row">
              <LimitedCountInput
                value={newCustomInput}
                onChange={(event) => onNewCustomInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addCustomAmenity();
                  }
                }}
                disabled={disabled}
                placeholder="Add custom amenity..."
                maxLength={CUSTOM_PARKING_AMENITY_MAX_LENGTH}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || !newCustomInput.trim()}
                onClick={addCustomAmenity}
                className="settings-action"
              >
                <Plus className="mr-1 size-3.5" aria-hidden />
                Add
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </AdminSection>
  );
}
