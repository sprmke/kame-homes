import * as React from 'react';

import { Bot, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import {
  useAiDashboardAssistantSettings,
  useUpdateAiDashboardAssistantSettings,
} from '@/features/dashboard/ai-assistant/hooks/useAiDashboardAssistantSettings';
import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { OrgVoiceReceptionistGroup } from '@/features/dashboard/org/components/org-settings/OrgVoiceReceptionistGroup';
import {
  AiSettingsCreditsBar,
  AiSettingsFeatureGroup,
  AiSettingsStatusNote,
  AiSettingsToggleRow,
  AiSettingsUsageStat,
} from '@/features/dashboard/org/components/settings/AiSettingsChrome';
import {
  useAiPlatformSettings,
  useAiPlatformUsage,
  useUpdateAiPlatformSettings,
} from '@/features/dashboard/org/hooks/useAiPlatformSettings';
import { useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useOrgSlugParam } from '@/features/dashboard/org/lib/adminApiScope';
import {
  AI_SETTINGS_ASSISTANT_TOGGLE_LABEL,
  AI_SETTINGS_CARD_TITLE,
  AI_SETTINGS_ORG_ASSISTANT_GROUP_TITLE,
  AI_SETTINGS_ORG_MASTER_LABEL,
  AI_SETTINGS_PLATFORM_GROUP_TITLE,
  AI_SETTINGS_SECTION_ID,
} from '@/features/dashboard/org/lib/aiSettingsLabels';
import { PlanUpgradeLink } from '@/features/dashboard/plans/components/PlanUpgradeLink';
import { useOrgPermissions } from '@/features/dashboard/team/hooks/useOrgPermissions';

import { SettingsFormSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

type AssistantDraft = {
  enabled: boolean;
  disabledPropertyIds: string[];
};

/**
 * Org AI card: one master switch (syncs all properties). Feature details appear only when on.
 */
export function OrgAiSettingsSection() {
  const orgSlug = useOrgSlugParam();
  const { data: settings, isLoading: settingsLoading } = useAiPlatformSettings();
  const { data: usage, isLoading: usageLoading } = useAiPlatformUsage();
  const { data: assistantSettings, isLoading: assistantLoading } = useAiDashboardAssistantSettings({
    includeUsage: true,
  });
  const { data: propertiesData } = useProperties(orgSlug ?? undefined);
  const { data: orgAccess } = useOrgPermissions();
  const updatePlatform = useUpdateAiPlatformSettings();
  const updateAssistant = useUpdateAiDashboardAssistantSettings();

  const canEditPlatform = orgAccess?.canEditAiPlatform ?? false;
  const canEditAssistant = orgAccess?.canEditAiAssistant ?? false;
  const platformReadOnly = !canEditPlatform;
  const assistantReadOnly = !canEditAssistant;

  const [assistantDraft, setAssistantDraft] = React.useState<AssistantDraft | null>(null);
  const [assistantBaseline, setAssistantBaseline] = React.useState<AssistantDraft | null>(null);
  const [assistantUserEdited, setAssistantUserEdited] = React.useState(false);

  React.useEffect(() => {
    if (!assistantSettings) return;
    const next: AssistantDraft = {
      enabled: assistantSettings.enabled,
      disabledPropertyIds: assistantSettings.disabledPropertyIds,
    };
    setAssistantDraft((current) => (current === null ? next : current));
    setAssistantBaseline((current) => (current === null ? next : current));
  }, [assistantSettings]);

  const assistantDirty =
    assistantDraft && assistantBaseline
      ? assistantDraft.enabled !== assistantBaseline.enabled ||
        assistantDraft.disabledPropertyIds.join(',') !==
          assistantBaseline.disabledPropertyIds.join(',')
      : false;

  const handlePlatformToggle = (enabled: boolean) => {
    updatePlatform.mutate(
      { enabled },
      {
        onSuccess: () =>
          toast.success(enabled ? 'AI enabled for organization' : 'AI disabled for organization'),
        onError: (err: unknown) => toast.error(friendlyToastError(err, 'Could not update AI')),
      }
    );
  };

  const handleAssistantSave = async (): Promise<boolean> => {
    if (!assistantDraft) return false;
    try {
      const saved = await updateAssistant.mutateAsync({
        enabled: assistantDraft.enabled,
        disabledPropertyIds: assistantDraft.disabledPropertyIds,
      });
      const next: AssistantDraft = {
        enabled: saved.enabled,
        disabledPropertyIds: saved.disabledPropertyIds,
      };
      setAssistantDraft(next);
      setAssistantBaseline(next);
      setAssistantUserEdited(false);
      toast.success('Assistant settings saved');
      return true;
    } catch (err: unknown) {
      toast.error(friendlyToastError(err, 'Could not save assistant settings'));
      return false;
    }
  };

  useUnsavedChangesGuard({
    isDirty: assistantDirty && assistantUserEdited && !assistantReadOnly,
    onSave: handleAssistantSave,
  });

  if (settingsLoading || usageLoading || assistantLoading || !settings || !assistantDraft) {
    return (
      <AdminSection id={AI_SETTINGS_SECTION_ID} title={AI_SETTINGS_CARD_TITLE} icon={Sparkles}>
        <SettingsFormSkeleton columns={2} fields={4} toggle label="Loading AI features" />
      </AdminSection>
    );
  }

  const showUpgradeStub = usage?.quotaExceeded || usage?.planTier === 'included';
  const properties = propertiesData?.properties ?? [];
  const masterEnabled = settings.enabled;
  const assistantOn = assistantDraft.enabled;

  return (
    <AdminSection id={AI_SETTINGS_SECTION_ID} title={AI_SETTINGS_CARD_TITLE} icon={Sparkles}>
      <div className="space-y-4">
        {platformReadOnly ? (
          <AiSettingsStatusNote>
            Contact the organization owner to change AI settings.
          </AiSettingsStatusNote>
        ) : null}

        <AiSettingsToggleRow
          id="org-ai-platform-enabled"
          label={AI_SETTINGS_ORG_MASTER_LABEL}
          checked={settings.enabled}
          disabled={platformReadOnly}
          pending={updatePlatform.isPending}
          onCheckedChange={handlePlatformToggle}
        />

        {!masterEnabled ? (
          <AiSettingsStatusNote>
            Usage and feature settings appear when AI is on. All properties follow this switch.
          </AiSettingsStatusNote>
        ) : null}

        {masterEnabled ? (
          <>
            {usage ? (
              <AiSettingsFeatureGroup title={AI_SETTINGS_PLATFORM_GROUP_TITLE}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <AiSettingsUsageStat
                    label="Today"
                    value={`${usage.todayCallCount} / ${usage.dailyCallLimit}`}
                  />
                  <AiSettingsUsageStat
                    label="This month"
                    value={`${usage.monthCallCount} / ${usage.monthlyCallLimit}`}
                  />
                  <AiSettingsUsageStat
                    label="Est. cost today"
                    value={`$${usage.todayCostUsd.toFixed(2)} / $${usage.dailyCostUsdLimit}`}
                  />
                  <AiSettingsUsageStat
                    label="Plan"
                    value={<span className="capitalize">{usage.planTier.replace('_', ' ')}</span>}
                  />
                </div>
                <AiSettingsCreditsBar
                  consumed={usage.monthCreditsConsumed}
                  limit={usage.monthlyCreditLimit}
                  walletBalance={usage.walletBalanceCredits}
                />
                {showUpgradeStub ? (
                  <AiSettingsStatusNote>
                    Need more capacity?{' '}
                    <PlanUpgradeLink feature="aiMonthlyCreditAllowance">Upgrade</PlanUpgradeLink>
                  </AiSettingsStatusNote>
                ) : null}
              </AiSettingsFeatureGroup>
            ) : null}

            <AiSettingsFeatureGroup title={AI_SETTINGS_ORG_ASSISTANT_GROUP_TITLE} icon={Bot}>
              {!assistantSettings?.platformEnabled ? (
                <AiSettingsStatusNote>
                  The dashboard assistant is currently off platform-wide.
                </AiSettingsStatusNote>
              ) : null}

              {assistantReadOnly ? (
                <AiSettingsStatusNote>
                  Contact the organization owner to change assistant settings.
                </AiSettingsStatusNote>
              ) : null}

              <AiSettingsToggleRow
                id="org-ai-assistant-enabled"
                label={AI_SETTINGS_ASSISTANT_TOGGLE_LABEL}
                checked={assistantDraft.enabled}
                disabled={assistantReadOnly}
                onCheckedChange={(enabled) => {
                  setAssistantUserEdited(true);
                  setAssistantDraft((current) => (current ? { ...current, enabled } : current));
                }}
              />

              {assistantOn ? (
                <>
                  {assistantSettings?.usage ? (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <AiSettingsUsageStat
                        label="Messages this month"
                        value={`${assistantSettings.usage.monthMessageCount} / ${assistantSettings.monthlyMessageLimit}`}
                      />
                      <AiSettingsUsageStat
                        label="Write actions"
                        value={String(assistantSettings.usage.monthWriteActionCount)}
                      />
                      <AiSettingsUsageStat
                        label="Credits used"
                        value={`~${Math.round(assistantSettings.usage.monthCreditsConsumed).toLocaleString()}`}
                      />
                    </div>
                  ) : null}

                  {properties.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs font-medium">
                        Disable on specific properties
                      </p>
                      <div
                        className="border-border/60 max-h-72 space-y-0.5 overflow-y-auto overscroll-contain rounded-lg border p-1.5"
                        role="group"
                        aria-label="Properties without dashboard assistant"
                      >
                        {properties.map((property) => (
                          <label
                            key={property.id}
                            className="flex min-h-[44px] items-center gap-2 rounded-md px-2 text-sm"
                          >
                            <Checkbox
                              checked={assistantDraft.disabledPropertyIds.includes(property.id)}
                              disabled={assistantReadOnly}
                              onCheckedChange={(checked) => {
                                setAssistantUserEdited(true);
                                setAssistantDraft((current) => {
                                  if (!current) return current;
                                  const next = checked
                                    ? [...current.disabledPropertyIds, property.id]
                                    : current.disabledPropertyIds.filter(
                                        (id) => id !== property.id
                                      );
                                  return { ...current, disabledPropertyIds: next };
                                });
                              }}
                              aria-label={`Disable dashboard assistant on ${property.name}`}
                            />
                            {property.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {assistantDirty && !assistantReadOnly ? (
                    <Button
                      type="button"
                      className="min-h-[44px]"
                      disabled={updateAssistant.isPending}
                      onClick={() => void handleAssistantSave()}
                    >
                      {updateAssistant.isPending ? 'Saving…' : 'Save assistant settings'}
                    </Button>
                  ) : null}
                </>
              ) : null}
            </AiSettingsFeatureGroup>

            <OrgVoiceReceptionistGroup properties={properties} readOnly={platformReadOnly} />
          </>
        ) : null}
      </div>
    </AdminSection>
  );
}
