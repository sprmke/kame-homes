import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigate, useParams } from 'react-router-dom';

import { AlertTriangle, Award, Info, Save, ScrollText, Share2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { ActivitySettingsSection } from '@/features/dashboard/activity/components/ActivitySettingsSection';
import {
  AdminSection,
  AdminSectionNavLayout,
  type AdminSectionNavItem,
} from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { RequireAdmin } from '@/features/dashboard/bookings/components/RequireAdmin';
import { storedOrgSettingsMediaUrl } from '@/features/dashboard/lib/storedMediaDisplay';
import { OrgAiSettingsSection } from '@/features/dashboard/org/components/org-settings/OrgAiSettingsSection';
import {
  AI_SETTINGS_NAV_LABEL,
  AI_SETTINGS_SECTION_ID,
} from '@/features/dashboard/org/lib/aiSettingsLabels';
import { OrgDangerZoneSection } from '@/features/dashboard/org/components/org-settings/OrgDangerZoneSection';
import {
  OrgBasicInformationSection,
  OrgSocialsBrandingSection,
} from '@/features/dashboard/org/components/org-settings/OrgProfileSettingsSections';
import { OrgSettingsBrandColorPreview } from '@/features/dashboard/org/components/org-settings/OrgSettingsBrandColorPreview';
import { OrgSuperhostProgressSection } from '@/features/dashboard/org/components/org-settings/OrgSuperhostProgressSection';
import { useCheckOrganizationName } from '@/features/dashboard/org/hooks/useCheckOrganizationName';
import { useDeleteOrganization } from '@/features/dashboard/org/hooks/useDeleteOrganization';
import { useOrganizations, useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import {
  orgOperatorFormIsDirty,
  orgSettingsToFormValues,
  useOrgSettings,
  useUpdateOrgSettings,
  type OrgOperatorSettingsFormValues,
} from '@/features/dashboard/org/hooks/useOrgSettings';
import {
  useOrgSettingsCompletionForDraft,
  useSavedOrgSettingsCompletion,
} from '@/features/dashboard/org/hooks/useOrgSettingsCompletion';
import { useUpdateOrganization } from '@/features/dashboard/org/hooks/useUpdateOrganization';
import { rememberTenantSlugChange } from '@/features/dashboard/org/lib/tenantSlugRemap';
import { type OrgSettingsSectionId } from '@/features/dashboard/org/lib/orgSettingsCompletion';
import { resolveOrgSettingsFieldError } from '@/features/dashboard/org/lib/orgSettingsFieldError';
import {
  orgSettingsDraftFromOrg,
  orgSettingsDraftIsDirty,
  orgSettingsDraftToPayload,
  orgSlugPreview,
  type OrgSettingsDraft,
} from '@/features/dashboard/org/lib/orgSettingsForm';
import { setOrgSettingsIssueSections } from '@/features/dashboard/org/lib/orgSettingsIssuesStore';
import { planOrgSettingsSave } from '@/features/dashboard/org/lib/orgSettingsSave';
import { useOrgPermissions } from '@/features/dashboard/team/hooks/useOrgPermissions';
import { hasOrgPermission } from '@/features/dashboard/team/lib/orgPermissions';

import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { MobileHeroActionButton } from '@/components/mobile/MobileHeroActionButton';
import { AppSettingsNavLayoutSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { useRunUnguarded, useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { resolveNameAvailabilityState } from '@/lib/availabilityCheckState';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { usePageTitle } from '@/lib/pageTitle';

const SETTINGS_SECTIONS: AdminSectionNavItem[] = [
  { id: 'basic', label: 'Basic information', icon: Info },
  { id: 'branding', label: 'Socials', icon: Share2 },
  { id: 'superhost', label: 'Superhost', icon: Award },
  { id: AI_SETTINGS_SECTION_ID, label: AI_SETTINGS_NAV_LABEL, icon: Sparkles },
  { id: 'activity', label: 'Activity', icon: ScrollText },
  { id: 'danger', label: 'Danger zone', icon: AlertTriangle },
];

export function useOrgSettingsController() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const navigate = useNavigate();
  const runUnguarded = useRunUnguarded();
  const { data, isLoading: orgsLoading } = useOrganizations();
  const { isLoading: propsLoading } = useProperties(orgSlug);
  const { data: orgAccess } = useOrgPermissions();
  const {
    data: operatorData,
    isLoading: operatorLoading,
    isError: operatorError,
    error: operatorLoadError,
  } = useOrgSettings();
  const updateOrganization = useUpdateOrganization();
  const updateOrgSettings = useUpdateOrgSettings();
  const deleteOrganization = useDeleteOrganization();

  const org = data?.organizations.find((entry) => entry.slug === orgSlug);

  const canEditBasicSettings = orgAccess?.canEditBasicSettings ?? false;
  const canEditSocials = orgAccess?.canEditSocials ?? false;
  const canDeleteOrganization =
    orgAccess?.accessKind === 'owner' || orgAccess?.accessKind === 'platform_admin';
  const canViewActivity =
    canDeleteOrganization || hasOrgPermission(orgAccess?.permissions, 'org.activity:view');

  usePageTitle(org ? `${org.name} - Settings` : undefined);

  const [profileBaseline, setProfileBaseline] = useState<OrgSettingsDraft | null>(null);
  const [operatorBaseline, setOperatorBaseline] = useState<OrgOperatorSettingsFormValues | null>(
    null
  );

  const [profileDraft, setProfileDraft] = useState<OrgSettingsDraft | null>(null);
  const [operatorDraft, setOperatorDraft] = useState<OrgOperatorSettingsFormValues | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [interactedFields, setInteractedFields] = useState<Record<string, boolean>>({});

  const markFieldInteracted = useCallback((fieldId: string) => {
    setInteractedFields((current) => {
      if (current[fieldId]) return current;
      return { ...current, [fieldId]: true };
    });
  }, []);

  const profileDirtyRef = useRef(false);
  const operatorDirtyRef = useRef(false);

  useEffect(() => {
    if (!org) return;
    if (profileDirtyRef.current) return;
    const next = orgSettingsDraftFromOrg(org);
    setProfileDraft(next);
    setProfileBaseline(next);
  }, [org?.id, org?.updatedAt, org?.settings]);

  useEffect(() => {
    if (!operatorData) return;
    const next = orgSettingsToFormValues(operatorData);
    setOperatorBaseline(next);
    if (!operatorDirtyRef.current) {
      setOperatorDraft(next);
    }
  }, [operatorData]);

  const profileDirty =
    profileDraft && profileBaseline
      ? orgSettingsDraftIsDirty(profileDraft, profileBaseline)
      : false;
  profileDirtyRef.current = profileDirty;
  const operatorDirty =
    operatorDraft && operatorBaseline
      ? orgOperatorFormIsDirty(operatorDraft, operatorBaseline)
      : false;
  operatorDirtyRef.current = operatorDirty;
  const canSaveProfile = profileDirty && canEditBasicSettings;
  const canSaveOperator = operatorDirty && canEditSocials;
  const canSaveAny = canSaveProfile || canSaveOperator;

  const nameChanged =
    profileDraft && profileBaseline
      ? profileDraft.name.trim().toLowerCase() !== profileBaseline.name.trim().toLowerCase()
      : false;

  const nameCheck = useCheckOrganizationName(
    profileDraft?.name ?? '',
    org?.id,
    Boolean(profileDraft && nameChanged)
  );

  const nameUnavailable = nameChanged && nameCheck.isUnavailable;
  const nameConflictMessage = nameUnavailable ? (nameCheck.data?.message ?? null) : null;
  const nameChecking = nameChanged && nameCheck.showChecking;
  const nameAvailabilityState = resolveNameAvailabilityState({
    ready: Boolean(profileDraft && nameChanged && profileDraft.name.trim().length >= 2),
    showChecking: nameCheck.showChecking,
    isUnavailable: nameCheck.isUnavailable,
    isFetched: nameCheck.isFetched,
  });

  const busy =
    updateOrganization.isPending || updateOrgSettings.isPending || deleteOrganization.isPending;
  const isLoading = orgsLoading || propsLoading || operatorLoading;

  const setProfileField = <K extends keyof OrgSettingsDraft>(
    key: K,
    value: OrgSettingsDraft[K]
  ) => {
    setProfileDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const setOperatorField = <K extends keyof OrgOperatorSettingsFormValues>(
    key: K,
    value: OrgOperatorSettingsFormValues[K]
  ) => {
    setOperatorDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const scrollToOrgSettingsSection = (sectionId: OrgSettingsSectionId) => {
    document
      .getElementById(`section-${sectionId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSave = async (): Promise<boolean> => {
    if (!org || !profileDraft || !operatorDraft || !profileBaseline || !operatorBaseline) {
      return false;
    }

    const plan = planOrgSettingsSave({
      profileDraft,
      profileBaseline,
      operatorDraft,
      operatorBaseline,
      completion: settingsCompletion,
    });

    const willSaveProfile = plan.saveProfile && canEditBasicSettings;
    const willSaveOperator = plan.saveOperator && canEditSocials;

    if (!willSaveProfile && !willSaveOperator) {
      setShowValidationErrors(true);
      if (plan.firstBlockedMessage) {
        toast.error(plan.firstBlockedMessage);
      } else if (!canSaveAny) {
        toast.message('No changes to save');
      }
      if (plan.firstBlockedSectionId) {
        scrollToOrgSettingsSection(plan.firstBlockedSectionId);
      }
      return false;
    }

    setShowValidationErrors(false);

    try {
      let savedSomething = false;

      if (willSaveProfile) {
        const payload = orgSettingsDraftToPayload(profileDraft, org.id);
        const result = await updateOrganization.mutateAsync(payload);
        const savedProfile = orgSettingsDraftFromOrg(result.organization);
        setProfileDraft(savedProfile);
        setProfileBaseline(savedProfile);
        const nextSlug = result.organization.slug;
        if (orgSlug && nextSlug !== orgSlug) {
          rememberTenantSlugChange('org', orgSlug, nextSlug);
          runUnguarded(() => navigate(`/org/${nextSlug}/settings`, { replace: true }));
        }
        savedSomething = true;
      }

      if (willSaveOperator) {
        const saved = await updateOrgSettings.mutateAsync(operatorDraft);
        const values = orgSettingsToFormValues(saved);
        setOperatorDraft(values);
        setOperatorBaseline(values);
        savedSomething = true;
      }

      if (savedSomething) {
        setInteractedFields({});
        if (plan.blockedSections.length > 0) {
          toast.success('New changes has been saved.');
          scrollToOrgSettingsSection(plan.blockedSections[0]!);
        } else {
          toast.success('Settings saved');
        }
        return true;
      }
      return false;
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not save settings'));
      return false;
    }
  };

  useUnsavedChangesGuard({ isDirty: canSaveAny, onSave: handleSave });

  const handleDeleteOrganization = async () => {
    if (!org) return;
    try {
      await deleteOrganization.mutateAsync(org.id);
      toast.success('Organization deleted');
      navigate('/org', { replace: true });
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not delete organization'));
      throw error;
    }
  };

  const operatorSources = operatorData?.fieldSources;
  const formBusy = busy || isLoading;
  const slugPreview =
    org && profileDraft && profileBaseline
      ? orgSlugPreview(profileDraft.name, org.slug, profileBaseline.name)
      : '';

  const savedCompletion = useSavedOrgSettingsCompletion();

  const hasOrgLogo = Boolean(
    operatorData &&
    storedOrgSettingsMediaUrl(operatorData.emailLogoUrl, operatorData.fieldSources.emailLogoUrl)
  );

  const completionInput =
    profileDraft && operatorDraft
      ? {
          profile: profileDraft,
          operator: operatorDraft,
          nameUnavailable,
          hasOrgLogo,
        }
      : null;

  const { completion: settingsCompletion } = useOrgSettingsCompletionForDraft(completionInput);

  const navSections = useMemo((): AdminSectionNavItem[] => {
    return SETTINGS_SECTIONS.filter(
      (section) =>
        (section.id !== 'danger' || canDeleteOrganization) &&
        (section.id !== 'activity' || canViewActivity)
    ).map((section) => ({
      ...section,
      hasIssue:
        section.id !== 'danger' &&
        settingsCompletion.issueSectionIds.includes(section.id as OrgSettingsSectionId),
    }));
  }, [settingsCompletion.issueSectionIds, canDeleteOrganization, canViewActivity]);

  useEffect(() => {
    if (!profileDraft || !operatorDraft) return;
    setOrgSettingsIssueSections(settingsCompletion.issueSectionIds);
    return () => {
      setOrgSettingsIssueSections(savedCompletion.issueSectionIds);
    };
  }, [
    profileDraft,
    operatorDraft,
    settingsCompletion.issueSectionIds,
    savedCompletion.issueSectionIds,
  ]);

  const resolveFieldError = useCallback(
    (fieldId: string) =>
      resolveOrgSettingsFieldError(
        fieldId,
        settingsCompletion.fieldErrors,
        interactedFields,
        showValidationErrors
      ),
    [settingsCompletion.fieldErrors, interactedFields, showValidationErrors]
  );

  return {
    navigate,
    data,
    orgsLoading,
    propsLoading,
    orgAccess,
    operatorData,
    operatorLoading,
    operatorError,
    operatorLoadError,
    updateOrganization,
    updateOrgSettings,
    deleteOrganization,
    org,
    canEditBasicSettings,
    canEditSocials,
    canDeleteOrganization,
    profileBaseline,
    setProfileBaseline,
    operatorBaseline,
    setOperatorBaseline,
    profileDraft,
    setProfileDraft,
    operatorDraft,
    setOperatorDraft,
    showValidationErrors,
    setShowValidationErrors,
    interactedFields,
    setInteractedFields,
    markFieldInteracted,
    profileDirtyRef,
    operatorDirtyRef,
    profileDirty,
    operatorDirty,
    canSaveProfile,
    canSaveOperator,
    canSaveAny,
    nameChanged,
    nameCheck,
    nameUnavailable,
    nameConflictMessage,
    nameChecking,
    nameAvailabilityState,
    busy,
    isLoading,
    setProfileField,
    setOperatorField,
    scrollToOrgSettingsSection,
    handleSave,
    handleDeleteOrganization,
    operatorSources,
    formBusy,
    slugPreview,
    savedCompletion,
    hasOrgLogo,
    completionInput,
    settingsCompletion,
    navSections,
    canViewActivity,
    resolveFieldError,
    orgSlug,
  };
}

export function OrgSettingsPage() {
  const {
    operatorData,
    operatorError,
    operatorLoadError,
    deleteOrganization,
    org,
    canEditBasicSettings,
    canEditSocials,
    canDeleteOrganization,
    profileDraft,
    operatorDraft,
    markFieldInteracted,
    canSaveAny,
    nameUnavailable,
    nameConflictMessage,
    nameChecking,
    nameAvailabilityState,
    busy,
    isLoading,
    setProfileField,
    setOperatorField,
    handleSave,
    handleDeleteOrganization,
    operatorSources,
    formBusy,
    slugPreview,
    navSections,
    canViewActivity,
    resolveFieldError,
  } = useOrgSettingsController();

  return (
    <RequireAdmin>
      <AdminMobilePage
        title="Settings"
        subtitle="Manage your organization's profile, billing, and preferences."
        titleId="org-settings-heading"
        className="flex min-h-0 flex-1 flex-col"
        heroTrailing={
          canSaveAny && profileDraft ? (
            <MobileHeroActionButton
              aria-label={busy ? 'Saving' : 'Save changes'}
              disabled={busy || nameUnavailable || nameChecking}
              onClick={() => void handleSave()}
            >
              <Save className="size-5" aria-hidden />
            </MobileHeroActionButton>
          ) : undefined
        }
        desktopActions={
          canSaveAny && profileDraft ? (
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy || nameUnavailable || nameChecking}
              className="min-h-[44px] gap-1.5"
            >
              <Save className="size-4" aria-hidden />
              {busy ? 'Saving…' : 'Save'}
            </Button>
          ) : undefined
        }
      >
        {profileDraft ? (
          <OrgSettingsBrandColorPreview brandColor={profileDraft.brandColor} />
        ) : null}
        {isLoading ? (
          <AppSettingsNavLayoutSkeleton />
        ) : !org || !profileDraft || !operatorDraft || !operatorData ? (
          <p className="text-muted-foreground text-sm">Organization not found.</p>
        ) : (
          <AdminSectionNavLayout className="min-h-0 flex-1" sections={navSections}>
            {operatorError ? (
              <p className="text-destructive text-sm">
                {(operatorLoadError as Error)?.message ?? 'Could not load organization settings'}
              </p>
            ) : null}

            <OrgBasicInformationSection
              draft={profileDraft}
              disabled={formBusy || !canEditBasicSettings}
              slugPreview={slugPreview}
              logoSource={operatorSources?.emailLogoUrl}
              logoUrl={operatorData.emailLogoUrl}
              nameUnavailable={nameUnavailable}
              nameConflictMessage={nameConflictMessage}
              nameAvailabilityState={nameAvailabilityState}
              resolveFieldError={resolveFieldError}
              markFieldInteracted={markFieldInteracted}
              onChange={setProfileField}
            />

            <OrgSocialsBrandingSection
              operatorDraft={operatorDraft}
              disabled={formBusy || !canEditSocials}
              resolveFieldError={resolveFieldError}
              markFieldInteracted={markFieldInteracted}
              onOperatorChange={setOperatorField}
            />

            <OrgSuperhostProgressSection />

            <OrgAiSettingsSection />

            {canViewActivity ? (
              <AdminSection id="activity" title="Activity" icon={ScrollText}>
                <ActivitySettingsSection scope="org" />
              </AdminSection>
            ) : null}

            {canDeleteOrganization ? (
              <OrgDangerZoneSection
                orgName={org.name}
                orgSlug={org.slug}
                disabled={formBusy}
                deletePending={deleteOrganization.isPending}
                onDelete={handleDeleteOrganization}
              />
            ) : null}
          </AdminSectionNavLayout>
        )}
      </AdminMobilePage>
    </RequireAdmin>
  );
}
