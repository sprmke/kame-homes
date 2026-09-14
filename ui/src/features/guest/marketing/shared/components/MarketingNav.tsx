import { useState, useEffect, type MouseEvent } from 'react';

import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';

import { motion } from 'framer-motion';

import { GuestAccountMenu } from '@/features/guest/account/components/GuestAccountMenu';
import {
  getAuthAudienceFromPath,
  getGuestLoginCta,
  getHostMarketingNavCta,
} from '@/features/guest/auth/config/auth-navigation';
import { useGuestSession } from '@/features/guest/auth/hooks/useGuestSession';
import { scrollToSection } from '@/features/guest/marketing/for-hosts/lib/scrollToSection';
import { HostAccountMenu } from '@/features/guest/marketing/shared/components/HostAccountMenu';
import { MarketingBrandLogo } from '@/features/guest/marketing/shared/components/MarketingBrandLogo';
import {
  useListingNavMorph,
  useListingScrollSearch,
} from '@/features/guest/marketing/shared/context/ListingScrollSearchContext';
import { useModeSwitchTransition } from '@/features/guest/marketing/shared/context/ModeSwitchTransitionContext';
import { marketingGuestNavLinks } from '@/features/guest/marketing/shared/lib/marketingGuestNavLinks';

import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';

import { ThemeToggle } from '@/components/theme/MarketingThemeToggle';
import { Button } from '@/components/ui/button';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

const guestNavLinks = marketingGuestNavLinks;

const hostNavLinks = [
  { kind: 'section' as const, id: 'features', label: 'Features' },
  { kind: 'section' as const, id: 'how-it-works', label: 'How It Works' },
  { kind: 'section' as const, id: 'reviews', label: 'Reviews' },
  { kind: 'route' as const, href: '/for-hosts/pricing', label: 'Pricing' },
];

function hostSectionTarget(pathname: string, id: string) {
  return pathname === '/for-hosts' ? `#${id}` : `/for-hosts#${id}`;
}

