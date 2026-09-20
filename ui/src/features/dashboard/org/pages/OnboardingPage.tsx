import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { Navigate, useNavigate } from 'react-router-dom';

import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Car, Check, Home, Loader2 } from 'lucide-react';

import { hostLoginPath } from '@/features/guest/auth/lib/hostAuthPaths';


import { RequireAdmin } from '@/features/dashboard/bookings/components/RequireAdmin';
import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';
import { OnboardingFeatureShowcase } from '@/features/dashboard/org/components/onboarding/OnboardingFeatureShowcase';
import { OnboardingHostVerificationSection } from '@/features/dashboard/org/components/onboarding/OnboardingHostVerificationSection';
import {
  OnboardingProfileHeader,
  readGoogleAvatarUrl,
} from '@/features/dashboard/org/components/onboarding/OnboardingProfileHeader';
import { OnboardingStepHeader } from '@/features/dashboard/org/components/onboarding/OnboardingStepHeader';
import { OnboardingTrustNotice } from '@/features/dashboard/org/components/onboarding/OnboardingTrustNotice';
import { OnboardingVerificationRightsFields } from '@/features/dashboard/org/components/onboarding/OnboardingVerificationRightsFields';
import { VerificationFieldLabel } from '@/features/dashboard/org/components/onboarding/VerificationFieldLabel';
import { RequiredMark } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import { TowerUnitConflictAlert } from '@/features/dashboard/org/components/TowerUnitConflictAlert';
import { useCheckOrganizationName } from '@/features/dashboard/org/hooks/useCheckOrganizationName';
import { useCheckPropertyName } from '@/features/dashboard/org/hooks/useCheckPropertyName';
import {
  ORGANIZATIONS_QUERY_KEY,
  useOrganizations,
} from '@/features/dashboard/org/hooks/useOrganizations';
import { useParkingSlotConflict } from '@/features/dashboard/org/hooks/useParkingSlotConflict';
import { useTowerUnitConflict } from '@/features/dashboard/org/hooks/useTowerUnitConflict';
import { callEdgeFunction, getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';
import { submitListingAuthorization } from '@/features/dashboard/org/lib/listingAuthorizationApi';
import {
  HOST_VERIFICATION_REJECTED_PATH,
  resolveOrgLandingPath,
  userOwnsOrganization,
} from '@/features/dashboard/org/lib/orgLanding';
import { DUPLICATE_ORGANIZATION_NAME_MESSAGE } from '@/features/dashboard/org/lib/orgSettingsValidation';
import {
  type OrgVerificationRights,
  verificationRightsNeedsContractEnd,
  validateVerificationContractEndDate,
  validateVerificationFile,
} from '@/features/dashboard/org/lib/orgVerification';
import {
  AZURE_NORTH_PARKING_TOWERS,
  DEFAULT_PARKING_LEVEL,
  DEFAULT_PARKING_RESIDENCE_NAME,
  DEFAULT_PARKING_TOWER,
  getParkingLevelsForTower,
  type AzureNorthParkingLevel,
  type AzureNorthParkingTower,
} from '@/features/dashboard/org/lib/parkingResidences';
import {
  formatParkingCode,
  formatParkingDisplayName,
  inferParkingTypeForTower,
  isValidParkingSlotNumber,
  sanitizeParkingSlotNumber,
} from '@/features/dashboard/org/lib/parkingSlotDisplay';
import { DEFAULT_RESIDENCE_NAME } from '@/features/dashboard/org/lib/propertyDisplay';
import {
  DEFAULT_PROPERTY_TOWER,
  getTowersForResidence,
} from '@/features/dashboard/org/lib/propertyResidences';
import {
  formatTowerAndUnit,
  isPropertyTowerForResidence,
  isValidUnitNumber,
  sanitizeUnitNumberInput,
  type PropertyTower,
} from '@/features/dashboard/org/lib/propertyTowerUnit';
import {
  orgDashboardPath,
  parkingSectionPath,
  propertySectionPath,
  setLastParkingContext,
  setLastTenantContext,
} from '@/features/dashboard/org/lib/tenantPaths';
import type { Organization } from '@/features/dashboard/org/types';

import { AvailabilityCheckInput } from '@/components/AvailabilityCheckInput';
import { RouteGuardSkeleton } from '@/components/skeletons/AdminSkeletons';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  resolveAsyncAvailabilityState,
  resolveNameAvailabilityState,
} from '@/lib/availabilityCheckState';
import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';
import { prepareUpload } from '@/lib/media/prepareUpload';
import { appPageTitle, usePageTitle } from '@/lib/pageTitle';
import { captureAppEvent } from '@/lib/posthog/capture';
import { cn } from '@/lib/utils';
import {
  validateFullPersonName,
  validatePhilippineMobilePhone,
} from '@/lib/validation/fieldValidation';
import { getManilaYmdToday } from '@/utils/format/dates';

