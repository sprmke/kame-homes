import { PROPERTY_LANDING_OPTIONAL_SECTIONS } from '@/features/guest/marketing/properties/lib/propertyLandingSections';
import type { PropertyLandingSectionId } from '@/features/guest/marketing/properties/types/publicProperty';

import { StyleSection } from '@/features/dashboard/marketing/components/calendar-builder/components/panels/StyleSection';
import { PropertyCancellationPolicySection } from '@/features/dashboard/org/components/property-settings/PropertyCancellationPolicySection';
import { PropertyMediaUpload } from '@/features/dashboard/org/components/property-settings/PropertyMediaUpload';
import { BrandColorField } from '@/features/dashboard/org/components/settings/BrandColorField';
import type { CancellationPolicySettings } from '@/features/dashboard/org/lib/propertyCancellationPolicy';
import type { CustomHouseRule } from '@/features/dashboard/org/lib/propertyHouseRulesConstants';
import type {
  CustomAmenity,
  PropertyMediaItem,
} from '@/features/dashboard/org/lib/propertySettingsConstants';
import { SectionVisibilityList } from '@/features/dashboard/page-editor/components/controls/SectionVisibilityList';
import { PropertyLandingAmenitiesControl } from '@/features/dashboard/page-editor/components/property-landing/PropertyLandingAmenitiesControl';
import { PropertyLandingHouseRulesControl } from '@/features/dashboard/page-editor/components/property-landing/PropertyLandingHouseRulesControl';
import { PageEditorRevealTarget } from '@/features/dashboard/page-editor/lib/pageEditorPreviewScroll';
import { usePropertyLandingEditorStore } from '@/features/dashboard/page-editor/stores/propertyLandingEditorStore';

import { Textarea } from '@/components/ui/textarea';
import { collectPropertyPhotoUrls } from '@/lib/theme/photoBrandColor';

const OPTIONAL_SECTION_LABELS: Record<string, string> = {
  amenities: 'Amenities',
  location: 'Location',
  rules: 'House rules',
  reviews: 'Reviews',
};

export type LandingProfileContent = {
  description: string;
  enabledAmenities: string[];
  customAmenities: CustomAmenity[];
  enabledHouseRules: string[];
  customHouseRules: CustomHouseRule[];
  cancellationPolicy: CancellationPolicySettings;
};

type Props = {
  media: PropertyMediaItem[];
  onMediaChange: (media: PropertyMediaItem[]) => void;
  onMediaPersisted: (media: PropertyMediaItem[]) => void;
  onPersistMediaOrder: (media: PropertyMediaItem[]) => Promise<void>;
  mediaBusy?: boolean;
  brandColor: string;
  inheritedBrandColor: string;
  onBrandColorChange: (value: string) => void;
  brandColorError?: string | null;
  content: LandingProfileContent;
  onContentChange: <K extends keyof LandingProfileContent>(
    key: K,
    value: LandingProfileContent[K]
  ) => void;
  resolveFieldError: (fieldId: string) => string | null;
  markFieldInteracted: (fieldId: string) => void;
};

export function PropertyLandingEditorPanel({
  media,
  onMediaChange,
  onMediaPersisted,
  onPersistMediaOrder,
  mediaBusy = false,
  brandColor,
  inheritedBrandColor,
  onBrandColorChange,
  brandColorError = null,
  content,
  onContentChange,
  resolveFieldError,
  markFieldInteracted,
}: Props) {
  const config = usePropertyLandingEditorStore((s) => s.config);
  const setSectionVisible = usePropertyLandingEditorStore((s) => s.setSectionVisible);

  const optionalSections = PROPERTY_LANDING_OPTIONAL_SECTIONS.map((id) => {
    const entry = config.sections.find((section) => section.id === id);
    return {
      id,
      label: OPTIONAL_SECTION_LABELS[id],
      visible: entry?.visible !== false,
    };
  });

  return (
    <div className="min-w-0">
      <StyleSection title="Sections" defaultOpen>
        <SectionVisibilityList
          items={optionalSections}
          onVisibilityChange={(id, visible) =>
            setSectionVisible(id as PropertyLandingSectionId, visible)
          }
          previewAnchorForItem={(id) => id}
        />
      </StyleSection>

      <PageEditorRevealTarget anchor="gallery">
        <StyleSection title="Gallery" defaultOpen>
          <div className="px-4 py-3">
            <PropertyMediaUpload
              items={media}
              onChange={onMediaChange}
              onPersisted={onMediaPersisted}
              onPersistOrder={onPersistMediaOrder}
              disabled={mediaBusy}
            />
          </div>
        </StyleSection>
      </PageEditorRevealTarget>

      {/* Brand color is global — do not scroll the preview. */}
      <StyleSection title="Brand color" defaultOpen>
        <div className="px-4 py-3">
          <BrandColorField
            id="landing-brand-color"
            value={brandColor}
            resolvedColor={inheritedBrandColor}
            resetValue={inheritedBrandColor}
            error={brandColorError}
            hideLabel
            photoUrls={collectPropertyPhotoUrls(media)}
            onChange={onBrandColorChange}
          />
        </div>
      </StyleSection>

      <PageEditorRevealTarget anchor="overview">
        <StyleSection title="Description" defaultOpen>
          <div className="space-y-2 px-4 py-3">
            <Textarea
              id="landing-description"
              value={content.description}
              onChange={(event) => onContentChange('description', event.target.value)}
              placeholder="Describe your property..."
              rows={8}
              maxLength={1000}
            />
            <p className="text-muted-foreground text-xs">{content.description.length}/1000</p>
          </div>
        </StyleSection>
      </PageEditorRevealTarget>

      <PageEditorRevealTarget anchor="amenities">
        <StyleSection title="Amenities">
          <PropertyLandingAmenitiesControl
            enabledAmenities={content.enabledAmenities}
            customAmenities={content.customAmenities}
            onEnabledChange={(ids) => onContentChange('enabledAmenities', ids)}
            onCustomChange={(amenities) => onContentChange('customAmenities', amenities)}
          />
        </StyleSection>
      </PageEditorRevealTarget>

      <PageEditorRevealTarget anchor="rules">
        <StyleSection title="House rules">
          <PropertyLandingHouseRulesControl
            enabledHouseRules={content.enabledHouseRules}
            customHouseRules={content.customHouseRules}
            onEnabledChange={(ids) => onContentChange('enabledHouseRules', ids)}
            onCustomChange={(rules) => onContentChange('customHouseRules', rules)}
          />
        </StyleSection>
      </PageEditorRevealTarget>

      <PageEditorRevealTarget anchor="rules">
        <StyleSection title="Cancellation">
          <PropertyCancellationPolicySection
            embedded
            policy={content.cancellationPolicy}
            resolveFieldError={resolveFieldError}
            markFieldInteracted={markFieldInteracted}
            onChange={(policy) => onContentChange('cancellationPolicy', policy)}
          />
        </StyleSection>
      </PageEditorRevealTarget>
    </div>
  );
}
