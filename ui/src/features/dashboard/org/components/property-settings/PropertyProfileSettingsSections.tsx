import { useEffect, useState } from 'react';

import {
  AlertTriangle,
  Baby,
  Bath,
  Bed,
  Home,
  Image as ImageIcon,
  Info,
  ListChecks,
  MapPin,
  Sparkles,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import {
  applyUnitTypeDefaultsToProfile,
  findUnitTypeById,
} from '@/features/dashboard/bookings/lib/unitTypes';
import { PropertyAmenitiesManageDialog } from '@/features/dashboard/org/components/property-settings/PropertyAmenitiesManageDialog';
import { PropertyCancellationPolicySection } from '@/features/dashboard/org/components/property-settings/PropertyCancellationPolicySection';
import { PropertyGuestFormSettingsSection } from '@/features/dashboard/org/components/property-settings/PropertyGuestFormSettingsSection';
import { PropertyHouseRulesManageDialog } from '@/features/dashboard/org/components/property-settings/PropertyHouseRulesManageDialog';
import { PropertyLocationSettingsBlock } from '@/features/dashboard/org/components/property-settings/PropertyLocationSettingsBlock';
import { PropertyMediaUpload } from '@/features/dashboard/org/components/property-settings/PropertyMediaUpload';
import {
  PropertySettingsSectionAlert,
  SettingsField,
} from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import { PublicPagesCrossLink } from '@/features/dashboard/org/components/property-settings/PublicPagesCrossLink';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { BrandColorField } from '@/features/dashboard/org/components/settings/BrandColorField';
import { TowerUnitConflictAlert } from '@/features/dashboard/org/components/TowerUnitConflictAlert';
import { useResidenceUnitTypes } from '@/features/dashboard/org/hooks/useResidenceUnitTypes';
import { DEFAULT_RESIDENCE_NAME } from '@/features/dashboard/org/lib/propertyDisplay';
import {
  HOUSE_RULE_CUSTOM_MAX_LENGTH,
  MUTUALLY_EXCLUSIVE_HOUSE_RULES,
  type CustomHouseRule,
} from '@/features/dashboard/org/lib/propertyHouseRulesConstants';
import type { PropertyLocationFields } from '@/features/dashboard/org/lib/propertyLocation';
import {
  clampToRange,
  getResidencePropertyDefaults,
} from '@/features/dashboard/org/lib/propertyResidenceDefaults';
import {
  getPropertyResidenceNames,
  isCondoPropertyType,
  isTowerInResidence,
} from '@/features/dashboard/org/lib/propertyResidences';
import { type PropertySettingsSectionId } from '@/features/dashboard/org/lib/propertySettingsCompletion';
import {
  CUSTOM_AMENITY_MAX_LENGTH,
  PROPERTY_TYPES,
  type CustomAmenity,
  type PropertyMediaItem,
} from '@/features/dashboard/org/lib/propertySettingsConstants';
import { propertySettingsSectionBanner } from '@/features/dashboard/org/lib/propertySettingsFieldError';
import {
  propertyGuestCapacityTotal,
  type PropertyProfileDraft,
} from '@/features/dashboard/org/lib/propertySettingsForm';
import { isValidUnitNumber } from '@/features/dashboard/org/lib/propertyTowerUnit';
import type { PropertyTowerUnitConflict } from '@/features/dashboard/org/lib/propertyTowerUnitConflict';

import { AvailabilityCheckInput } from '@/components/AvailabilityCheckInput';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TimePicker } from '@/components/ui/time-picker';
import type { AvailabilityCheckState } from '@/lib/availabilityCheckState';
import { collectPropertyPhotoUrls } from '@/lib/theme/photoBrandColor';
import { cn } from '@/lib/utils';

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5">{children}</div>;
}

