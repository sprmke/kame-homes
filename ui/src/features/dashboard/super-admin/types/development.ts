export type DevelopmentType =
  'CONDOMINIUM' | 'SUBDIVISION' | 'MIXED_USE' | 'TOWNHOUSE' | 'COMMERCIAL';

export type DevelopmentStatus = 'ACTIVE' | 'INACTIVE';

export type DevelopmentListStats = {
  propertyCount: number;
  parkingCount: number;
};

export type Development = {
  id: string;
  slug: string;
  name: string;
  developerName: string | null;
  type: DevelopmentType;
  status: DevelopmentStatus;
  location: string | null;
  city: string | null;
  description: string | null;
  coverImageUrl: string | null;
  settings: Record<string, unknown>;
  stats: DevelopmentListStats;
  createdAt: string;
  updatedAt: string;
};
