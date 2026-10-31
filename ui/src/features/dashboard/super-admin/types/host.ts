export type HostsSummary = {
  total: number;
  totalOrgs: number;
  totalProperties: number;
  totalParking: number;
};

export type HostStats = {
  organizationCount: number;
  propertyCount: number;
  parkingCount: number;
};

export type HostSummary = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  stats: HostStats;
  memberSince: string | null;
};

export type HostOrganization = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  settings: Record<string, unknown>;
  hostModes?: string[];
  createdAt: string;
  updatedAt: string;
  accessKind: 'owner';
  stats: {
    propertyCount: number;
    parkingCount: number;
  };
};

export type HostProperty = {
  id: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
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
  stats?: {
    activeBookings: number;
    monthlyRevenue: number;
    occupancyRate: number;
  };
  createdAt: string;
  updatedAt: string;
};