type ProfileSectionsProps = {
  draft: PropertyProfileDraft;
  onChange: <K extends keyof PropertyProfileDraft>(key: K, value: PropertyProfileDraft[K]) => void;
  disabled?: boolean;
  propertySlugPrefix: string;
  slugPreview: string;
  towerConflict: PropertyTowerUnitConflict | null;
  nameUnavailable?: boolean;
  nameConflictMessage?: string | null;
  nameAvailabilityState?: AvailabilityCheckState;
  newCustomAmenityInputs: Record<string, string>;
  onNewCustomAmenityInputChange: (categoryId: string, value: string) => void;
  newCustomHouseRuleInputs: Record<string, string>;
  onNewCustomHouseRuleInputChange: (categoryId: string, value: string) => void;
  onMediaPersisted?: (media: PropertyMediaItem[]) => void;
  onPersistMediaOrder?: (media: PropertyMediaItem[]) => Promise<void>;
  mediaGalleryBusy?: boolean;
  resolveFieldError: (fieldId: string) => string | null;
  markFieldInteracted: (fieldId: string) => void;
  sectionMessages?: Partial<Record<PropertySettingsSectionId, string>>;
  brandColor: string;
  inheritedBrandColor: string;
  onBrandColorChange: (value: string) => void;
  /** Persist Location Manage modal Save to the server. */
  onPersistLocation?: (fields: PropertyLocationFields) => Promise<void>;
  locationPersistPending?: boolean;
  /** When true for a section id, that section's fields are read-only. */
  sectionEditLocked?: Partial<Record<PropertySettingsSectionId, boolean>>;
  /** When set, only these section cards render (Setup Guide step bodies). */
  visibleSectionIds?: readonly PropertySettingsSectionId[];
  /** Inline editors instead of nested Manage modals (Setup Guide). */
  embedded?: boolean;
};

