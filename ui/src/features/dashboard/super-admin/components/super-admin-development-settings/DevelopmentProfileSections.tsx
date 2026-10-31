import { useState } from 'react';

import {
  AlertTriangle,
  Building2,
  Image as ImageIcon,
  Info,
  Mail,
  MapPin,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { PropertyLocationPicker } from '@/features/dashboard/org/components/property-settings/PropertyLocationPicker';
import { PropertyMediaUpload } from '@/features/dashboard/org/components/property-settings/PropertyMediaUpload';
import { SettingsField } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import type { PropertyLocationFields } from '@/features/dashboard/org/lib/propertyLocation';
import type { PropertyMediaItem } from '@/features/dashboard/org/lib/propertySettingsConstants';
import { DevelopmentAnnouncementsSection } from '@/features/dashboard/super-admin/components/super-admin-development-settings/DevelopmentAnnouncementsSection';
import { DevelopmentDocumentRequirementsSection } from '@/features/dashboard/super-admin/components/super-admin-development-settings/DevelopmentDocumentRequirementsSection';
import { DevelopmentGuestInfoSection } from '@/features/dashboard/super-admin/components/super-admin-development-settings/DevelopmentGuestInfoSection';
import { DevelopmentUnitTypesSection } from '@/features/dashboard/super-admin/components/super-admin-development-settings/DevelopmentUnitTypesSection';
import {
  shouldAutoUpdateDevelopmentLocationLine,
  suggestDevelopmentLocationLine,
} from '@/features/dashboard/super-admin/lib/developmentLocation';
import {
  DEVELOPMENT_AMENITY_SUGGESTIONS,
  DEVELOPMENT_STATUSES,
  DEVELOPMENT_TYPES,
} from '@/features/dashboard/super-admin/lib/developmentSettingsConstants';
import {
  developmentPmoEmailPlaceholder,
  type DevelopmentProfileDraft,
} from '@/features/dashboard/super-admin/lib/developmentSettingsForm';

import { Button } from '@/components/ui/button';
import { Checkbox, CheckboxDisplay } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5">{children}</div>;
}

