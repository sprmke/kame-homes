import { useEffect, useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { AlertCircle, Car, Home, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { TowerUnitConflictAlert } from '@/features/dashboard/org/components/TowerUnitConflictAlert';
import { useCheckPropertyName } from '@/features/dashboard/org/hooks/useCheckPropertyName';
import { useCreateParking } from '@/features/dashboard/org/hooks/useCreateParking';
import { useCreateProperty } from '@/features/dashboard/org/hooks/useCreateProperty';
import { useParkingSlotConflict } from '@/features/dashboard/org/hooks/useParkingSlotConflict';
import { useTowerUnitConflict } from '@/features/dashboard/org/hooks/useTowerUnitConflict';
import {
  DEFAULT_DEVELOPMENT_NAME,
  getOrgDevelopmentNames,
  getParkingTowersForDevelopment,
  getPropertyTowersForDevelopment,
} from '@/features/dashboard/org/lib/orgDevelopments';
import {
  getParkingLevelsForTower,
  DEFAULT_PARKING_LEVEL,
  DEFAULT_PARKING_TOWER,
} from '@/features/dashboard/org/lib/parkingResidences';
import {
  formatParkingCode,
  formatParkingDisplayName,
  inferParkingTypeForTower,
  isValidParkingSlotNumber,
  sanitizeParkingSlotNumber,
} from '@/features/dashboard/org/lib/parkingSlotDisplay';
import {
  formatTowerAndUnit,
  isPropertyTowerForResidence,
  isValidUnitNumber,
  sanitizeUnitNumberInput,
  type PropertyTower,
} from '@/features/dashboard/org/lib/propertyTowerUnit';
import { orgPlansPath } from '@/features/dashboard/org/lib/tenantPaths';
import type { Parking, Property } from '@/features/dashboard/org/types';
import { useOrgPlan } from '@/features/dashboard/plans/hooks/useOrgPlan';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { AvailabilityCheckInput } from '@/components/AvailabilityCheckInput';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
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
import { SegmentedControl } from '@/components/ui/sliding-tabs';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { useRunUnguarded } from '@/hooks/useUnsavedChangesGuard';
import {
  resolveAsyncAvailabilityState,
  resolveNameAvailabilityState,
} from '@/lib/availabilityCheckState';
import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';
import { cn } from '@/lib/utils';

type AssetKind = 'property' | 'parking';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgSlug: string;
  orgName: string;
  canAddProperty?: boolean;
  canAddParking?: boolean;
  defaultKind?: AssetKind;
  onPropertyCreated?: (property: Property) => void;
  onParkingCreated?: (parking: Parking) => void;
};

function KindToggle({
  kind,
  onKindChange,
}: {
  kind: AssetKind;
  onKindChange: (kind: AssetKind) => void;
}) {
  return (
    <SegmentedControl
      value={kind}
      onChange={onKindChange}
      size="dense"
      fullWidth
      triggerClassName="gap-2 px-3"
      aria-label="Asset type"
      options={[
        { value: 'property', label: 'Property', icon: Home },
        { value: 'parking', label: 'Parking', icon: Car },
      ]}
    />
  );
}

function DevelopmentField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (name: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Development</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-10">
          <SelectValue placeholder="Select development" />
        </SelectTrigger>
        <SelectContent position="popper">
          {getOrgDevelopmentNames().map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AddEntityDialog({
  open,
  onOpenChange,
  orgId,
  orgSlug,
  orgName,
  canAddProperty = true,
  canAddParking = true,
  defaultKind = 'property',
  onPropertyCreated,
  onParkingCreated,
}: Props) {
  const navigate = useNavigate();
  const runUnguarded = useRunUnguarded();
  const createProperty = useCreateProperty();
  const createParking = useCreateParking();
  const { data: orgPlan } = useOrgPlan(orgId);

  const showKindToggle = canAddProperty && canAddParking;
  const [kind, setKind] = useState<AssetKind>(defaultKind);

  const [tower, setTower] = useState<PropertyTower | ''>('');
  const [unitNumber, setUnitNumber] = useState('');
  const [unitTouched, setUnitTouched] = useState(false);
  const [propertyDisplayName, setPropertyDisplayName] = useState('');
  const [developmentName, setDevelopmentName] = useState(DEFAULT_DEVELOPMENT_NAME);
  const propertyTowerOptions = getPropertyTowersForDevelopment(developmentName);
  const {
    conflict,
    hasActiveListing: propertyListed,
    isChecking: towerUnitChecking,
  } = useTowerUnitConflict(tower, unitNumber);
  const unitInvalid = unitTouched && unitNumber.length > 0 && !isValidUnitNumber(unitNumber);
  const towerUnitReady =
    isPropertyTowerForResidence(tower, developmentName) && isValidUnitNumber(unitNumber);
  const resolvedPropertyName =
    propertyDisplayName.trim() || (towerUnitReady ? formatTowerAndUnit(tower, unitNumber) : '');
  const propertyNameReady = towerUnitReady && resolvedPropertyName.trim().length >= 2;
  const propertyNameCheck = useCheckPropertyName(
    resolvedPropertyName,
    undefined,
    propertyNameReady
  );
  const propertyNameBlocked = propertyNameReady && propertyNameCheck.isUnavailable;
  const propertyNameBlockMessage = propertyNameBlocked
    ? (propertyNameCheck.data?.message ?? 'A property with this name already exists.')
    : null;
  const propertyNameAvailabilityState = resolveNameAvailabilityState({
    ready: propertyNameReady,
    showChecking: propertyNameCheck.showChecking,
    isUnavailable: propertyNameCheck.isUnavailable,
    isFetched: propertyNameCheck.isFetched,
  });
  const unitAvailabilityState = resolveAsyncAvailabilityState({
    ready: towerUnitReady,
    isChecking: towerUnitChecking,
    hasConflict: propertyListed,
  });
  const propertyCanSubmit = towerUnitReady && !propertyNameBlocked;

  const [parkingTower, setParkingTower] = useState(DEFAULT_PARKING_TOWER);
  const [level, setLevel] = useState(DEFAULT_PARKING_LEVEL);
  const [slotNumber, setSlotNumber] = useState('');
  const parkingDisplayName = useMemo(
    () => formatParkingDisplayName(parkingTower, level, slotNumber),
    [parkingTower, level, slotNumber]
  );
  const parkingCode = useMemo(
    () => formatParkingCode(parkingTower, level, slotNumber),
    [parkingTower, level, slotNumber]
  );
  const { hasDuplicate: parkingDuplicate, isChecking: parkingSlotChecking } =
    useParkingSlotConflict(parkingTower, level, slotNumber, developmentName);
  const parkingSlotReady =
    Boolean(parkingTower) && Boolean(level) && isValidParkingSlotNumber(slotNumber);
  const parkingSlotAvailabilityState = resolveAsyncAvailabilityState({
    ready: parkingSlotReady,
    isChecking: parkingSlotChecking,
    hasConflict: parkingDuplicate,
  });
  const parkingCanSubmit = parkingSlotReady && !parkingDuplicate;

  const parkingTowerOptions = getParkingTowersForDevelopment(developmentName);
  const parkingLevelOptions = getParkingLevelsForTower(parkingTower);

  const [error, setError] = useState<string | null>(null);
  const isPending = createProperty.isPending || createParking.isPending;
  const activeKind: AssetKind = showKindToggle ? kind : canAddProperty ? 'property' : 'parking';
  const canSubmit = activeKind === 'property' ? propertyCanSubmit : parkingCanSubmit;

  useEffect(() => {
    if (!open) return;

    const resolvedKind: AssetKind =
      canAddProperty && !canAddParking
        ? 'property'
        : !canAddProperty && canAddParking
          ? 'parking'
          : defaultKind;

    setKind(resolvedKind);
    setTower('');
    setUnitNumber('');
    setUnitTouched(false);
    setPropertyDisplayName('');
    setDevelopmentName(DEFAULT_DEVELOPMENT_NAME);
    setParkingTower(DEFAULT_PARKING_TOWER);
    setLevel(DEFAULT_PARKING_LEVEL);
    setSlotNumber('');
    setError(null);
  }, [open, canAddProperty, canAddParking, defaultKind]);

  useEffect(() => {
    setError(null);
  }, [kind, tower, unitNumber, parkingTower, level, slotNumber, developmentName]);

  const isDirty =
    open &&
    (tower !== '' ||
      unitNumber !== '' ||
      propertyDisplayName !== '' ||
      slotNumber !== '' ||
      developmentName !== DEFAULT_DEVELOPMENT_NAME ||
      parkingTower !== DEFAULT_PARKING_TOWER ||
      level !== DEFAULT_PARKING_LEVEL);
  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open,
    onOpenChange,
    isDirty,
    onSave: () => (canSubmit && !isPending ? handleSubmit() : false),
  });

  const handleDevelopmentChange = (name: string) => {
    setDevelopmentName(name);
    setTower('');
    setUnitNumber('');
    setUnitTouched(false);
    setParkingTower(DEFAULT_PARKING_TOWER);
    setLevel(DEFAULT_PARKING_LEVEL);
    setSlotNumber('');
  };

  const handleParkingTowerChange = (value: string) => {
    setParkingTower(value as typeof DEFAULT_PARKING_TOWER);
    const levels = getParkingLevelsForTower(value);
    if (level && !levels.includes(level)) setLevel(DEFAULT_PARKING_LEVEL);
  };

  const handleSubmit = async (): Promise<boolean> => {
    if (activeKind === 'property') {
      setUnitTouched(true);
      if (!propertyCanSubmit || !isPropertyTowerForResidence(tower, developmentName)) return false;

      const resolvedName = propertyDisplayName.trim() || formatTowerAndUnit(tower, unitNumber);
      if (resolvedName.length < 2) {
        setError('Display name must be at least 2 characters');
        return false;
      }
      if (propertyNameBlocked) {
        setError(propertyNameBlockMessage ?? 'This name is reserved and cannot be used');
        return false;
      }

      setError(null);
      try {
        const result = await createProperty.mutateAsync({
          orgId,
          orgSlug,
          name: resolvedName,
          tower,
          unitNumber,
          residenceName: developmentName,
        });
        runUnguarded(() => {
          onOpenChange(false);
          onPropertyCreated?.(result.property);
          if (result.billingRequired) {
            toast.message('Cover this property on your plan');
            const planId = orgPlan?.subscription?.planId;
            navigate(
              planId
                ? `${orgPlansPath(orgSlug)}?reviewPlan=${encodeURIComponent(planId)}`
                : orgPlansPath(orgSlug)
            );
          }
        });
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add property');
        return false;
      }
    }

    if (!parkingCanSubmit || !parkingTower || !level || !parkingDisplayName) return false;
    setError(null);
    try {
      const { parking } = await createParking.mutateAsync({
        orgId,
        orgSlug,
        name: parkingDisplayName,
        tower: parkingTower,
        level,
        slotLabel: slotNumber.trim(),
        parkingType: inferParkingTypeForTower(parkingTower),
        residenceName: developmentName,
      });
      runUnguarded(() => {
        onOpenChange(false);
        onParkingCreated?.(parking);
      });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add parking');
      return false;
    }
  };

  const propertyFieldErrorClass =
    towerUnitReady && propertyListed ? 'border-amber-500/40' : undefined;

  return (
    <>
      <AdminDialogShell
        open={open}
        onOpenChange={guardedOpenChange}
        title="New listing"
        description={`Add to ${orgName}`}
        sizeClassName="max-w-[min(calc(100vw-1.5rem),26rem)] sm:max-w-[min(90vw,28rem)]"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={requestClose}
              disabled={isPending}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit || isPending}
              className="min-h-[44px]"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : activeKind === 'property' ? (
                'Add property'
              ) : (
                'Add parking'
              )}
            </Button>
          </>
        }
      >
        {showKindToggle ? <KindToggle kind={kind} onKindChange={setKind} /> : null}

        <div className={cn(showKindToggle && 'mt-3', 'space-y-3')}>
          <DevelopmentField
            id="add-entity-development"
            value={developmentName}
            onChange={handleDevelopmentChange}
          />

          {activeKind === 'property' ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="add-entity-property-tower">Tower</Label>
                  <Select
                    value={tower || undefined}
                    onValueChange={(value) => setTower(value as PropertyTower)}
                  >
                    <SelectTrigger
                      id="add-entity-property-tower"
                      className={cn('h-10', propertyFieldErrorClass)}
                      aria-invalid={undefined}
                    >
                      <SelectValue placeholder="Select tower" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {propertyTowerOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="add-entity-property-unit">Unit</Label>
                  <AvailabilityCheckInput
                    id="add-entity-property-unit"
                    inputMode="numeric"
                    autoComplete="off"
                    value={unitNumber}
                    onChange={(e) => setUnitNumber(sanitizeUnitNumberInput(e.target.value))}
                    onBlur={() => setUnitTouched(true)}
                    placeholder={FORM_PLACEHOLDERS.unitNumber}
                    maxLength={4}
                    aria-invalid={unitInvalid || undefined}
                    className={cn('h-10 tabular-nums', propertyFieldErrorClass)}
                    checkState={unitAvailabilityState}
                  />
                  {unitInvalid ? (
                    <p role="alert" className="text-destructive text-xs">
                      Enter a 4-digit unit number
                    </p>
                  ) : null}
                </div>
              </div>

              {towerUnitReady && propertyListed ? (
                <TowerUnitConflictAlert tower={tower} unitNumber={unitNumber} conflict={conflict} />
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="add-entity-property-name">Display name</Label>
                <AvailabilityCheckInput
                  id="add-entity-property-name"
                  value={propertyDisplayName}
                  onChange={(e) => setPropertyDisplayName(e.target.value)}
                  placeholder={
                    towerUnitReady
                      ? formatTowerAndUnit(tower, unitNumber)
                      : FORM_PLACEHOLDERS.towerAndUnit
                  }
                  maxLength={120}
                  autoComplete="off"
                  aria-invalid={Boolean(propertyNameBlockMessage)}
                  className={cn('h-10', propertyNameBlockMessage && 'border-destructive')}
                  checkState={propertyNameAvailabilityState}
                />
                {propertyNameBlockMessage ? (
                  <p role="alert" className="text-destructive text-xs">
                    {propertyNameBlockMessage}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="add-entity-parking-tower">Tower</Label>
                  <Select
                    value={parkingTower || undefined}
                    onValueChange={handleParkingTowerChange}
                  >
                    <SelectTrigger id="add-entity-parking-tower" className="h-10">
                      <SelectValue placeholder="Tower" />
                    </SelectTrigger>
                    <SelectContent>
                      {parkingTowerOptions.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="add-entity-parking-level">Level</Label>
                  <Select
                    value={level || undefined}
                    onValueChange={(value) => setLevel(value as typeof DEFAULT_PARKING_LEVEL)}
                  >
                    <SelectTrigger id="add-entity-parking-level" className="h-10">
                      <SelectValue placeholder="Level" />
                    </SelectTrigger>
                    <SelectContent>
                      {parkingLevelOptions.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-entity-slot-number">Slot number</Label>
                <AvailabilityCheckInput
                  id="add-entity-slot-number"
                  inputMode="numeric"
                  autoComplete="off"
                  value={slotNumber}
                  onChange={(e) => setSlotNumber(sanitizeParkingSlotNumber(e.target.value))}
                  placeholder="26"
                  maxLength={4}
                  className={cn('h-10 tabular-nums', parkingDuplicate && 'border-destructive')}
                  aria-invalid={Boolean(parkingDuplicate)}
                  checkState={parkingSlotAvailabilityState}
                />
                {parkingDuplicate ? (
                  <p role="alert" className="text-destructive text-xs">
                    This slot is already registered
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-entity-parking-code">Code</Label>
                <Input
                  id="add-entity-parking-code"
                  value={parkingCode}
                  readOnly
                  aria-readonly="true"
                  placeholder="-"
                  className="bg-muted/40 text-muted-foreground h-10 cursor-default font-mono tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-entity-parking-name">Display name</Label>
                <Input
                  id="add-entity-parking-name"
                  value={parkingDisplayName}
                  readOnly
                  aria-readonly="true"
                  placeholder="-"
                  className="bg-muted/40 text-muted-foreground h-10 cursor-default"
                />
              </div>
            </>
          )}
        </div>

        {error ? (
          <div
            className="border-destructive/20 bg-destructive/5 text-destructive mt-3 flex items-start gap-2 rounded-xl border p-3"
            role="alert"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-[13px] leading-snug">{error}</p>
          </div>
        ) : null}
      </AdminDialogShell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