export function MarketingNav() {
  const { pathname } = useLocation();
  const prefersReducedMotion = usePrefersReducedMotion();
  const isExploreMode = getAuthAudienceFromPath(pathname) === 'guest';
  const { status: adminSessionStatus } = useAdminSession();
  const isHostSignedIn = adminSessionStatus === 'admin';
  const hostSignInCta = getHostMarketingNavCta(false);
  const { status: guestSessionStatus } = useGuestSession();
  const isGuestSignedIn = guestSessionStatus === 'authenticated';
  const guestSignInCta = getGuestLoginCta();
  const modeSwitch = useModeSwitchTransition();
  const [isScrolled, setIsScrolled] = useState(false);
  const { headerAnchorRef, morph, enabled: scrollSearchEnabled } = useListingScrollSearch();
  const navMorph = useListingNavMorph();
  const headerSolid = isScrolled || morph.progress > 0.08;
  const collapseBrandForSearch = scrollSearchEnabled && morph.progress > 0.12;
  const navLinks = isExploreMode ? guestNavLinks : hostNavLinks;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const ctaButtonClassName = 'rounded-full px-6';
  const hostSignInButtonClassName = cn(
    'rounded-full border-2 bg-transparent px-6 shadow-none',
    headerSolid
      ? 'border-border text-foreground hover:border-primary/30 hover:bg-accent hover:text-accent-foreground'
      : 'border-border text-foreground hover:border-foreground/40 hover:bg-muted/80 dark:border-white/60 dark:text-white dark:hover:border-white dark:hover:bg-white/10 dark:hover:text-white'
  );

  const handleBecomeHost = () => {
    modeSwitch.switchMode('host');
  };

  const handleExploreMode = () => {
    modeSwitch.switchMode('guest');
  };

  const handleExploreHome = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isExploreMode) return;
    event.preventDefault();
    modeSwitch.switchMode('guest');
  };

  const handleHostNavClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    scrollToSection(id, prefersReducedMotion);
  };

  const navLinkClassName = cn(
    'hover:text-primary text-sm font-medium transition-colors',
    headerSolid
      ? 'text-muted-foreground'
      : 'text-foreground/80 hover:text-foreground dark:text-white/80 dark:hover:text-white'
  );

  const renderNavLink = (link: (typeof guestNavLinks)[number] | (typeof hostNavLinks)[number]) => {
    if ('kind' in link) {
      if (link.kind === 'route') {
        return (
          <Link key={link.href} to={link.href} className={navLinkClassName}>
            {link.label}
          </Link>
        );
      }

      if (pathname === '/for-hosts') {
        return (
          <a
            key={link.id}
            href={`#${link.id}`}
            onClick={(event) => handleHostNavClick(event, link.id)}
            className={navLinkClassName}
          >
            {link.label}
          </a>
        );
      }

      return (
        <Link key={link.id} to={hostSectionTarget(pathname, link.id)} className={navLinkClassName}>
          {link.label}
        </Link>
      );
    }

    return (
      <Link key={link.href} to={link.href} className={navLinkClassName}>
        {link.label}
      </Link>
    );
  };

  const modeCta = isExploreMode ? (
    <Button
      variant="default"
      className={ctaButtonClassName}
      disabled={modeSwitch.isTransitioning}
      onClick={handleBecomeHost}
    >
      Become a host?
    </Button>
  ) : (
    <Button
      variant="default"
      className={ctaButtonClassName}
      disabled={modeSwitch.isTransitioning}
      onClick={handleExploreMode}
    >
      Explore
    </Button>
  );

  const accountMenu = isExploreMode ? (
    isGuestSignedIn ? (
      <GuestAccountMenu />
    ) : (
      <Button variant="outline" className={hostSignInButtonClassName} asChild>
        <Link to={guestSignInCta.href}>{guestSignInCta.label}</Link>
      </Button>
    )
  ) : isHostSignedIn ? (
    <HostAccountMenu />
  ) : (
    <Button variant="outline" className={hostSignInButtonClassName} asChild>
      <Link to={hostSignInCta.href}>{hostSignInCta.label}</Link>
    </Button>
  );

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={cn(
        'fixed left-0 right-0 top-0 z-50 transition-all duration-300',
        headerSolid ? 'bg-background/80 border-b shadow-sm backdrop-blur-xl' : 'bg-transparent'
      )}
    >
      <nav className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex h-16 items-center justify-between overflow-hidden lg:h-20">
          {/* Logo */}
          <Link
            to="/"
            onClick={handleExploreHome}
            className="group relative z-20 flex shrink-0 items-center gap-2"
          >
            <MarketingBrandLogo
              wordmarkClassName={cn(
                headerSolid ? 'text-foreground' : 'text-foreground dark:text-white',
                collapseBrandForSearch
                  ? 'max-w-0 overflow-hidden opacity-0 lg:max-w-[12rem] lg:opacity-100'
                  : 'max-w-[12rem] opacity-100',
                'overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out'
              )}
              markClassName="group-hover:shadow-primary/40 transition-shadow"
            />
          </Link>

          {scrollSearchEnabled ? (
            <div
              className="pointer-events-none absolute inset-y-0 left-[52px] right-12 hidden items-center lg:left-1/2 lg:flex lg:w-full lg:max-w-[24rem] lg:-translate-x-1/2"
              aria-hidden
            >
              <div ref={headerAnchorRef} className="h-10 w-full" />
            </div>
          ) : null}

          {/* Desktop Navigation */}
          {scrollSearchEnabled ? (
            <div
              className="absolute left-1/2 top-1/2 hidden items-center gap-8 will-change-transform lg:flex"
              style={{
                opacity: navMorph.opacity,
                transform: `translate(-50%, calc(-50% + ${navMorph.translateY}px))`,
                pointerEvents: navMorph.progress > 0.58 ? 'none' : 'auto',
              }}
            >
              {navLinks.map((link) => renderNavLink(link))}
            </div>
          ) : (
            <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 lg:flex">
              {navLinks.map((link) => renderNavLink(link))}
            </div>
          )}

          {/* Desktop CTA */}
          <div className="relative z-10 hidden items-center gap-4 lg:flex">
            <div
              className={cn(
                'flex items-center justify-center',
                !headerSolid && '[&_button]:text-foreground dark:[&_button]:text-white'
              )}
            >
              <ThemeToggle variant="ghost" size="icon" />
            </div>
            {modeCta}
            {accountMenu}
          </div>
        </div>
      </nav>
    </motion.header>
  );
}
