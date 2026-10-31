import type { HostProperty } from '@/features/dashboard/super-admin/types/host';

export type PlatformProperty = HostProperty & {
  developmentSlug: string | null;
  developmentName: string | null;
};
