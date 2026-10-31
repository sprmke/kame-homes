import { useEffect, useState } from 'react';

import { Share2 } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import type {
  AppSettingsDto,
  AppSettingsFormValues,
} from '@/features/dashboard/bookings/hooks/useAppSettings';
import { PropertySettingsSectionAlert } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import { SocialLinkInheritField } from '@/features/dashboard/org/components/settings/SocialLinkInheritField';
import type { PropertySettingsSectionId } from '@/features/dashboard/org/lib/propertySettingsCompletion';
import { propertySettingsSectionBanner } from '@/features/dashboard/org/lib/propertySettingsFieldError';
import type { OrgSocialLinks } from '@/features/dashboard/org/lib/propertySocialLinks';
import {
  SOCIAL_LINK_FIELD_IDS,
  SOCIAL_LINK_KEYS,
  SOCIAL_LINK_LABELS,
  socialLinkModesFromDraft,
  type SocialLinkKey,
  type SocialLinkMode,
} from '@/features/dashboard/org/lib/propertySocialLinks';

export function PropertySocialsSection({
  data,
  draft,
  orgSocialLinks,
  disabled,
  resolveFieldError,
  markFieldInteracted,
  onChange,
  sectionMessages,
  embedded = false,
}: {
  data: Pick<AppSettingsDto, 'updatedAt'>;
  draft: Pick<
    AppSettingsFormValues,
    'facebookPageUrl' | 'airbnbUrl' | 'instagramUrl' | 'tiktokUrl'
  >;
  orgSocialLinks: OrgSocialLinks;
  disabled?: boolean;
  resolveFieldError: (fieldId: string) => string | null;
  markFieldInteracted: (fieldId: string) => void;
  onChange: <K extends keyof AppSettingsFormValues>(
    key: K,
    value: AppSettingsFormValues[K]
  ) => void;
  sectionMessages: Partial<Record<PropertySettingsSectionId, string>>;
  embedded?: boolean;
}) {
  const [socialLinkModes, setSocialLinkModes] = useState<Record<SocialLinkKey, SocialLinkMode>>(
    () => socialLinkModesFromDraft(draft)
  );

  useEffect(() => {
    setSocialLinkModes(socialLinkModesFromDraft(draft));
  }, [data.updatedAt]);

  const setSocialLinkMode = (key: SocialLinkKey, mode: SocialLinkMode) => {
    setSocialLinkModes((current) => ({ ...current, [key]: mode }));
  };

  const socialsBody = (
    <div className="border-border/60 divide-border/50 divide-y overflow-hidden rounded-xl border">
      {SOCIAL_LINK_KEYS.map((key) => (
        <SocialLinkInheritField
          key={key}
          id={SOCIAL_LINK_FIELD_IDS[key]}
          label={SOCIAL_LINK_LABELS[key]}
          storedValue={draft[key]}
          orgValue={orgSocialLinks[key]}
          inheritsOrg={socialLinkModes[key] === 'inherit'}
          disabled={disabled}
          error={resolveFieldError(SOCIAL_LINK_FIELD_IDS[key])}
          onStoredChange={(value) => onChange(key, value)}
          onInheritsOrgChange={(inherits) => {
            setSocialLinkMode(key, inherits ? 'inherit' : 'custom');
          }}
          onInteract={() => markFieldInteracted(SOCIAL_LINK_FIELD_IDS[key])}
        />
      ))}
    </div>
  );

  return embedded ? (
    <div className="space-y-4 px-4 py-3">
      {propertySettingsSectionBanner('branding', sectionMessages) ? (
        <PropertySettingsSectionAlert
          message={propertySettingsSectionBanner('branding', sectionMessages)!}
        />
      ) : null}
      {socialsBody}
    </div>
  ) : (
    <AdminSection id="branding" title="Socials" icon={Share2}>
      {propertySettingsSectionBanner('branding', sectionMessages) ? (
        <PropertySettingsSectionAlert
          message={propertySettingsSectionBanner('branding', sectionMessages)!}
        />
      ) : null}

      {socialsBody}
    </AdminSection>
  );
}

/** @deprecated Use PropertySocialsSection */
export const PropertySocialsBrandingSection = PropertySocialsSection;
