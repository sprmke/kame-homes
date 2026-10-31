import type { OrgAccessKind } from '@/features/dashboard/team/lib/orgPermissions';

export type Organization = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  settings: Record<string, unknown>;
  hostModes?: string[];
  createdAt: string;
  updatedAt: string;
  accessKind?: OrgAccessKind;
  planLimited?: boolean;
};

export type ParkingListStats = {
  activeReservations: number;
  monthlyRevenue: number;
  occupancyRate: number;
};

export type Parking = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  status: string;
  residenceName: string | null;
  tower: string | null;
  level: string | null;
  slotLabel: string;
  parkingType: string;
  ratePerNight: number | null;
  acceptedVehicleTypes: string[];
  settings: Record<string, unknown>;
  stats?: ParkingListStats;
  createdAt: string;
  updatedAt: string;
};

export type PropertyListStats = {
  activeBookings: number;
  monthlyRevenue: number;
  occupancyRate: number;
};

export type Property = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  address: string | null;
  towerAndUnit: string | null;
  tower: string | null;
  unitNumber: string | null;
  residenceName: string | null;
  maxGuests: number | null;
  settings: Record<string, unknown>;
  stats?: PropertyListStats;
  createdAt: string;
  updatedAt: string;
};
