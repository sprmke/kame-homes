import { type ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { HostDashboardTourPlayer } from '@/features/guest/marketing/for-hosts/components/HostDashboardTourPlayer';
import { MarketingBrandLogo } from '@/features/guest/marketing/shared/components/MarketingBrandLogo';

import { cn } from '@/lib/utils';

export type HostWorkspaceSidePanelVariant = 'auth' | 'onboarding';

interface HostWorkspaceSidePanelContent {
  title: ReactNode;
  description: string;
  tourRegionLabel: string;
}

const HOST_WORKSPACE_SIDE_PANEL_CONTENT: Record<
  HostWorkspaceSidePanelVariant,
  HostWorkspaceSidePanelContent
> = {
  auth: {
    title: 'Property management made simple',
    description: 'All the tools you need to manage your property in one workspace.',
    tourRegionLabel: 'Interactive preview of host features',
  },
  onboarding: {
    title: 'See workspace in action',
    description: 'Watch all the features available to you as a host',
    tourRegionLabel: 'Interactive preview of host features',
  },
};

export interface HostWorkspaceSidePanelProps {
  variant: HostWorkspaceSidePanelVariant;
  className?: string;
}

export function HostWorkspaceSidePanel({ variant, className }: HostWorkspaceSidePanelProps) {
  const content = HOST_WORKSPACE_SIDE_PANEL_CONTENT[variant];

  return (
    <aside
      className={cn('bg-primary relative hidden min-h-screen flex-col lg:flex', className)}
      aria-label="Host workspace preview"
    >
      <Link
        to="/for-hosts"
        className="group absolute left-4 top-4 z-20 min-h-[44px] rounded-lg outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/80"
      >
        <MarketingBrandLogo
          tone="onPrimary"
          className="transition-opacity group-hover:opacity-90"
        />
      </Link>

      <div className="relative z-10 flex min-h-screen flex-1 flex-col justify-center px-6 py-10 xl:px-10 xl:py-12">
        <div className="mx-auto w-full max-w-xl space-y-6 xl:space-y-7">
          <div className="space-y-2">
            <h1 className="text-xl font-bold leading-tight tracking-tight text-white sm:text-2xl xl:text-3xl">
              {content.title}
            </h1>
            <p className="text-base leading-relaxed text-white/80 sm:text-lg">
              {content.description}
            </p>
          </div>

          <HostDashboardTourPlayer variant="compact" regionLabel={content.tourRegionLabel} />
        </div>
      </div>
    </aside>
  );
}