export function PropertyProfileMainSections({
  draft,
  onChange,
  disabled = false,
  propertySlugPrefix,
  slugPreview,
  towerConflict,
  nameUnavailable = false,
  nameConflictMessage = null,
  nameAvailabilityState = 'idle',
  newCustomAmenityInputs,
  onNewCustomAmenityInputChange,
  newCustomHouseRuleInputs,
  onNewCustomHouseRuleInputChange,
  onMediaPersisted,
  onPersistMediaOrder,
  mediaGalleryBusy = false,
  resolveFieldError,
  markFieldInteracted,
  sectionMessages = {},
  brandColor,
  inheritedBrandColor,
  onBrandColorChange,
  onPersistLocation,
  locationPersistPending = false,
  sectionEditLocked = {},
  visibleSectionIds,
  embedded = false,
}: ProfileSectionsProps) {
  const sectionIsVisible = (sectionId: PropertySettingsSectionId) =>
    !visibleSectionIds || visibleSectionIds.includes(sectionId);
  const [amenitiesManageOpen, setAmenitiesManageOpen] = useState(false);
  const [houseRulesManageOpen, setHouseRulesManageOpen] = useState(false);
  const fieldError = resolveFieldError;
  const lock = (sectionId: PropertySettingsSectionId) =>
    disabled || Boolean(sectionEditLocked[sectionId]);

  /** Shown only on the full Settings page (not Setup Guide's embedded/inline mode). */
  const orgContext = useOptionalOrgContext();
  const publicPagesCrossLink =
    !embedded && orgContext ? (
      <PublicPagesCrossLink orgSlug={orgContext.orgSlug} propertySlug={orgContext.propertySlug} />
    ) : null;

  const setField = <K extends keyof PropertyProfileDraft>(
    key: K,
    value: PropertyProfileDraft[K],
    fieldId: string
  ) => {
    markFieldInteracted(fieldId);
    onChange(key, value);
  };
  const isCondo = isCondoPropertyType(draft.type);
  const effectiveResidence = draft.residenceName.trim() || DEFAULT_RESIDENCE_NAME;
  const residenceOptions = getPropertyResidenceNames();
  const towerValid =
    isCondo && Boolean(draft.tower) && isTowerInResidence(draft.tower, effectiveResidence);
  const towerUnitReady = towerValid && isValidUnitNumber(draft.unitNumber);
  const hasDuplicate = towerUnitReady && towerConflict !== null;
  const propertyTypeLabel =
    PROPERTY_TYPES.find((type) => type.value === draft.type)?.label ?? draft.type;
  const readOnlyFieldClass = 'bg-muted/40';
  const { data: unitTypes = [] } = useResidenceUnitTypes(effectiveResidence);

  const handleUnitTypeChange = (unitTypeId: string) => {
    markFieldInteracted('property-unit-type');
    const selected = findUnitTypeById(unitTypes, unitTypeId);
    if (!selected) return;
    const defaults = applyUnitTypeDefaultsToProfile(selected);
    onChange('unitTypeId', selected.id);
    onChange('bedrooms', defaults.bedrooms);
    onChange('bathrooms', defaults.bathrooms);
    onChange('maxAdults', defaults.maxAdults);
    onChange('maxChildren', defaults.maxChildren);
    onChange('maxGuests', propertyGuestCapacityTotal(defaults.maxAdults, defaults.maxChildren));
  };

  useEffect(() => {
    if (!draft.unitTypeId || unitTypes.length === 0) return;
    const selected = findUnitTypeById(unitTypes, draft.unitTypeId);
    if (!selected) return;
    const defaults = applyUnitTypeDefaultsToProfile(selected);
    if (
      draft.bedrooms !== defaults.bedrooms ||
      draft.bathrooms !== defaults.bathrooms ||
      draft.maxAdults !== defaults.maxAdults ||
      draft.maxChildren !== defaults.maxChildren
    ) {
      onChange('bedrooms', defaults.bedrooms);
      onChange('bathrooms', defaults.bathrooms);
      onChange('maxAdults', defaults.maxAdults);
      onChange('maxChildren', defaults.maxChildren);
      onChange('maxGuests', propertyGuestCapacityTotal(defaults.maxAdults, defaults.maxChildren));
    }
  }, [draft.unitTypeId, unitTypes, onChange]);

  const residenceDefaults = getResidencePropertyDefaults(effectiveResidence);

  const toggleAmenity = (amenityId: string) => {
    const next = draft.enabledAmenities.includes(amenityId)
      ? draft.enabledAmenities.filter((id) => id !== amenityId)
      : [...draft.enabledAmenities, amenityId];
    onChange('enabledAmenities', next);
  };

  const addCustomAmenity = (categoryId: string) => {
    const name = newCustomAmenityInputs[categoryId]?.trim();
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
    onChange('customAmenities', [...draft.customAmenities, amenity]);
    onChange('enabledAmenities', [...draft.enabledAmenities, amenity.id]);
    onNewCustomAmenityInputChange(categoryId, '');
  };

  const removeCustomAmenity = (amenityId: string) => {
    onChange(
      'customAmenities',
      draft.customAmenities.filter((entry) => entry.id !== amenityId)
    );
    onChange(
      'enabledAmenities',
      draft.enabledAmenities.filter((id) => id !== amenityId)
    );
  };

  const toggleHouseRule = (ruleId: string) => {
    const enabled = draft.enabledHouseRules.includes(ruleId);
    let next = enabled
      ? draft.enabledHouseRules.filter((id) => id !== ruleId)
      : [...draft.enabledHouseRules, ruleId];

    const exclusiveId = MUTUALLY_EXCLUSIVE_HOUSE_RULES[ruleId];
    if (!enabled && exclusiveId) {
      next = next.filter((id) => id !== exclusiveId);
    }

    onChange('enabledHouseRules', next);
  };

  const addCustomHouseRule = (categoryId: string) => {
    const name = newCustomHouseRuleInputs[categoryId]?.trim();
    if (!name) return;
    if (name.length > HOUSE_RULE_CUSTOM_MAX_LENGTH) {
      toast.error(`Custom rules must be ${HOUSE_RULE_CUSTOM_MAX_LENGTH} characters or fewer`);
      return;
    }
    const rule: CustomHouseRule = {
      id: `custom_${categoryId}_${Date.now()}`,
      name,
      categoryId,
    };
    onChange('customHouseRules', [...draft.customHouseRules, rule]);
    onChange('enabledHouseRules', [...draft.enabledHouseRules, rule.id]);
    onNewCustomHouseRuleInputChange(categoryId, '');
  };

  const removeCustomHouseRule = (ruleId: string) => {
    onChange(
      'customHouseRules',
      draft.customHouseRules.filter((entry) => entry.id !== ruleId)
    );
    onChange(
      'enabledHouseRules',
      draft.enabledHouseRules.filter((id) => id !== ruleId)
    );
  };

  return (
    <>
      {sectionIsVisible('basic') ? (
        <AdminSection
          id="basic"
          title="Basic Information"
          icon={Info}
          description="Name, contact details, and brand color."
        >
          <SettingsField
            id="property-name"
            label="Property Name"
            required
            error={
              fieldError('property-name') ??
              (nameUnavailable
                ? (nameConflictMessage ?? 'A property with this name already exists')
                : null)
            }
            help="This is the name guests will see when searching for your property."
          >
            <AvailabilityCheckInput
              id="property-name"
              value={draft.name}
              onChange={(event) => setField('name', event.target.value, 'property-name')}
              disabled={lock('basic')}
              placeholder="Enter property name"
              maxLength={120}
              aria-invalid={Boolean(fieldError('property-name') || nameUnavailable)}
              className={cn(
                (fieldError('property-name') || nameUnavailable) && 'border-destructive'
              )}
              checkState={nameAvailabilityState}
            />
          </SettingsField>

          <SettingsField id="property-slug" label="URL Slug">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <span className="text-muted-foreground truncate text-sm">{propertySlugPrefix}</span>
              <Input
                id="property-slug"
                value={slugPreview}
                readOnly
                disabled={lock('basic')}
                placeholder="property-slug"
                className="bg-muted/40 max-w-xs"
                autoComplete="off"
                spellCheck={false}
                aria-readonly="true"
              />
            </div>
          </SettingsField>

          <BrandColorField
            id="property-brand-color"
            value={brandColor}
            resolvedColor={inheritedBrandColor}
            resetValue={inheritedBrandColor}
            disabled={lock('basic')}
            error={fieldError('property-brand-color')}
            help="Applies to this property’s dashboard pages & public-facing pages such as guest forms, email templates, and other related content."
            photoUrls={collectPropertyPhotoUrls(draft.media)}
            onChange={(value) => {
              markFieldInteracted('property-brand-color');
              onBrandColorChange(value);
            }}
          />

          <FieldGrid>
            <SettingsField
              id="property-type"
              label="Property Type"
              required
              error={fieldError('property-type')}
            >
              <Input
                id="property-type"
                value={propertyTypeLabel}
                readOnly
                disabled={lock('basic')}
                tabIndex={-1}
                aria-readonly="true"
                aria-invalid={Boolean(fieldError('property-type'))}
                className={cn(
                  readOnlyFieldClass,
                  fieldError('property-type') && 'border-destructive'
                )}
              />
            </SettingsField>

            {isCondo ? (
              <SettingsField
                id="property-residence"
                label="Residence"
                required
                error={fieldError('property-residence')}
              >
                <Input
                  id="property-residence"
                  value={draft.residenceName.trim() || residenceOptions[0] || ''}
                  readOnly
                  disabled={lock('basic')}
                  tabIndex={-1}
                  aria-readonly="true"
                  aria-invalid={Boolean(fieldError('property-residence'))}
                  className={cn(
                    readOnlyFieldClass,
                    fieldError('property-residence') && 'border-destructive'
                  )}
                />
              </SettingsField>
            ) : null}

            {isCondo ? (
              <>
                <SettingsField
                  id="property-tower"
                  label="Tower"
                  required
                  error={fieldError('property-tower')}
                >
                  <Input
                    id="property-tower"
                    value={draft.tower || ''}
                    readOnly
                    disabled={lock('basic')}
                    tabIndex={-1}
                    aria-readonly="true"
                    aria-invalid={Boolean(fieldError('property-tower') || hasDuplicate)}
                    className={cn(
                      readOnlyFieldClass,
                      (fieldError('property-tower') || hasDuplicate) && 'border-destructive'
                    )}
                  />
                </SettingsField>

                <SettingsField
                  id="property-unit"
                  label="Unit"
                  required
                  error={fieldError('property-unit')}
                >
                  <Input
                    id="property-unit"
                    value={draft.unitNumber}
                    readOnly
                    disabled={lock('basic')}
                    tabIndex={-1}
                    aria-readonly="true"
                    aria-invalid={Boolean(fieldError('property-unit') || hasDuplicate)}
                    className={cn(
                      readOnlyFieldClass,
                      'tabular-nums',
                      (fieldError('property-unit') || hasDuplicate) && 'border-destructive'
                    )}
                  />
                </SettingsField>
              </>
            ) : null}
          </FieldGrid>

          {isCondo && towerUnitReady && hasDuplicate && towerConflict ? (
            <TowerUnitConflictAlert
              tower={draft.tower}
              unitNumber={draft.unitNumber}
              conflict={towerConflict}
            />
          ) : null}

          <SettingsField id="property-description" label="Description">
            <Textarea
              id="property-description"
              value={draft.description}
              onChange={(event) => onChange('description', event.target.value)}
              disabled={lock('basic')}
              placeholder="Describe your property..."
              rows={12}
              maxLength={1000}
            />
            <p className="text-muted-foreground text-xs">
              {draft.description.length}/1000 characters
            </p>
          </SettingsField>
        </AdminSection>
      ) : null}

      {sectionIsVisible('details') ? (
        <AdminSection
          id="details"
          title="Property Details"
          icon={Home}
          description="Bedrooms, bathrooms, floor, and max guests."
        >
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <SettingsField
              id="property-unit-type"
              label="Unit type"
              required
              error={fieldError('property-unit-type')}
            >
              <Select
                value={draft.unitTypeId || undefined}
                onValueChange={handleUnitTypeChange}
                disabled={lock('details') || unitTypes.length === 0}
              >
                <SelectTrigger
                  id="property-unit-type"
                  aria-invalid={Boolean(fieldError('property-unit-type'))}
                  className={cn(fieldError('property-unit-type') && 'border-destructive')}
                >
                  <SelectValue placeholder="Select unit type" />
                </SelectTrigger>
                <SelectContent>
                  {unitTypes.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsField>

            <SettingsField
              id="property-bedrooms"
              label="Bedrooms"
              required
              error={fieldError('property-bedrooms')}
            >
              <div className="relative">
                <Bed
                  className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  id="property-bedrooms"
                  type="number"
                  value={draft.bedrooms}
                  readOnly
                  disabled={lock('details')}
                  tabIndex={-1}
                  aria-readonly="true"
                  aria-invalid={Boolean(fieldError('property-bedrooms'))}
                  className={cn(
                    'bg-muted/40 pl-9 tabular-nums',
                    fieldError('property-bedrooms') && 'border-destructive'
                  )}
                />
              </div>
            </SettingsField>

            <SettingsField
              id="property-bathrooms"
              label="Bathrooms"
              required
              error={fieldError('property-bathrooms')}
            >
              <div className="relative">
                <Bath
                  className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  id="property-bathrooms"
                  type="number"
                  step={0.5}
                  value={draft.bathrooms}
                  readOnly
                  disabled={lock('details')}
                  tabIndex={-1}
                  aria-readonly="true"
                  aria-invalid={Boolean(fieldError('property-bathrooms'))}
                  className={cn(
                    'bg-muted/40 pl-9 tabular-nums',
                    fieldError('property-bathrooms') && 'border-destructive'
                  )}
                />
              </div>
            </SettingsField>

            <SettingsField
              id="property-floors"
              label="Floor"
              required
              error={fieldError('property-floors')}
            >
              <Input
                id="property-floors"
                type="number"
                min={residenceDefaults.floors.min}
                max={residenceDefaults.floors.max}
                value={draft.floors}
                onChange={(event) =>
                  setField(
                    'floors',
                    clampToRange(Number(event.target.value), residenceDefaults.floors),
                    'property-floors'
                  )
                }
                disabled={lock('details')}
                aria-invalid={Boolean(fieldError('property-floors'))}
                className={cn(fieldError('property-floors') && 'border-destructive')}
              />
            </SettingsField>

            <SettingsField
              id="property-max-adults"
              label="Max Adults"
              required
              error={fieldError('property-max-adults')}
            >
              <div className="relative">
                <Users
                  className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  id="property-max-adults"
                  type="number"
                  value={draft.maxAdults}
                  readOnly
                  disabled={lock('details')}
                  tabIndex={-1}
                  aria-readonly="true"
                  className={cn(
                    'bg-muted/40 pl-9 tabular-nums',
                    fieldError('property-max-adults') && 'border-destructive'
                  )}
                />
              </div>
            </SettingsField>

            <SettingsField
              id="property-max-children"
              label="Max Children"
              required
              error={fieldError('property-max-children')}
            >
              <div className="relative">
                <Baby
                  className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  id="property-max-children"
                  type="number"
                  value={draft.maxChildren}
                  readOnly
                  disabled={lock('details')}
                  tabIndex={-1}
                  aria-readonly="true"
                  className={cn(
                    'bg-muted/40 pl-9 tabular-nums',
                    fieldError('property-max-children') && 'border-destructive'
                  )}
                />
              </div>
            </SettingsField>
          </div>

          <FieldGrid>
            <SettingsField
              id="property-check-in"
              label="Check-in Time"
              required
              error={fieldError('property-check-in')}
            >
              <TimePicker
                id="property-check-in"
                value={draft.checkInTime}
                onChange={(value) => setField('checkInTime', value, 'property-check-in')}
                disabled={lock('details')}
                aria-invalid={Boolean(fieldError('property-check-in'))}
              />
            </SettingsField>

            <SettingsField
              id="property-check-out"
              label="Check-out Time"
              required
              error={fieldError('property-check-out')}
            >
              <TimePicker
                id="property-check-out"
                value={draft.checkOutTime}
                onChange={(value) => setField('checkOutTime', value, 'property-check-out')}
                disabled={lock('details')}
                aria-invalid={Boolean(fieldError('property-check-out'))}
              />
            </SettingsField>
          </FieldGrid>

          <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
            <Checkbox
              checked={draft.selfCheckIn}
              onCheckedChange={(checked) => onChange('selfCheckIn', checked === true)}
              disabled={lock('details')}
              className="mt-0.5"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium">Self Check-in Available</span>
              <span className="text-muted-foreground block text-sm">
                Guests can check themselves in using a lockbox, smart lock, or similar method.
              </span>
            </span>
          </label>
        </AdminSection>
      ) : null}

      {sectionIsVisible('media') ? (
        <AdminSection
          id="media"
          title="Photos & Videos"
          icon={ImageIcon}
          description="Listing photos and videos."
          headerAction={publicPagesCrossLink}
        >
          {propertySettingsSectionBanner('media', sectionMessages) ? (
            <PropertySettingsSectionAlert
              message={propertySettingsSectionBanner('media', sectionMessages)!}
            />
          ) : null}
          <PropertyMediaUpload
            items={draft.media}
            onChange={(media) => onChange('media', media)}
            onPersisted={onMediaPersisted}
            onPersistOrder={onPersistMediaOrder}
            disabled={lock('media') || mediaGalleryBusy}
          />
        </AdminSection>
      ) : null}

      {sectionIsVisible('amenities') ? (
        <AdminSection
          id="amenities"
          title="Amenities"
          icon={Sparkles}
          description="What's included with the stay."
          headerAction={publicPagesCrossLink}
        >
          {propertySettingsSectionBanner('amenities', sectionMessages) ? (
            <PropertySettingsSectionAlert
              message={propertySettingsSectionBanner('amenities', sectionMessages)!}
            />
          ) : null}
          {embedded ? (
            <PropertyAmenitiesManageDialog
              open
              onOpenChange={() => undefined}
              inline
              enabledAmenities={draft.enabledAmenities}
              customAmenities={draft.customAmenities}
              newCustomAmenityInputs={newCustomAmenityInputs}
              onNewCustomAmenityInputChange={onNewCustomAmenityInputChange}
              onToggleAmenity={toggleAmenity}
              onAddCustomAmenity={addCustomAmenity}
              onRemoveCustomAmenity={removeCustomAmenity}
              disabled={lock('amenities')}
            />
          ) : (
            <>
              <div className="bg-muted/40 flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3">
                <p className="min-w-0 text-xs font-medium sm:text-sm">
                  {draft.enabledAmenities.length} amenities selected
                  {draft.customAmenities.length > 0
                    ? ` · ${draft.customAmenities.length} custom`
                    : ''}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="settings-action"
                  onClick={() => setAmenitiesManageOpen(true)}
                >
                  Manage
                </Button>
              </div>
              <PropertyAmenitiesManageDialog
                open={amenitiesManageOpen}
                onOpenChange={setAmenitiesManageOpen}
                enabledAmenities={draft.enabledAmenities}
                customAmenities={draft.customAmenities}
                newCustomAmenityInputs={newCustomAmenityInputs}
                onNewCustomAmenityInputChange={onNewCustomAmenityInputChange}
                onToggleAmenity={toggleAmenity}
                onAddCustomAmenity={addCustomAmenity}
                onRemoveCustomAmenity={removeCustomAmenity}
                disabled={lock('amenities')}
              />
            </>
          )}
        </AdminSection>
      ) : null}

      {sectionIsVisible('house-rules') ? (
        <AdminSection
          id="house-rules"
          title="House Rules"
          icon={ListChecks}
          description="Rules guests see before they book."
          headerAction={publicPagesCrossLink}
        >
          {embedded ? (
            <PropertyHouseRulesManageDialog
              open
              onOpenChange={() => undefined}
              inline
              enabledHouseRules={draft.enabledHouseRules}
              customHouseRules={draft.customHouseRules}
              newCustomHouseRuleInputs={newCustomHouseRuleInputs}
              onNewCustomHouseRuleInputChange={onNewCustomHouseRuleInputChange}
              onToggleHouseRule={toggleHouseRule}
              onAddCustomHouseRule={addCustomHouseRule}
              onRemoveCustomHouseRule={removeCustomHouseRule}
              disabled={lock('house-rules')}
            />
          ) : (
            <>
              <div className="bg-muted/40 flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3">
                <p className="min-w-0 text-xs font-medium sm:text-sm">
                  {draft.enabledHouseRules.length} rules selected
                  {draft.customHouseRules.length > 0
                    ? ` · ${draft.customHouseRules.length} custom`
                    : ''}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="settings-action"
                  onClick={() => setHouseRulesManageOpen(true)}
                >
                  Manage
                </Button>
              </div>
              <PropertyHouseRulesManageDialog
                open={houseRulesManageOpen}
                onOpenChange={setHouseRulesManageOpen}
                enabledHouseRules={draft.enabledHouseRules}
                customHouseRules={draft.customHouseRules}
                newCustomHouseRuleInputs={newCustomHouseRuleInputs}
                onNewCustomHouseRuleInputChange={onNewCustomHouseRuleInputChange}
                onToggleHouseRule={toggleHouseRule}
                onAddCustomHouseRule={addCustomHouseRule}
                onRemoveCustomHouseRule={removeCustomHouseRule}
                disabled={lock('house-rules')}
              />
            </>
          )}
        </AdminSection>
      ) : null}

      {sectionIsVisible('guest-form') ? (
        <PropertyGuestFormSettingsSection
          draft={draft}
          disabled={lock('house-rules')}
          onChange={onChange}
          setField={setField}
          resolveFieldError={fieldError}
        />
      ) : null}

      {sectionIsVisible('cancellation') ? (
        <PropertyCancellationPolicySection
          policy={draft.cancellationPolicy}
          disabled={lock('house-rules')}
          resolveFieldError={fieldError}
          markFieldInteracted={markFieldInteracted}
          onChange={(policy) => onChange('cancellationPolicy', policy)}
          headerAction={publicPagesCrossLink}
        />
      ) : null}

      {sectionIsVisible('location') ? (
        <AdminSection
          id="location"
          title="Location"
          icon={MapPin}
          description="Address and map pin."
        >
          <PropertyLocationSettingsBlock
            embedded={embedded}
            disabled={lock('location')}
            persistPending={locationPersistPending}
            onFieldInteract={markFieldInteracted}
            onPersist={onPersistLocation}
            value={{
              address: draft.address,
              city: draft.city,
              province: draft.province,
              country: draft.country,
              zipCode: draft.zipCode,
              latitude: draft.latitude,
              longitude: draft.longitude,
              mapsUrl: draft.mapsUrl,
              placeId: draft.placeId,
            }}
            onChange={(next) => {
              onChange('address', next.address);
              onChange('city', next.city);
              onChange('province', next.province);
              onChange('country', next.country);
              onChange('zipCode', next.zipCode);
              onChange('latitude', next.latitude);
              onChange('longitude', next.longitude);
              onChange('mapsUrl', next.mapsUrl);
              onChange('placeId', next.placeId);
            }}
          />
        </AdminSection>
      ) : null}
    </>
  );
}

export function PropertyDangerZoneSection({
  propertyName,
  isArchived,
  disabled = false,
  showDelete = true,
  onArchive,
  onRestore,
  onDelete,
  archivePending = false,
  restorePending = false,
  deletePending = false,
}: {
  propertyName: string;
  isArchived: boolean;
  disabled?: boolean;
  /** Permanent delete is owner-only (D10) — hide when false. */
  showDelete?: boolean;
  onArchive: () => Promise<void>;
  onRestore: () => Promise<void>;
  onDelete: () => Promise<void>;
  archivePending?: boolean;
  restorePending?: boolean;
  deletePending?: boolean;
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleArchive = async () => {
    try {
      await onArchive();
      setArchiveOpen(false);
    } catch {
      // Parent shows toast
    }
  };

  const handleRestore = async () => {
    try {
      await onRestore();
      setRestoreOpen(false);
    } catch {
      // Parent shows toast
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete();
      setDeleteOpen(false);
    } catch {
      // Parent shows toast
    }
  };

  return (
    <AdminSection
      id="danger"
      title="Danger Zone"
      icon={AlertTriangle}
      description="Archive or permanently delete this property."
      className="border-destructive/50"
    >
      <div className="space-y-3">
        <div className="flex flex-col gap-2.5 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold sm:text-sm">
              {isArchived ? 'Restore Property' : 'Archive Property'}
            </p>
            <p className="text-card-description">
              {isArchived
                ? 'Sets status to Active. Shows the property in active listings again.'
                : 'Sets status to Inactive. Hides the property from active listings. Booking history and settings are kept.'}
            </p>
          </div>
          {isArchived ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || restorePending}
              className="settings-action w-full sm:w-auto"
              onClick={() => setRestoreOpen(true)}
            >
              {restorePending ? 'Restoring…' : 'Restore'}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || archivePending}
              className="settings-action w-full sm:w-auto"
              onClick={() => setArchiveOpen(true)}
            >
              {archivePending ? 'Archiving…' : 'Archive'}
            </Button>
          )}
        </div>

        {showDelete ? (
          <div className="border-destructive/50 flex flex-col gap-2.5 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="space-y-0.5">
              <p className="text-destructive text-xs font-semibold sm:text-sm">Delete Property</p>
              <p className="text-card-description">
                Permanently removes this property, its gallery, integrations, and settings. Only
                allowed when there is no booking history. This cannot be undone.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={disabled || deletePending}
              className="settings-action w-full sm:w-auto"
              onClick={() => setDeleteOpen(true)}
            >
              {deletePending ? 'Deleting…' : 'Delete Property'}
            </Button>
          </div>
        ) : null}
      </div>

      <ResponsiveModal open={archiveOpen} onOpenChange={setArchiveOpen}>
        <ResponsiveModalContent className="max-w-[min(calc(100vw-1.5rem),28rem)]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Archive {propertyName}?</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              The property will be marked Inactive. Existing bookings and records stay in place. You
              can restore it anytime from this section.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <ResponsiveModalFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={archivePending}
              onClick={() => setArchiveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={archivePending}
              onClick={() => void handleArchive()}
            >
              {archivePending ? 'Archiving…' : 'Archive property'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <ResponsiveModal open={restoreOpen} onOpenChange={setRestoreOpen}>
        <ResponsiveModalContent className="max-w-[min(calc(100vw-1.5rem),28rem)]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Restore {propertyName}?</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              The property will be marked Active and appear in active listings again.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <ResponsiveModalFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={restorePending}
              onClick={() => setRestoreOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={restorePending}
              onClick={() => void handleRestore()}
            >
              {restorePending ? 'Restoring…' : 'Restore property'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <ResponsiveModal open={deleteOpen} onOpenChange={setDeleteOpen}>
        <ResponsiveModalContent className="max-w-[min(calc(100vw-1.5rem),28rem)]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle className="text-destructive">
              Delete {propertyName}?
            </ResponsiveModalTitle>
            <ResponsiveModalDescription asChild>
              <div className="text-muted-foreground space-y-2 text-sm">
                <p>
                  This permanently deletes the property profile, gallery media, payment settings,
                  and Telegram configs for this property.
                </p>
                <p>
                  Deletion is blocked if any bookings exist. Use{' '}
                  <span className="text-foreground font-medium">Archive Property</span> instead to
                  hide the property.
                </p>
                <p className="text-destructive font-medium">This action cannot be undone.</p>
              </div>
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <ResponsiveModalFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={deletePending}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={deletePending}
              onClick={() => void handleDelete()}
            >
              {deletePending ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </AdminSection>
  );
}
