import { useMemo } from 'react';

import { useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useParkings } from '@/features/dashboard/org/hooks/useParkings';
import {
  defaultListingPropertyTemplateName,
  LISTING_PARKING_ROLE_OPTIONS,
  LISTING_PROPERTY_TEMPLATE_OPTIONS,
  normalizeLegacyParkingListingRoleId,
  resolveListingPropertyTemplateName,
} from '@/features/dashboard/team/lib/listingAssignmentRoles';
import type { SeededPropertyTemplateName } from '@/features/dashboard/team/lib/propertyTeamTemplates';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export type OrgListingPropertyAssignment = {
  propertyId: string;
  roleId: string;
  permissions: string[];
};

export type OrgListingParkingAssignment = {
  parkingId: string;
  roleId: string;
  permissions: string[];
};

export type OrgListingAssignments = {
  properties: OrgListingPropertyAssignment[];
  parkings: OrgListingParkingAssignment[];
};

type Props = {
  orgSlug: string;
  allListings: boolean;
  assignments: OrgListingAssignments;
  defaultParkingRoleId?: string;
  onAllListingsChange: (value: boolean) => void;
  onAssignmentsChange: (value: OrgListingAssignments) => void;
  disabled?: boolean;
  className?: string;
  /** When false, parent controls all-listings mode (role template editor). */
  showAllListingsToggle?: boolean;
  /** Nested inside OrgRoleListingAccessSection — tighter panels, no outer toggle. */
  embedded?: boolean;
};

const DEFAULT_PARKING_ROLE = 'MANAGER';

export function emptyOrgListingAssignments(): OrgListingAssignments {
  return { properties: [], parkings: [] };
}