function StringListEditor({
  label,
  values,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const addValue = () => {
    const trimmed = input.trim();
    if (!trimmed || values.includes(trimmed)) return;
    onChange([...values, trimmed]);
    setInput('');
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder}
          className="h-10"
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addValue();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] min-w-[44px] shrink-0 px-3"
          onClick={addValue}
          disabled={disabled}
          aria-label={`Add ${label}`}
        >
          <Plus className="size-4" aria-hidden />
        </Button>
      </div>
      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {values.map((value) => (
            <li
              key={value}
              className="bg-muted inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
            >
              {value}
              <button
                type="button"
                className="hover:bg-background/80 flex min-h-[24px] min-w-[24px] items-center justify-center rounded-full"
                onClick={() => onChange(values.filter((item) => item !== value))}
                disabled={disabled}
                aria-label={`Remove ${value}`}
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type Props = {
  developmentId: string;
  draft: DevelopmentProfileDraft;
  onChange: <K extends keyof DevelopmentProfileDraft>(
    key: K,
    value: DevelopmentProfileDraft[K]
  ) => void;
  disabled?: boolean;
  onDelete?: () => void;
  deleteBlockedReason?: string | null;
  busy?: boolean;
  onMediaPersisted?: (media: PropertyMediaItem[]) => void;
  onPersistMediaOrder?: (media: PropertyMediaItem[]) => Promise<void>;
  mediaGalleryBusy?: boolean;
};

export function DevelopmentProfileSections({
  developmentId,
  draft,
  onChange,
  disabled = false,
  onDelete,
  deleteBlockedReason,
  busy = false,
  onMediaPersisted,
  onPersistMediaOrder,
  mediaGalleryBusy = false,
}: Props) {
  const [customAmenityInput, setCustomAmenityInput] = useState('');

  const toggleAmenity = (amenity: string) => {
    const next = draft.amenities.includes(amenity)
      ? draft.amenities.filter((item) => item !== amenity)
      : [...draft.amenities, amenity];
    onChange('amenities', next);
  };

  const applyLocationPatch = (patch: Partial<PropertyLocationFields>) => {
    if ('address' in patch) onChange('address', patch.address ?? '');
    if ('city' in patch) onChange('city', patch.city ?? '');
    if ('province' in patch) onChange('province', patch.province ?? '');
    if ('country' in patch) onChange('country', patch.country ?? '');
    if ('zipCode' in patch) onChange('zipCode', patch.zipCode ?? '');
    if ('latitude' in patch) onChange('latitude', patch.latitude ?? null);
    if ('longitude' in patch) onChange('longitude', patch.longitude ?? null);
    if ('mapsUrl' in patch) onChange('mapsUrl', patch.mapsUrl ?? '');
    if ('placeId' in patch) onChange('placeId', patch.placeId ?? '');

    if ('city' in patch || 'province' in patch) {
      const nextCity = typeof patch.city === 'string' ? patch.city : draft.city;
      const nextProvince = typeof patch.province === 'string' ? patch.province : draft.province;
      if (shouldAutoUpdateDevelopmentLocationLine(draft.location, draft.city, draft.province)) {
        onChange('location', suggestDevelopmentLocationLine(nextCity, nextProvince));
      }
    }
  };

  return (
    <>
      <AdminSection id="basic" title="Basic Information" icon={Info}>
        <FieldGrid>
          <SettingsField id="development-name" label="Name" required>
            <Input
              id="development-name"
              value={draft.name}
              onChange={(event) => onChange('name', event.target.value)}
              className="h-10"
              disabled={disabled}
            />
          </SettingsField>
          <SettingsField id="development-slug" label="URL slug" required>
            <Input
              id="development-slug"
              value={draft.slug}
              onChange={(event) => onChange('slug', event.target.value)}
              className="h-10"
              disabled={disabled}
            />
          </SettingsField>
          <SettingsField id="development-developer" label="Developer">
            <Input
              id="development-developer"
              value={draft.developerName}
              onChange={(event) => onChange('developerName', event.target.value)}
              className="h-10"
              disabled={disabled}
            />
          </SettingsField>
          <SettingsField id="development-type" label="Type" required>
            <Select value={draft.type} onValueChange={(value) => onChange('type', value)}>
              <SelectTrigger id="development-type" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEVELOPMENT_TYPES.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField id="development-status" label="Status" required>
            <Select value={draft.status} onValueChange={(value) => onChange('status', value)}>
              <SelectTrigger id="development-status" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEVELOPMENT_STATUSES.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </FieldGrid>
        <SettingsField id="development-description" label="Description">
          <Textarea
            id="development-description"
            value={draft.description}
            onChange={(event) => onChange('description', event.target.value)}
            rows={5}
            disabled={disabled}
          />
        </SettingsField>
      </AdminSection>

      <AdminSection id="media" title="Photos & Videos" icon={ImageIcon}>
        <PropertyMediaUpload
          developmentId={developmentId}
          items={draft.media}
          onChange={(media) => onChange('media', media)}
          onPersisted={onMediaPersisted}
          onPersistOrder={onPersistMediaOrder}
          disabled={disabled || mediaGalleryBusy}
        />
      </AdminSection>

      <AdminSection id="email" title="Email automations" icon={Mail}>
        <SettingsField
          id="development-pmo-email"
          label="PMO email"
          help="Receives GAF and pet approval requests for all properties in this development."
          required
        >
          <Input
            id="development-pmo-email"
            type="email"
            autoComplete="off"
            value={draft.pmoEmail}
            onChange={(event) => onChange('pmoEmail', event.target.value)}
            placeholder={developmentPmoEmailPlaceholder(draft.name)}
            className="h-10"
            disabled={disabled}
          />
        </SettingsField>
      </AdminSection>

      <DevelopmentDocumentRequirementsSection
        list={draft.documentRequirements}
        disabled={disabled}
        onChange={(next) => onChange('documentRequirements', next)}
      />

      <DevelopmentUnitTypesSection
        list={draft.unitTypes}
        disabled={disabled}
        onChange={(next) => onChange('unitTypes', next)}
      />

      <DevelopmentGuestInfoSection draft={draft} disabled={disabled} onChange={onChange} />

      <DevelopmentAnnouncementsSection
        announcements={draft.announcements}
        disabled={disabled}
        onChange={(next) => onChange('announcements', next)}
      />

      <AdminSection id="amenities" title="Amenities" icon={Sparkles}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DEVELOPMENT_AMENITY_SUGGESTIONS.map((amenity) => {
            const checked = draft.amenities.includes(amenity);
            return (
              <label
                key={amenity}
                className={cn(
                  'hover:bg-muted/50 flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2',
                  checked && 'border-primary/40 bg-primary/5'
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleAmenity(amenity)}
                  disabled={disabled}
                />
                <span className="text-sm">{amenity}</span>
              </label>
            );
          })}
        </div>
        {draft.amenities
          .filter((amenity) => !DEVELOPMENT_AMENITY_SUGGESTIONS.includes(amenity as never))
          .map((amenity) => (
            <label
              key={amenity}
              className="border-primary/40 bg-primary/5 flex min-h-[44px] items-center gap-3 rounded-xl border px-3 py-2"
            >
              <CheckboxDisplay checked />
              <span className="flex-1 text-sm">{amenity}</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px]"
                onClick={() => toggleAmenity(amenity)}
                disabled={disabled}
                aria-label={`Remove ${amenity}`}
              >
                <X className="size-4" aria-hidden />
              </button>
            </label>
          ))}
        <div className="flex gap-2">
          <Input
            value={customAmenityInput}
            onChange={(event) => setCustomAmenityInput(event.target.value)}
            placeholder="Add custom amenity"
            className="h-10"
            disabled={disabled}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              const trimmed = customAmenityInput.trim();
              if (!trimmed || draft.amenities.includes(trimmed)) return;
              onChange('amenities', [...draft.amenities, trimmed]);
              setCustomAmenityInput('');
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] min-w-[44px] shrink-0 px-3"
            disabled={disabled}
            aria-label="Add custom amenity"
            onClick={() => {
              const trimmed = customAmenityInput.trim();
              if (!trimmed || draft.amenities.includes(trimmed)) return;
              onChange('amenities', [...draft.amenities, trimmed]);
              setCustomAmenityInput('');
            }}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>
      </AdminSection>

      <AdminSection id="location" title="Location" icon={MapPin}>
        <SettingsField id="development-location" label="Location line">
          <Input
            id="development-location"
            value={draft.location}
            onChange={(event) => onChange('location', event.target.value)}
            className="h-10"
            disabled={disabled}
          />
        </SettingsField>
        <PropertyLocationPicker
          disabled={disabled}
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
          onChange={(patch) => applyLocationPatch(patch)}
        />
      </AdminSection>

      <AdminSection id="towers" title="Towers & Parking" icon={Building2}>
        <StringListEditor
          label="Property towers"
          values={draft.propertyTowers}
          onChange={(values) => onChange('propertyTowers', values)}
          disabled={disabled}
          placeholder="Monaco"
        />
        <StringListEditor
          label="Parking"
          values={draft.parkingTowers}
          onChange={(values) => onChange('parkingTowers', values)}
          disabled={disabled}
          placeholder="Bay"
        />
        <StringListEditor
          label="Parking levels"
          values={draft.parkingLevels}
          onChange={(values) => onChange('parkingLevels', values)}
          disabled={disabled}
          placeholder="Level 1"
        />
      </AdminSection>

      <AdminSection id="danger" title="Danger Zone" icon={AlertTriangle}>
        <div className="border-destructive/30 space-y-4 rounded-xl border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Delete development</p>
              {deleteBlockedReason ? (
                <p className="text-muted-foreground text-sm">{deleteBlockedReason}</p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="destructive"
              className="min-h-[44px]"
              disabled={disabled || busy || Boolean(deleteBlockedReason)}
              onClick={onDelete}
            >
              Delete
            </Button>
          </div>
        </div>
      </AdminSection>
    </>
  );
}