type OnboardingStep = 1 | 2 | 3;

type CreatedOnboardingTenant = {
  organization: { id: string; slug: string };
  property: { id: string; slug: string } | null;
  parking: { id: string; slug: string } | null;
};

function isAlreadyOwnOrganizationError(message: string): boolean {
  return /already own an organization/i.test(message);
}

function orgContactNameError(value: string): string | null {
  if (!value.trim()) return 'Enter your full name';
  return validateFullPersonName(value);
}

function orgContactPhoneError(value: string): string | null {
  if (!value.trim()) return 'Enter a phone number';
  return validatePhilippineMobilePhone(value);
}

export type HostModeChoice = 'property' | 'parking';

function handleVerificationRightsChange(
  value: OrgVerificationRights,
  setRights: (value: OrgVerificationRights) => void,
  setContractEndDate: Dispatch<SetStateAction<string>>
) {
  setRights(value);
  if (verificationRightsNeedsContractEnd(value)) {
    setContractEndDate((prev) => prev || getManilaYmdToday());
  } else {
    setContractEndDate('');
  }
}

function HostModeOption({
  selected,
  onToggle,
  label,
  icons,
  className,
}: {
  selected: boolean;
  onToggle: () => void;
  label: string;
  icons: readonly [typeof Home, ...(typeof Home)[]];
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        'border-border text-foreground hover:bg-muted/50 flex min-h-[44px] w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
        selected && 'border-primary bg-primary/10 text-primary shadow-sm',
        className
      )}
    >
      <span
        className={cn(
          'bg-muted/60 flex size-9 shrink-0 items-center justify-center rounded-lg',
          selected && 'bg-primary/15'
        )}
        aria-hidden
      >
        {icons.map((Icon, index) => (
          <Icon
            key={index}
            className={cn('size-4 shrink-0', index > 0 && icons.length > 1 && '-ml-1')}
          />
        ))}
      </span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {selected ? (
        <Check className="size-4 shrink-0 opacity-80" strokeWidth={2.5} aria-hidden />
      ) : null}
    </button>
  );
}