export function OrgListingAssignmentPicker({
  orgSlug,
  allListings,
  assignments,
  defaultParkingRoleId = DEFAULT_PARKING_ROLE,
  onAllListingsChange,
  onAssignmentsChange,
  disabled = false,
  className,
  showAllListingsToggle = true,
  embedded = false,
}: Props) {
  const { data: propertiesData } = useProperties(orgSlug);
  const { data: parkingsData } = useParkings(orgSlug);

  const properties = propertiesData?.properties ?? [];
  const parkings = parkingsData?.parkings ?? [];

  // Listing UI stores seeded template names (Full Access / Operations / Read Only).
  // Server resolves each name → property template UUID on invite accept / member sync —
  // do not preload per-property custom roles here (N requests disables the checkboxes).
  const defaultPropertyTemplateName = defaultListingPropertyTemplateName();

  const selectedPropertyIds = useMemo(
    () => new Set(assignments.properties.map((entry) => entry.propertyId)),
    [assignments.properties]
  );
  const selectedParkingIds = useMemo(
    () => new Set(assignments.parkings.map((entry) => entry.parkingId)),
    [assignments.parkings]
  );

  const toggleProperty = (propertyId: string, checked: boolean) => {
    if (checked) {
      onAssignmentsChange({
        ...assignments,
        properties: [
          ...assignments.properties,
          {
            propertyId,
            roleId: defaultPropertyTemplateName,
            permissions: [],
          },
        ],
      });
      return;
    }
    onAssignmentsChange({
      ...assignments,
      properties: assignments.properties.filter((entry) => entry.propertyId !== propertyId),
    });
  };

  const toggleParking = (parkingId: string, checked: boolean) => {
    if (checked) {
      onAssignmentsChange({
        ...assignments,
        parkings: [
          ...assignments.parkings,
          {
            parkingId,
            roleId: normalizeLegacyParkingListingRoleId(defaultParkingRoleId),
            permissions: [],
          },
        ],
      });
      return;
    }
    onAssignmentsChange({
      ...assignments,
      parkings: assignments.parkings.filter((entry) => entry.parkingId !== parkingId),
    });
  };

  const selectAllProperties = () => {
    onAssignmentsChange({
      ...assignments,
      properties: properties.map((property) => ({
        propertyId: property.id,
        roleId: defaultPropertyTemplateName,
        permissions: [],
      })),
    });
  };

  const selectAllParkings = () => {
    onAssignmentsChange({
      ...assignments,
      parkings: parkings.map((parking) => ({
        parkingId: parking.id,
        roleId: normalizeLegacyParkingListingRoleId(defaultParkingRoleId),
        permissions: [],
      })),
    });
  };

  const updatePropertyTemplate = (propertyId: string, templateName: SeededPropertyTemplateName) => {
    onAssignmentsChange({
      ...assignments,
      properties: assignments.properties.map((entry) =>
        entry.propertyId === propertyId
          ? {
              ...entry,
              roleId: templateName,
              permissions: [],
            }
          : entry
      ),
    });
  };

  const updateParkingRole = (parkingId: string, roleId: string) => {
    onAssignmentsChange({
      ...assignments,
      parkings: assignments.parkings.map((entry) =>
        entry.parkingId === parkingId
          ? { ...entry, roleId: normalizeLegacyParkingListingRoleId(roleId), permissions: [] }
          : entry
      ),
    });
  };

  const selectionCount = (selected: number, total: number) =>
    total > 0 ? (
      <span className="text-muted-foreground ml-1.5 text-xs font-normal">
        {selected}/{total}
      </span>
    ) : null;

  return (
    <div className={cn(embedded ? 'space-y-3' : 'space-y-4', className)}>
      {showAllListingsToggle ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
          <Label htmlFor="org-all-listings" className="text-sm font-medium">
            All listings
          </Label>
          <Switch
            id="org-all-listings"
            checked={allListings}
            onCheckedChange={onAllListingsChange}
            disabled={disabled}
          />
        </div>
      ) : null}

      {!allListings ? (
        <div className={cn(embedded ? 'space-y-3' : 'space-y-4')}>
          {properties.length > 0 ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  Properties
                  {embedded ? selectionCount(selectedPropertyIds.size, properties.length) : null}
                </p>
                <button
                  type="button"
                  className="text-primary min-h-[44px] text-xs font-medium sm:min-h-0"
                  onClick={selectAllProperties}
                  disabled={disabled}
                >
                  Select all
                </button>
              </div>
              <div
                className={cn(
                  'max-h-44 space-y-0.5 overflow-y-auto rounded-lg p-1.5',
                  embedded ? 'bg-muted/40' : 'border p-2'
                )}
              >
                {properties.map((property) => {
                  const checked = selectedPropertyIds.has(property.id);
                  const assignment = assignments.properties.find(
                    (entry) => entry.propertyId === property.id
                  );
                  const selectedTemplate = assignment
                    ? resolveListingPropertyTemplateName(assignment.roleId)
                    : defaultPropertyTemplateName;

                  return (
                    <div
                      key={property.id}
                      className={cn(
                        'flex min-h-[44px] items-center gap-2 rounded-md px-2 py-1.5 sm:min-h-0',
                        embedded && checked && 'bg-background shadow-sm',
                        !embedded && 'px-1'
                      )}
                    >
                      <Checkbox
                        id={`org-listing-property-${property.id}`}
                        checked={checked}
                        onCheckedChange={(value) => toggleProperty(property.id, value === true)}
                        disabled={disabled}
                        className="size-5"
                      />
                      <Label
                        htmlFor={`org-listing-property-${property.id}`}
                        className="min-w-0 flex-1 truncate text-sm font-normal"
                      >
                        {property.name}
                      </Label>
                      {checked ? (
                        <Select
                          value={selectedTemplate}
                          onValueChange={(value) =>
                            updatePropertyTemplate(property.id, value as SeededPropertyTemplateName)
                          }
                          disabled={disabled}
                        >
                          <SelectTrigger className="h-8 w-[8.5rem] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LISTING_PROPERTY_TEMPLATE_OPTIONS.map((option) => (
                              <SelectItem key={option.name} value={option.name}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {parkings.length > 0 ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  Parkings
                  {embedded ? selectionCount(selectedParkingIds.size, parkings.length) : null}
                </p>
                <button
                  type="button"
                  className="text-primary min-h-[44px] text-xs font-medium sm:min-h-0"
                  onClick={selectAllParkings}
                  disabled={disabled}
                >
                  Select all
                </button>
              </div>
              <div
                className={cn(
                  'max-h-44 space-y-0.5 overflow-y-auto rounded-lg p-1.5',
                  embedded ? 'bg-muted/40' : 'border p-2'
                )}
              >
                {parkings.map((parking) => {
                  const checked = selectedParkingIds.has(parking.id);
                  const assignment = assignments.parkings.find(
                    (entry) => entry.parkingId === parking.id
                  );
                  const parkingRoleId = normalizeLegacyParkingListingRoleId(
                    assignment?.roleId ?? defaultParkingRoleId
                  );

                  return (
                    <div
                      key={parking.id}
                      className={cn(
                        'flex min-h-[44px] items-center gap-2 rounded-md px-2 py-1.5 sm:min-h-0',
                        embedded && checked && 'bg-background shadow-sm',
                        !embedded && 'px-1'
                      )}
                    >
                      <Checkbox
                        id={`org-listing-parking-${parking.id}`}
                        checked={checked}
                        onCheckedChange={(value) => toggleParking(parking.id, value === true)}
                        disabled={disabled}
                        className="size-5"
                      />
                      <Label
                        htmlFor={`org-listing-parking-${parking.id}`}
                        className="min-w-0 flex-1 truncate text-sm font-normal"
                      >
                        {parking.name}
                      </Label>
                      {checked ? (
                        <Select
                          value={parkingRoleId}
                          onValueChange={(value) => updateParkingRole(parking.id, value)}
                          disabled={disabled}
                        >
                          <SelectTrigger className="h-8 w-[8.5rem] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LISTING_PARKING_ROLE_OPTIONS.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {properties.length === 0 && parkings.length === 0 ? (
            <p className="text-muted-foreground text-sm">No listings in this organization yet.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
