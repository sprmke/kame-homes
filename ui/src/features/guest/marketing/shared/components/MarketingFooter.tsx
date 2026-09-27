import { type MouseEvent } from 'react';

import { Link, useLocation } from 'react-router-dom';

import { Facebook, Instagram, Twitter, Mail, MapPin, Phone } from 'lucide-react';

import { getAppModeFromPath } from '@/features/guest/auth/config/mode-switch';
import { MarketingBrandLogo } from '@/features/guest/marketing/shared/components/MarketingBrandLogo';
import { useModeSwitchTransition } from '@/features/guest/marketing/shared/context/ModeSwitchTransitionContext';
import { marketingGuestNavLinks } from '@/features/guest/marketing/shared/lib/marketingGuestNavLinks';
import {
  marketingCompanyLinks,
  marketingContactPhone,
  marketingHostLinks,
  marketingLegalLinks,
  marketingSocialLinks,
} from '@/features/guest/marketing/shared/lib/marketingSiteLinks';

import { PLATFORM_CONTACT_EMAIL, platformCopyrightLine } from '@/lib/platformBranding';

const footerLinks = {
  explore: marketingGuestNavLinks,
  company: marketingCompanyLinks,
  hosts: marketingHostLinks,
  legal: marketingLegalLinks,
};

const socialIcons = { Facebook, Instagram, Twitter } as const;

const linkClassName = 'text-muted-foreground hover:text-foreground text-sm transition-colors';

export function MarketingFooter() {
  const { pathname } = useLocation();
  const mode = getAppModeFromPath(pathname);
  const { switchMode, isTransitioning } = useModeSwitchTransition();

  const handleExploreHome = (event: MouseEvent<HTMLAnchorElement>) => {
    if (mode === 'guest') return;
    event.preventDefault();
    switchMode('guest');
  };

  const handleBecomeHost = (event: MouseEvent<HTMLAnchorElement>) => {
    if (mode === 'host') return;
    event.preventDefault();
    switchMode('host');
  };

  return (
    <footer className="bg-muted text-foreground border-border hidden border-t lg:block">
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-6 lg:gap-12">
          <div className="col-span-2">
            <Link
              to="/"
              onClick={handleExploreHome}
              className="group mb-6 flex items-center gap-2"
              aria-disabled={isTransitioning}
            >
              <MarketingBrandLogo />
            </Link>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Discover amazing vacation rentals across the Philippines. Book your perfect getaway
              with confidence.
            </p>
            <div className="text-muted-foreground space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="text-primary h-4 w-4 shrink-0" aria-hidden />
                <span>Manila, Philippines</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="text-primary h-4 w-4 shrink-0" aria-hidden />
                <a href={`mailto:${PLATFORM_CONTACT_EMAIL}`} className={linkClassName}>
                  {PLATFORM_CONTACT_EMAIL}
                </a>
              </div>
              {marketingContactPhone ? (
                <div className="flex items-center gap-2">
                  <Phone className="text-primary h-4 w-4 shrink-0" aria-hidden />
                  <a href={marketingContactPhone.href} className={linkClassName}>
                    {marketingContactPhone.label}
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Explore</h4>
            <ul className="space-y-3">
              {footerLinks.explore.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className={linkClassName}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className={linkClassName}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">For Hosts</h4>
            <ul className="space-y-3">
              {footerLinks.hosts.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className={linkClassName}
                    onClick={link.switchesToHost ? handleBecomeHost : undefined}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className={linkClassName}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-border border-t">
        <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-muted-foreground text-sm">{platformCopyrightLine()}</p>
            <div className="flex items-center gap-4">
              {marketingSocialLinks.map((social) => {
                const Icon = socialIcons[social.label];
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors"
                    aria-label={social.label}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