export function OnboardingPage() {
  usePageTitle(appPageTitle('Onboarding'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { email, name, session } = useAdminSession();
  const { data: orgsData, isLoading: orgsLoading } = useOrganizations();
  const avatarUrl = readGoogleAvatarUrl(
    session?.user?.user_metadata as Record<string, unknown> | undefined
  );

  const [step, setStep] = useState<OnboardingStep>(1);
  const [orgName, setOrgName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactNameTouched, setContactNameTouched] = useState(false);
  const [contactPhoneTouched, setContactPhoneTouched] = useState(false);
  const [hostProperty, setHostProperty] = useState(false);
  const [hostParking, setHostParking] = useState(false);

  const [userRole, setUserRole] = useState<OrgVerificationRights | ''>('');
  const [userRoleTouched, setUserRoleTouched] = useState(false);
  const [userContractEndDate, setUserContractEndDate] = useState('');
  const [validIdFile, setValidIdFile] = useState<File | null>(null);
  const [validIdPreview, setValidIdPreview] = useState<string | null>(null);
  const [socialProofFile, setSocialProofFile] = useState<File | null>(null);
  const [socialProofPreview, setSocialProofPreview] = useState<string | null>(null);
  const [verificationTouched, setVerificationTouched] = useState(false);
  const [verificationFormOpen, setVerificationFormOpen] = useState(false);
  const createdTenantRef = useRef<CreatedOnboardingTenant | null>(null);

  const [propertyName, setPropertyName] = useState('');
  const [tower, setTower] = useState<PropertyTower>(DEFAULT_PROPERTY_TOWER);
  const [unitNumber, setUnitNumber] = useState('');
  const [unitTouched, setUnitTouched] = useState(false);

  const [parkingTower, setParkingTower] = useState<AzureNorthParkingTower>(DEFAULT_PARKING_TOWER);
  const [parkingLevel, setParkingLevel] = useState(DEFAULT_PARKING_LEVEL);
  const [slotNumber, setSlotNumber] = useState('');
  const parkingDisplayName = useMemo(
    () => formatParkingDisplayName(parkingTower, parkingLevel, slotNumber),
    [parkingTower, parkingLevel, slotNumber]
  );
  const parkingCode = useMemo(
    () => formatParkingCode(parkingTower, parkingLevel, slotNumber),
    [parkingTower, parkingLevel, slotNumber]
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const sessionName = name?.trim();
    if (sessionName) {
      setContactName((current) => (current.trim() ? current : sessionName));
    }
  }, [name]);

  const towerOptions = getTowersForResidence(DEFAULT_RESIDENCE_NAME);
  const orgNameReady = orgName.trim().length >= 2;
  const contactNameError = orgContactNameError(contactName);
  const contactPhoneError = orgContactPhoneError(contactPhone);
  const orgContactReady = !contactNameError && !contactPhoneError;
  const showPropertyBlock = hostProperty;
  const showParkingBlock = hostParking;
  const hostModeReady = hostProperty || hostParking;

  const orgNameCheck = useCheckOrganizationName(orgName, undefined, orgNameReady);
  const orgNameUnavailable = orgNameCheck.isUnavailable;
  const orgNameBlockMessage = orgNameUnavailable
    ? (orgNameCheck.data?.message ?? DUPLICATE_ORGANIZATION_NAME_MESSAGE)
    : null;
  const orgNameChecking = orgNameCheck.isChecking;

  const propertyNameTrimmed = propertyName.trim();
  const propertyNameCheck = useCheckPropertyName(
    propertyNameTrimmed,
    undefined,
    showPropertyBlock && propertyNameTrimmed.length >= 2
  );
  const propertyNameUnavailable = propertyNameCheck.isUnavailable;
  const propertyNameBlockMessage = propertyNameUnavailable
    ? (propertyNameCheck.data?.message ?? 'A property with this name already exists.')
    : null;
  const propertyNameChecking = propertyNameCheck.isChecking;

  const propertyReady =
    !showPropertyBlock ||
    (isPropertyTowerForResidence(tower, DEFAULT_RESIDENCE_NAME) &&
      isValidUnitNumber(unitNumber) &&
      propertyNameTrimmed.length >= 2);
  const unitInvalid = unitTouched && !isValidUnitNumber(unitNumber);
  const {
    conflict: towerUnitConflict,
    hasActiveListing: towerUnitListed,
    isChecking: towerUnitChecking,
  } = useTowerUnitConflict(tower, unitNumber);
  const towerUnitReady =
    isPropertyTowerForResidence(tower, DEFAULT_RESIDENCE_NAME) && isValidUnitNumber(unitNumber);
  const unitFieldError = unitInvalid ? 'Enter a 4-digit unit number' : null;
  const towerMissing = unitTouched && !isPropertyTowerForResidence(tower, DEFAULT_RESIDENCE_NAME);
  const propertyNameMissing = showPropertyBlock && unitTouched && propertyNameTrimmed.length < 2;

  const parkingSlotReady =
    !showParkingBlock ||
    (Boolean(parkingTower) &&
      Boolean(parkingLevel) &&
      isValidParkingSlotNumber(slotNumber) &&
      Boolean(parkingDisplayName));
  const {
    conflict: parkingConflict,
    hasDuplicate: parkingSlotDuplicate,
    isChecking: parkingSlotChecking,
  } = useParkingSlotConflict(parkingTower, parkingLevel, slotNumber);

  const orgNameAvailabilityState = resolveNameAvailabilityState({
    ready: orgNameReady,
    showChecking: orgNameCheck.showChecking,
    isUnavailable: orgNameUnavailable,
    isFetched: orgNameCheck.isFetched,
  });
  const unitAvailabilityState = resolveAsyncAvailabilityState({
    ready: towerUnitReady,
    isChecking: towerUnitChecking,
    hasConflict: towerUnitListed,
  });
  const propertyNameAvailabilityState = resolveNameAvailabilityState({
    ready: showPropertyBlock && propertyNameTrimmed.length >= 2,
    showChecking: propertyNameCheck.showChecking,
    isUnavailable: propertyNameUnavailable,
    isFetched: propertyNameCheck.isFetched,
  });
  const parkingSlotAvailabilityState = resolveAsyncAvailabilityState({
    ready:
      showParkingBlock &&
      Boolean(parkingTower) &&
      Boolean(parkingLevel) &&
      isValidParkingSlotNumber(slotNumber),
    isChecking: parkingSlotChecking,
    hasConflict: parkingSlotDuplicate,
  });

  const userContractEndError = verificationRightsNeedsContractEnd(userRole)
    ? validateVerificationContractEndDate(userContractEndDate)
    : null;
  const userRoleReady = Boolean(userRole) && !userContractEndError;
  const canAdvanceStep2 =
    hostModeReady &&
    propertyReady &&
    !propertyNameUnavailable &&
    parkingSlotReady &&
    !parkingSlotDuplicate &&
    !propertyNameChecking &&
    !towerUnitChecking &&
    userRoleReady;

  const hostVerificationReady = Boolean(validIdFile && socialProofFile);
  const verificationReady = hostVerificationReady;

  const canAdvance =
    (step === 1 && orgNameReady && orgContactReady && !orgNameUnavailable && !orgNameChecking) ||
    (step === 2 && canAdvanceStep2) ||
    (step === 3 && verificationFormOpen && verificationReady);

  const markOrgContactTouched = () => {
    setContactNameTouched(true);
    setContactPhoneTouched(true);
  };

  const handleBack = () => {
    setError(null);
    if (step === 3) {
      setVerificationFormOpen(false);
      setVerificationTouched(false);
    }
    setStep((s) => (s > 1 ? ((s - 1) as OnboardingStep) : s));
  };

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      markOrgContactTouched();
      if (!canAdvance) return;
    }
    if (step === 2) {
      setUserRoleTouched(true);
      if (showPropertyBlock) setUnitTouched(true);
      if (!canAdvanceStep2) return;
    }
    if (step === 3) {
      setVerificationTouched(true);
      if (!verificationReady) return;
      captureAppEvent('onboarding_step_completed', {
        step_id: 3,
        step_name: 'verification',
        skipped: false,
      });
      void submitOnboarding();
      return;
    }
    if (step < 3) {
      const stepNames = ['org', 'listing', 'verification'] as const;
      captureAppEvent('onboarding_step_completed', {
        step_id: step,
        step_name: stepNames[step - 1] ?? 'unknown',
        skipped: false,
      });
      setStep((s) => (s + 1) as OnboardingStep);
    }
  };

  const uploadVerificationAsset = async (orgId: string, assetType: string, file: File) => {
    const prepared = await prepareUpload(file, {
      imagePreset: 'DOCUMENT',
      surface: `onboarding-verification-${assetType}`,
    });
    if (prepared.error) throw new Error(prepared.error);
    const preparedFile = prepared.file;

    const jwt = await getSessionJwt();
    const form = new FormData();
    form.append('orgId', orgId);
    form.append('assetType', assetType);
    form.append('file', preparedFile);
    form.append('fileName', preparedFile.name);
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/upload-org-verification-asset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
    });
    const json = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !json.success) {
      throw new Error(json.error ?? 'Verification upload failed');
    }
  };

  const submitOnboarding = async () => {
    if (!orgNameReady || !orgContactReady || !hostModeReady || !userRoleReady || !verificationReady)
      return;
    if (validIdFile) {
      const err = validateVerificationFile(validIdFile);
      if (err) {
        setError(err);
        return;
      }
    }
    if (socialProofFile) {
      const err = validateVerificationFile(socialProofFile);
      if (err) {
        setError(err);
        return;
      }
    }
    setError(null);
    setSubmitting(true);

    const hostModes: string[] = [
      ...(hostProperty ? (['property'] as const) : []),
      ...(hostParking ? (['parking'] as const) : []),
    ];

    const body: Record<string, unknown> = {
      name: orgName.trim(),
      contactName: contactName.trim(),
      contactRole: userRole,
      contactPhone: contactPhone.trim(),
      hostModes,
      residenceName: DEFAULT_RESIDENCE_NAME,
    };

    if (showPropertyBlock && propertyReady) {
      body.tower = tower;
      body.unitNumber = unitNumber;
      body.propertyName = propertyNameTrimmed;
    }

    if (showParkingBlock && parkingSlotReady) {
      body.parking = {
        tower: parkingTower,
        level: parkingLevel,
        slotLabel: slotNumber.trim(),
        parkingType: inferParkingTypeForTower(parkingTower),
        residenceName: DEFAULT_PARKING_RESIDENCE_NAME,
        name: parkingDisplayName,
      };
    }

    try {
      let data = createdTenantRef.current;
      if (!data) {
        try {
          data = await callEdgeFunction<CreatedOnboardingTenant>('create-organization', {
            method: 'POST',
            body: JSON.stringify(body),
          });
        } catch (createErr) {
          const createMessage = createErr instanceof Error ? createErr.message : '';
          if (isAlreadyOwnOrganizationError(createMessage)) {
            await queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
            const fresh = await queryClient.fetchQuery({
              queryKey: ORGANIZATIONS_QUERY_KEY,
              queryFn: () =>
                callEdgeFunction<{ organizations: Organization[] }>('list-organizations'),
            });
            const landing = resolveOrgLandingPath(fresh.organizations ?? []);
            if (landing !== '/onboarding') {
              navigate(landing, { replace: true });
              return;
            }
          }
          throw createErr;
        }
        createdTenantRef.current = data;
        await queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
      }

      // Host Tier 1 — Valid ID + Facebook Page screenshot (org scope).
      await uploadVerificationAsset(data.organization.id, 'valid_id', validIdFile!);
      await uploadVerificationAsset(data.organization.id, 'social_proof', socialProofFile!);
      await callEdgeFunction('submit-org-verification', {
        method: 'POST',
        body: JSON.stringify({
          orgId: data.organization.id,
          tier: 'base',
        }),
      });

      const listingContractEnd = verificationRightsNeedsContractEnd(userRole)
        ? { contractEndDate: userContractEndDate }
        : {};

      // Listing Tier 1 — relationship per created property/parking (no proof file).
      if (showPropertyBlock && data.property?.id && userRole) {
        await submitListingAuthorization({
          listingKind: 'property',
          listingId: data.property.id,
          relationship: userRole,
          ...listingContractEnd,
        });
      }

      if (showParkingBlock && data.parking?.id && userRole) {
        await submitListingAuthorization({
          listingKind: 'parking',
          listingId: data.parking.id,
          relationship: userRole,
          ...listingContractEnd,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });

      const orgSlug = data.organization.slug;
      const propertySlug = data.property?.slug;
      const parkingSlug = data.parking?.slug;

      if (propertySlug) {
        setLastTenantContext(orgSlug, propertySlug);
        navigate(propertySectionPath(orgSlug, propertySlug, 'dashboard'), { replace: true });
      } else if (parkingSlug) {
        setLastParkingContext(orgSlug, parkingSlug);
        navigate(parkingSectionPath(orgSlug, parkingSlug, 'dashboard'), { replace: true });
      } else {
        navigate(orgDashboardPath(orgSlug), { replace: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Setup failed';
      if (/session expired|sign in again/i.test(message)) {
        navigate(hostLoginPath('/onboarding'), { replace: true });
        return;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel = step === 3 ? 'Finish setup' : 'Continue';
  const rightsKind = showParkingBlock && !showPropertyBlock ? 'parking' : 'property';
  const rightsFields = (
    <OnboardingVerificationRightsFields
      idPrefix={rightsKind === 'parking' ? 'parking-rights' : 'property-rights'}
      kind={rightsKind}
      hideRoleHelp
      rights={userRole}
      onRightsChange={(value) =>
        handleVerificationRightsChange(value, setUserRole, setUserContractEndDate)
      }
      rightsError={
        userRoleTouched && !userRole
          ? rightsKind === 'parking'
            ? 'Select parking rights'
            : 'Select property rights'
          : null
      }
      contractEndDate={userContractEndDate}
      onContractEndDateChange={setUserContractEndDate}
      contractEndDateError={
        userRoleTouched && verificationRightsNeedsContractEnd(userRole)
          ? userContractEndError
          : null
      }
    />
  );

  const existingOrgs = orgsData?.organizations ?? [];
  if (orgsLoading) {
    return (
      <RequireAdmin>
        <RouteGuardSkeleton fullScreen />
      </RequireAdmin>
    );
  }
  // Stay when no usable org (none, plan-limited-only, or hard-rejected-only).
  // Owned orgs are detected here (and at login) — never wait until Finish setup.
  const landing = resolveOrgLandingPath(existingOrgs);
  if (
    userOwnsOrganization(existingOrgs) ||
    (landing !== '/onboarding' && landing !== HOST_VERIFICATION_REJECTED_PATH)
  ) {
    return (
      <RequireAdmin>
        <Navigate to={landing} replace />
      </RequireAdmin>
    );
  }

  return (
    <RequireAdmin>
      <div className="grid min-h-screen lg:grid-cols-2">
        <OnboardingFeatureShowcase />

        <div className="bg-muted/25 lg:bg-muted/15 relative flex min-w-0 flex-col px-3 py-8 sm:px-6 sm:py-12">
          <div className="absolute right-3 top-3 sm:right-6 sm:top-6">
            <ThemeToggle />
          </div>

          <main className="mx-auto flex w-full max-w-[600px] flex-1 flex-col justify-center gap-6">
            <OnboardingProfileHeader name={name} email={email} avatarUrl={avatarUrl} />

            <div className="space-y-5">
              <div
                className={cn('border-border bg-card overflow-hidden rounded-xl border shadow-sm')}
              >
                <OnboardingStepHeader
                  activeStep={step}
                  verificationIntro={step === 3 && !verificationFormOpen}
                />

                <div className="px-4 pb-4 sm:px-6 sm:pb-6">
                  {step === 1 && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="org-name">
                          Organization name
                          <RequiredMark />
                        </Label>
                        <AvailabilityCheckInput
                          id="org-name"
                          name="organizationName"
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                          placeholder={FORM_PLACEHOLDERS.orgDisplayName}
                          required
                          minLength={2}
                          maxLength={120}
                          autoComplete="organization"
                          className={cn('h-10', orgNameBlockMessage && 'border-destructive')}
                          aria-invalid={Boolean(orgNameBlockMessage)}
                          checkState={orgNameAvailabilityState}
                        />
                        {orgNameBlockMessage ? (
                          <p role="alert" className="text-destructive text-xs">
                            {orgNameBlockMessage}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="contact-name">
                          Name
                          <RequiredMark />
                        </Label>
                        <Input
                          id="contact-name"
                          name="contactName"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          onBlur={() => setContactNameTouched(true)}
                          placeholder={FORM_PLACEHOLDERS.fullName}
                          autoComplete="name"
                          maxLength={120}
                          required
                          aria-invalid={Boolean(contactNameTouched && contactNameError)}
                          className={cn(
                            'h-10',
                            contactNameTouched && contactNameError && 'border-destructive'
                          )}
                        />
                        {contactNameTouched && contactNameError ? (
                          <p role="alert" className="text-destructive text-xs">
                            {contactNameError}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="contact-phone">
                          Contact number
                          <RequiredMark />
                        </Label>
                        <Input
                          id="contact-phone"
                          name="contactPhone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          onBlur={() => setContactPhoneTouched(true)}
                          placeholder={FORM_PLACEHOLDERS.phone}
                          required
                          aria-invalid={Boolean(contactPhoneTouched && contactPhoneError)}
                          className={cn(
                            'h-10 tabular-nums',
                            contactPhoneTouched && contactPhoneError && 'border-destructive'
                          )}
                        />
                        {contactPhoneTouched && contactPhoneError ? (
                          <p role="alert" className="text-destructive text-xs">
                            {contactPhoneError}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="text-foreground text-sm font-semibold">
                          What do you host?
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <HostModeOption
                            selected={hostProperty}
                            onToggle={() => setHostProperty((value) => !value)}
                            icons={[Home]}
                            label="Property"
                          />
                          <HostModeOption
                            selected={hostParking}
                            onToggle={() => setHostParking((value) => !value)}
                            icons={[Car]}
                            label="Parking"
                          />
                        </div>
                      </div>

                      {showPropertyBlock ? (
                        <div className="border-border space-y-3 rounded-xl border p-3 sm:p-4">
                          <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
                            <Home className="text-muted-foreground size-4" aria-hidden />
                            Property
                          </div>
                          <div className="space-y-1.5">
                            <VerificationFieldLabel
                              htmlFor="residence"
                              label="Residence"
                              help="For now we only support Azure North residence. More residences and property types are coming soon."
                            />
                            <Input
                              id="residence"
                              name="residenceName"
                              value={DEFAULT_RESIDENCE_NAME}
                              readOnly
                              aria-readonly="true"
                              className="bg-muted/40 text-muted-foreground h-10 cursor-default"
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label htmlFor="tower">
                                Tower
                                <RequiredMark />
                              </Label>
                              <Select
                                value={tower || undefined}
                                onValueChange={(value) => {
                                  setUnitTouched(true);
                                  setTower(value as PropertyTower);
                                }}
                              >
                                <SelectTrigger
                                  id="tower"
                                  className={cn('h-10', towerMissing && 'border-destructive')}
                                  aria-invalid={Boolean(towerMissing)}
                                >
                                  <SelectValue placeholder="Select tower" />
                                </SelectTrigger>
                                <SelectContent>
                                  {towerOptions.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {towerMissing ? (
                                <p role="alert" className="text-destructive text-xs">
                                  Select a tower
                                </p>
                              ) : null}
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="unit-number">
                                Unit
                                <RequiredMark />
                              </Label>
                              <AvailabilityCheckInput
                                id="unit-number"
                                inputMode="numeric"
                                value={unitNumber}
                                onChange={(e) => {
                                  setUnitTouched(true);
                                  setUnitNumber(sanitizeUnitNumberInput(e.target.value));
                                }}
                                placeholder={FORM_PLACEHOLDERS.unitNumber}
                                maxLength={4}
                                required
                                aria-invalid={Boolean(unitFieldError)}
                                className={cn(
                                  'h-10 tabular-nums',
                                  unitFieldError && 'border-destructive'
                                )}
                                checkState={unitAvailabilityState}
                              />
                              {unitFieldError ? (
                                <p role="alert" className="text-destructive text-xs">
                                  {unitFieldError}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          {towerUnitListed && towerUnitConflict ? (
                            <TowerUnitConflictAlert
                              tower={tower}
                              unitNumber={unitNumber}
                              conflict={towerUnitConflict}
                            />
                          ) : null}
                          <div className="space-y-1.5">
                            <Label htmlFor="property-name">
                              Property name
                              <RequiredMark />
                            </Label>
                            <AvailabilityCheckInput
                              id="property-name"
                              value={propertyName}
                              onChange={(e) => {
                                setUnitTouched(true);
                                setPropertyName(e.target.value);
                              }}
                              placeholder={
                                isPropertyTowerForResidence(tower, DEFAULT_RESIDENCE_NAME) &&
                                isValidUnitNumber(unitNumber)
                                  ? formatTowerAndUnit(tower, unitNumber)
                                  : FORM_PLACEHOLDERS.towerAndUnit
                              }
                              maxLength={120}
                              required
                              aria-invalid={Boolean(
                                propertyNameBlockMessage || propertyNameMissing
                              )}
                              className={cn(
                                'h-10',
                                (propertyNameBlockMessage || propertyNameMissing) &&
                                  'border-destructive'
                              )}
                              checkState={propertyNameAvailabilityState}
                            />
                            {propertyNameBlockMessage ? (
                              <p role="alert" className="text-destructive text-xs">
                                {propertyNameBlockMessage}
                              </p>
                            ) : propertyNameMissing ? (
                              <p role="alert" className="text-destructive text-xs">
                                Enter a property name
                              </p>
                            ) : null}
                          </div>
                          {rightsFields}
                        </div>
                      ) : null}

                      {showParkingBlock ? (
                        <div className="border-border space-y-3 rounded-xl border p-3 sm:p-4">
                          <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
                            <Car className="text-muted-foreground size-4" aria-hidden />
                            Parking
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label htmlFor="parking-tower">
                                Tower
                                <RequiredMark />
                              </Label>
                              <Select
                                value={parkingTower || undefined}
                                onValueChange={(v) => {
                                  setParkingTower(v as AzureNorthParkingTower);
                                  const levels = getParkingLevelsForTower(v);
                                  if (parkingLevel && !levels.includes(parkingLevel)) {
                                    setParkingLevel(
                                      (levels[0] as typeof parkingLevel) || DEFAULT_PARKING_LEVEL
                                    );
                                  }
                                }}
                              >
                                <SelectTrigger id="parking-tower" className="h-10">
                                  <SelectValue placeholder="Tower" />
                                </SelectTrigger>
                                <SelectContent>
                                  {AZURE_NORTH_PARKING_TOWERS.map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="parking-level">
                                Level
                                <RequiredMark />
                              </Label>
                              <Select
                                value={parkingLevel || undefined}
                                onValueChange={(v) => setParkingLevel(v as AzureNorthParkingLevel)}
                              >
                                <SelectTrigger id="parking-level" className="h-10">
                                  <SelectValue placeholder="Level" />
                                </SelectTrigger>
                                <SelectContent>
                                  {getParkingLevelsForTower(parkingTower).map((l) => (
                                    <SelectItem key={l} value={l}>
                                      {l}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="slot-number">
                              Slot number
                              <RequiredMark />
                            </Label>
                            <AvailabilityCheckInput
                              id="slot-number"
                              inputMode="numeric"
                              autoComplete="off"
                              value={slotNumber}
                              onChange={(e) =>
                                setSlotNumber(sanitizeParkingSlotNumber(e.target.value))
                              }
                              placeholder="26"
                              maxLength={4}
                              className={cn(
                                'h-10 tabular-nums',
                                parkingSlotDuplicate && 'border-destructive'
                              )}
                              aria-invalid={Boolean(parkingSlotDuplicate)}
                              checkState={parkingSlotAvailabilityState}
                            />
                            {parkingSlotDuplicate ? (
                              <p role="alert" className="text-destructive text-xs">
                                Slot taken
                                {parkingConflict?.orgName ? `: ${parkingConflict.orgName}` : ''}
                              </p>
                            ) : null}
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label htmlFor="parking-code">Code</Label>
                              <Input
                                id="parking-code"
                                value={parkingCode}
                                readOnly
                                aria-readonly="true"
                                placeholder="-"
                                className="bg-muted/40 text-muted-foreground h-10 cursor-default font-mono tabular-nums"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="parking-display-name">Parking name</Label>
                              <Input
                                id="parking-display-name"
                                value={parkingDisplayName}
                                readOnly
                                aria-readonly="true"
                                placeholder="-"
                                className="bg-muted/40 text-muted-foreground h-10 cursor-default"
                              />
                            </div>
                          </div>
                          {!showPropertyBlock ? rightsFields : null}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-5">
                      {!verificationFormOpen ? <OnboardingTrustNotice /> : null}
                      {!verificationFormOpen ? (
                        <Button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setVerificationFormOpen(true);
                          }}
                          className="min-h-[44px] w-full"
                        >
                          Let&apos;s get verified
                        </Button>
                      ) : (
                        <>
                          <OnboardingHostVerificationSection
                            file={validIdFile}
                            previewUrl={validIdPreview}
                            error={verificationTouched && !validIdFile ? 'Required' : null}
                            onFileChange={(file, preview) => {
                              setValidIdFile(file);
                              setValidIdPreview(preview);
                            }}
                            socialProofFile={socialProofFile}
                            socialProofPreviewUrl={socialProofPreview}
                            socialProofError={
                              verificationTouched && !socialProofFile ? 'Required' : null
                            }
                            onSocialProofChange={(file, preview) => {
                              setSocialProofFile(file);
                              setSocialProofPreview(preview);
                            }}
                            onUploadError={setError}
                          />
                        </>
                      )}
                    </div>
                  )}

                  {error ? (
                    <div
                      className="border-destructive/20 bg-destructive/5 text-destructive mt-5 flex items-start gap-2.5 rounded-xl border p-3.5"
                      role="alert"
                    >
                      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <p className="text-[13px] leading-snug">{error}</p>
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                    {step > 1 && (step !== 3 || verificationFormOpen) ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleBack}
                        disabled={submitting}
                        className="min-h-[44px] sm:min-w-[7rem]"
                      >
                        Back
                      </Button>
                    ) : (
                      <span className="hidden sm:block sm:min-w-[7rem]" aria-hidden />
                    )}
                    {step === 3 && !verificationFormOpen ? (
                      <span className="hidden sm:block sm:min-w-[10rem]" aria-hidden />
                    ) : (
                      <Button
                        type="button"
                        onClick={handleNext}
                        disabled={submitting || !canAdvance}
                        className="min-h-[44px] flex-1 sm:min-w-[10rem] sm:flex-none"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                            Creating…
                          </>
                        ) : (
                          submitLabel
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </RequireAdmin>
  );
}
