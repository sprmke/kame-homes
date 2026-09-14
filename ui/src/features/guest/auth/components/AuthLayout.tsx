import { lazy, Suspense, type MouseEvent } from 'react';

import { Link, Outlet, useLocation } from 'react-router-dom';

import { Calendar, Home, Search, ShieldCheck, Star } from 'lucide-react';

import { MarketingBrandLogo } from '@/features/guest/marketing/shared/components/MarketingBrandLogo';
import { useModeSwitchTransition } from '@/features/guest/marketing/shared/context/ModeSwitchTransitionContext';

import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { platformCopyrightLine } from '@/lib/platformBranding';

// Pulls in Remotion (video tour rendering) — this shell is imported eagerly by the
// guest auth route tree, so keep the heavy player out of the main bundle.
const HostWorkspaceSidePanel = lazy(() =>
  import('@/features/guest/marketing/shared/components/HostWorkspaceSidePanel').then((m) => ({
    default: m.HostWorkspaceSidePanel,
  }))
);

const HOST_AUTH_PREFIX = '/for-hosts/';

function useExploreHomeClick() {
  const { switchMode, isTransitioning } = useModeSwitchTransition();

  const handleExploreHome = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (isTransitioning) return;
    switchMode('guest');
  };

  return { handleExploreHome, isTransitioning };
}

function GuestAuthBrandingPanel() {
  return (
    <div className="relative z-10 flex h-full flex-col p-10">
      <Link to="/" className="group flex items-center gap-3">
        <MarketingBrandLogo
          tone="onPrimary"
          className="transition-opacity group-hover:opacity-90"
        />
      </Link>

      <div className="flex flex-1 flex-col items-center justify-center px-8">
        <div className="max-w-lg text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-4 py-2 text-sm text-white/90 backdrop-blur-sm">
            <Home className="h-4 w-4" />
            <span>Browse & book properties</span>
          </div>
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight text-white xl:text-5xl">
            Find your perfect
            <br />
            <span className="text-white/90">place to stay</span>
          </h1>
          <p className="mb-12 text-lg leading-relaxed text-white/85">
            Discover handpicked properties across the Philippines. Book with confidence and enjoy a
            seamless stay from check-in to check-out.
          </p>
        </div>

        <div className="grid w-full max-w-md grid-cols-2 gap-4">
          <GuestFeatureItem
            icon={<Search className="h-5 w-5" />}
            title="Easy Discovery"
            description="Browse hundreds of listings"
          />
          <GuestFeatureItem
            icon={<Calendar className="h-5 w-5" />}
            title="Instant Booking"
            description="Reserve your dates in seconds"
          />
          <GuestFeatureItem
            icon={<Star className="h-5 w-5" />}
            title="Verified Stays"
            description="Curated quality properties"
          />
          <GuestFeatureItem
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Secure & Safe"
            description="Protected booking process"
          />
        </div>

        <div className="mt-16 flex w-full max-w-md items-center justify-center gap-12 border-t border-white/20 pt-12">
          <GuestStatItem value="500+" label="Properties" />
          <GuestStatItem value="4.9★" label="Avg. Rating" />
          <GuestStatItem value="10k+" label="Happy Guests" />
        </div>
      </div>
    </div>
  );
}

function GuestFeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm transition-all duration-300 hover:border-white/30 hover:bg-white/20">
      <div className="mb-2 flex items-center gap-3">
        <div className="text-white">{icon}</div>
        <span className="font-medium text-white">{title}</span>
      </div>
      <p className="text-sm text-white/75">{description}</p>
    </div>
  );
}

function GuestStatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-white/70">{label}</div>
    </div>
  );
}

export function AuthLayout() {
  const { pathname } = useLocation();
  const isHostMode = pathname.startsWith(HOST_AUTH_PREFIX);
  const { handleExploreHome } = useExploreHomeClick();

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
      {isHostMode ? (
        <Suspense fallback={<div className="hidden lg:block" />}>
          <HostWorkspaceSidePanel variant="auth" />
        </Suspense>
      ) : (
        <div className="relative hidden flex-col overflow-hidden lg:flex">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-400 via-teal-500 to-cyan-500" />
          <div className="absolute left-0 top-0 h-[600px] w-[600px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-white/20 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[500px] w-[500px] translate-x-1/4 translate-y-1/4 rounded-full bg-white/20 blur-[100px]" />
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/15 blur-[80px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:50px_50px]" />
          <GuestAuthBrandingPanel />
        </div>
      )}

      <div className="bg-background flex min-h-screen flex-col">
        <div className="flex items-center justify-between border-b p-4 lg:hidden">
          <Link
            to={isHostMode ? '/for-hosts' : '/'}
            onClick={isHostMode ? undefined : handleExploreHome}
            className="flex min-h-[44px] items-center"
          >
            <MarketingBrandLogo />
          </Link>
          <ThemeToggle />
        </div>

        <div className="hidden justify-end p-6 lg:flex">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center p-6 sm:p-8">
          <div className="w-full max-w-[420px]">
            <Outlet />
          </div>
        </div>

        <div className="text-muted-foreground p-4 text-center text-sm lg:hidden">
          <p>{platformCopyrightLine()}</p>
        </div>
      </div>
    </div>
  );
}
