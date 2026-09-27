import { Link } from 'react-router-dom';

import { Mic, Sparkles } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import {
  AiSettingsFeatureGroup,
  AiSettingsStatusNote,
  AiSettingsUsageStat,
} from '@/features/dashboard/org/components/settings/AiSettingsChrome';
import {
  useAiPlatformSettings,
  useAiPlatformUsage,
} from '@/features/dashboard/org/hooks/useAiPlatformSettings';
import { usePropertyIdParam, useOrgSlugParam } from '@/features/dashboard/org/lib/adminApiScope';
import {
  AI_SETTINGS_CARD_TITLE,
  AI_SETTINGS_ORG_OFF_HINT,
  AI_SETTINGS_PLATFORM_GROUP_TITLE,
  AI_SETTINGS_PROPERTY_VOICE_GROUP_TITLE,
  AI_SETTINGS_SECTION_ID,
} from '@/features/dashboard/org/lib/aiSettingsLabels';
import {
  PropertyVoiceReceptionistFields,
  type PropertyVoiceReceptionistFieldsProps,
} from '@/features/dashboard/org/components/property-settings/PropertyVoiceReceptionistFields';
import { orgSettingsPath } from '@/features/dashboard/org/lib/tenantPaths';

import { SettingsFormSkeleton } from '@/components/skeletons/AdminSkeletons';

type VoiceProps = Pick<
  PropertyVoiceReceptionistFieldsProps,
  | 'draft'
  | 'propertyName'
  | 'availableVoices'
  | 'isLoading'
  | 'isError'
  | 'errorMessage'
  | 'onChange'
>;

type Props = {
  showUsage?: boolean;
  showVoiceReceptionist: boolean;
  voiceReceptionist?: VoiceProps;
  voiceDisabled?: boolean;
};

/**
 * Property AI card — inherits org master enable (no second kill switch).
 * Feature config only shows when org AI is on and the feature toggle is on.
 */
export function PropertyAiSettingsSection({
  showUsage = true,
  showVoiceReceptionist,
  voiceReceptionist,
  voiceDisabled = false,
}: Props) {
  const orgSlug = useOrgSlugParam();
  const propertyId = usePropertyIdParam();
  const { data: orgSettings, isLoading: orgLoading } = useAiPlatformSettings();
  const { data: usage } = useAiPlatformUsage();

  const propertyUsage = usage?.propertyBreakdown.find((row) => row.propertyId === propertyId);
  const orgAiOn = orgSettings?.enabled === true;

  if (orgLoading || !orgSettings) {
    return (
      <AdminSection id={AI_SETTINGS_SECTION_ID} title={AI_SETTINGS_CARD_TITLE} icon={Sparkles}>
        <SettingsFormSkeleton columns={3} fields={3} toggle label="Loading AI features" />
      </AdminSection>
    );
  }

  return (
    <AdminSection id={AI_SETTINGS_SECTION_ID} title={AI_SETTINGS_CARD_TITLE} icon={Sparkles}>
      <div className="space-y-4">
        {!orgAiOn ? (
          <AiSettingsStatusNote>
            {AI_SETTINGS_ORG_OFF_HINT}{' '}
            {orgSlug ? (
              <Link
                to={`${orgSettingsPath(orgSlug)}#section-ai`}
                className="text-primary font-medium underline-offset-2 hover:underline"
              >
                Open org settings
              </Link>
            ) : null}
          </AiSettingsStatusNote>
        ) : (
          <>
            {showUsage && propertyUsage ? (
              <AiSettingsFeatureGroup title={AI_SETTINGS_PLATFORM_GROUP_TITLE}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <AiSettingsUsageStat
                    label="Today"
                    value={`${propertyUsage.todayCallCount} calls`}
                  />
                  <AiSettingsUsageStat
                    label="This month"
                    value={`${propertyUsage.monthCallCount} calls`}
                  />
                  <AiSettingsUsageStat
                    label="Est. cost this month"
                    value={`$${propertyUsage.monthCostUsd.toFixed(2)}`}
                  />
                </div>
              </AiSettingsFeatureGroup>
            ) : null}

            {showVoiceReceptionist && voiceReceptionist ? (
              <AiSettingsFeatureGroup title={AI_SETTINGS_PROPERTY_VOICE_GROUP_TITLE} icon={Mic}>
                <PropertyVoiceReceptionistFields {...voiceReceptionist} disabled={voiceDisabled} />
              </AiSettingsFeatureGroup>
            ) : null}
          </>
        )}
      </div>
    </AdminSection>
  );
}
