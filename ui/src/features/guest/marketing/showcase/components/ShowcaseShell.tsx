import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { Menu, Moon, Sun, X } from 'lucide-react';
import { createPortal } from 'react-dom';

import { usePreviewForcesMobile } from '@/features/guest/lib/previewViewportContext';
import { ShowcaseFooter } from '@/features/guest/marketing/showcase/components/ShowcaseFooter';
import { ShowcaseMobileMenu } from '@/features/guest/marketing/showcase/components/ShowcaseMobileMenu';
import {
  ShowcaseStyleProvider,
  useShowcaseStyle,
} from '@/features/guest/marketing/showcase/components/ShowcaseStyleProvider';
import {
  ShowcaseThemeProvider,
  useShowcaseTheme,
} from '@/features/guest/marketing/showcase/components/ShowcaseThemeProvider';
import {
  SmoothScrollProvider,
  useSmoothScroll,
} from '@/features/guest/marketing/showcase/components/SmoothScrollProvider';
import { useScrollSpy } from '@/features/guest/marketing/showcase/hooks/useScrollSpy';
import { useShowcaseCompactHeaderNav } from '@/features/guest/marketing/showcase/hooks/useShowcaseCompactHeaderNav';
import { useShowcaseHeaderPin } from '@/features/guest/marketing/showcase/hooks/useShowcaseHeaderPin';
import { useShowcaseMediaPalette } from '@/features/guest/marketing/showcase/hooks/useShowcaseMediaPalette';
import {
  useShowcaseConfigControlled,
  useShowcaseContainedChrome,
} from '@/features/guest/marketing/showcase/lib/showcaseChrome';
import { resolveShowcaseHeaderChrome } from '@/features/guest/marketing/showcase/lib/showcaseHeaderChrome';
import { collectShowcaseMediaUrls } from '@/features/guest/marketing/showcase/lib/showcaseMediaPalette';
import type { ShowcaseMediaPalette } from '@/features/guest/marketing/showcase/lib/showcaseMediaPalette';
import {
  resolveShowcasePaletteAccent,
  resolveShowcasePaletteToneStyle,
  resolveShowcasePaletteTones,
} from '@/features/guest/marketing/showcase/lib/showcasePaletteSurfaces';
import {
  findPrimaryShowcaseHero,
  isShowcaseHeaderSolid,
  resolveShowcaseScrollRoot,
  scrollShowcaseToTop,
  SHOWCASE_HEADER_SOLID_THRESHOLD_PX,
} from '@/features/guest/marketing/showcase/lib/showcaseScroll';
import {
  resolveShowcaseCustomPaletteClass,
  resolveShowcaseWarmTintClass,
  showcasePrimaryCssVar,
} from '@/features/guest/marketing/showcase/lib/showcaseStyleConfig';
import { useShowcaseTemplateThumbSurface } from '@/features/guest/marketing/showcase/lib/showcaseTemplateThumbSurface';
import type { ShowcaseVariant } from '@/features/guest/marketing/showcase/lib/showcaseThemeTokens';
import {
  auroraBrandTitleClass,
  auroraNavLinkClass,
} from '@/features/guest/marketing/showcase/templates/aurora/auroraHeader';
import {
  monolithBrandTitleClass,
  monolithHeaderChromeClass,
} from '@/features/guest/marketing/showcase/templates/monolith/monolithTypography';
import type { ShowcaseData } from '@/features/guest/marketing/showcase/types/showcase';

import { useFavicon } from '@/lib/favicon';
import { usePageTitle } from '@/lib/pageTitle';
import { cn } from '@/lib/utils';

function brandTitleClass(variant: ShowcaseVariant): string {
  if (variant === 'monolith') return monolithBrandTitleClass;
  if (variant === 'aurora') return auroraBrandTitleClass;
  if (variant === 'verso') {
    return 'font-jost text-sm font-semibold uppercase tracking-[0.18em]';
  }
  if (variant === 'atlas') {
    return 'font-grotesk text-sm font-medium tracking-tight @sm:text-base';
  }
  if (variant === 'haven') {
    return 'font-fraunces text-base font-medium tracking-tight @sm:text-lg';
  }
  if (variant === 'editorial') {
    return 'font-cormorant text-lg font-medium tracking-tight @sm:text-xl';
  }
  return 'text-base font-medium';
}

function ShowcaseThemeToggle({ hidden, className }: { hidden?: boolean; className?: string }) {
  const { mode, toggleMode, tokens } = useShowcaseTheme();

  if (hidden) return null;

  return (
    <button
      type="button"
      onClick={toggleMode}
      className={cn(
        'flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center transition-colors duration-200',
        tokens.themeToggleHover,
        className
      )}
      aria-label={mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {mode === 'dark' ? (
        <Sun className="size-5" aria-hidden />
      ) : (
        <Moon className="size-5" aria-hidden />
      )}
    </button>
  );
}

function ShowcaseBrand({
  data,
  onHeroHeader,
  allowTruncate,
}: {
  data: ShowcaseData;
  onHeroHeader?: boolean;
  /** When false (inline nav), keep the full name — fit is gated by compact-nav measure. */
  allowTruncate: boolean;
}) {
  const { tokens, variant } = useShowcaseTheme();
  const chrome = resolveShowcaseHeaderChrome(variant);
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(data.logoUrl) && !logoFailed;

  return (
    <button
      type="button"
      onClick={() => scrollShowcaseToTop()}
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2.5 text-left',
        allowTruncate ? 'w-full min-w-0' : 'w-auto max-w-none shrink-0'
      )}
      aria-label="Back to top"
    >
      {showLogo ? (
        <span
          className={cn(
            'size-9 shrink-0 overflow-hidden shadow-sm sm:size-10',
            chrome.brandMark,
            tokens.brandLogoBg,
            onHeroHeader && 'ring-1 ring-white/25'
          )}
        >
          <img
            src={data.logoUrl!}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover object-center"
            onError={() => setLogoFailed(true)}
          />
        </span>
      ) : (
        <span
          className={cn(
            'inline-flex size-9 shrink-0 items-center justify-center text-sm font-bold sm:size-10',
            chrome.brandMark,
            tokens.brandFallback
          )}
        >
          {data.propertyName.charAt(0).toUpperCase()}
        </span>
      )}
      <p
        className={cn(
          brandTitleClass(variant),
          allowTruncate ? 'min-w-0 truncate' : 'whitespace-nowrap'
        )}
      >
        {data.propertyName}
      </p>
    </button>
  );
}

const HERO_TRACKING_VARIANTS = new Set(['monolith', 'aurora', 'verso', 'atlas']);

function useShowcasePastHero(data: ShowcaseData, variant: string, containedChrome: boolean) {
  const tracksHero = HERO_TRACKING_VARIANTS.has(variant);
  const [pastHero, setPastHero] = useState(() => {
    if (!tracksHero) return false;
    const hero = findPrimaryShowcaseHero();
    const scrollRoot = resolveShowcaseScrollRoot({
      embed: data.embed,
      containedChrome,
      anchor: hero,
    });
    return isShowcaseHeaderSolid(SHOWCASE_HEADER_SOLID_THRESHOLD_PX, scrollRoot);
  });

  useEffect(() => {
    if (!tracksHero) {
      setPastHero(false);
      return;
    }

    const hero = findPrimaryShowcaseHero();
    if (!hero) {
      setPastHero(true);
      return;
    }

    const update = () => {
      const scrollRoot = resolveShowcaseScrollRoot({
        embed: data.embed,
        containedChrome,
        anchor: hero,
      });
      setPastHero(isShowcaseHeaderSolid(SHOWCASE_HEADER_SOLID_THRESHOLD_PX, scrollRoot));
    };

    const scrollRoot = resolveShowcaseScrollRoot({
      embed: data.embed,
      containedChrome,
      anchor: hero,
    });

    update();
    scrollRoot?.addEventListener('scroll', update, { passive: true });
    if (!scrollRoot) window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });

    const ro = new ResizeObserver(update);
    ro.observe(hero);

    return () => {
      scrollRoot?.removeEventListener('scroll', update);
      if (!scrollRoot) window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro.disconnect();
    };
  }, [containedChrome, data.embed, data.propertySlug, data.templateKey, tracksHero, variant]);

  return pastHero;
}

function ShowcaseNav({
  data,
  containedChrome,
  menuOpen,
  onMenuOpenChange,
  interactive,
  onCompactNavChange,
}: {
  data: ShowcaseData;
  containedChrome: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  /** False inside template-picker thumbs — chrome is decorative only. */
  interactive: boolean;
  onCompactNavChange: (compact: boolean) => void;
}) {
  const { scrollToAnchor } = useSmoothScroll();
  const { tokens, variant } = useShowcaseTheme();
  const forceMobile = usePreviewForcesMobile();
  const navSections = data.sections
    .filter((s) => s.id !== 'hero' && s.kind !== 'quickNav' && Boolean(s.heading))
    .slice(0, 6);
  const navKey = `${data.propertyName}|${variant}|${navSections.map((s) => s.heading).join('\0')}`;
  const { compact, rowRef, brandRef, probeRef } = useShowcaseCompactHeaderNav({
    forceMobile: forceMobile || !interactive,
    navKey,
  });
  const pin = useShowcaseHeaderPin({
    enabled: interactive,
    containedChrome,
    embed: data.embed,
  });
  const ids = data.sections.map((s) => s.id);
  const active = useScrollSpy(interactive ? ids : []);
  const pastHero = useShowcasePastHero(data, variant, containedChrome);
  const heroSection = data.sections.find((section) => section.id === 'hero');
  const heroHasImage = Boolean(heroSection?.images[0]);
  const overlayOnHero = HERO_TRACKING_VARIANTS.has(variant) && !pastHero && heroHasImage;
  const headerOnHero = overlayOnHero;
  const chrome = resolveShowcaseHeaderChrome(variant);
  const surface = overlayOnHero ? tokens.headerHero || tokens.header : tokens.header;
  const floatingPanel = variant === 'haven';
  const overlayHeader = overlayOnHero;

  useEffect(() => {
    onCompactNavChange(compact);
  }, [compact, onCompactNavChange]);

  useEffect(() => {
    if (!compact && menuOpen) onMenuOpenChange(false);
  }, [compact, menuOpen, onMenuOpenChange]);

  const navLinkClass = (sectionId: string) => {
    const isActive = active === sectionId;
    const navTone = headerOnHero
      ? isActive
        ? chrome.navOnHeroActive
        : chrome.navOnHeroInactive
      : isActive
        ? variant === 'monolith'
          ? tokens.navMonolithActive
          : tokens.navActive
        : tokens.navInactive;

    return cn(
      'min-h-11 cursor-pointer font-medium transition-colors duration-200',
      chrome.navItem,
      variant === 'aurora' ? auroraNavLinkClass : 'text-sm',
      navTone
    );
  };

  const header = (
    <header
      data-showcase-header=""
      data-showcase-surface={pin?.theme?.surface ?? undefined}
      style={
        pin
          ? {
              ...pin.style,
              ...(pin.theme?.style ?? null),
            }
          : undefined
      }
      className={cn(
        variant === 'monolith' && monolithHeaderChromeClass,
        // Interactive: portaled `position:fixed` (pin style). Thumbs: in-flow static.
        !interactive && 'relative',
        'transition-[background-color,border-color,box-shadow,color,backdrop-filter,opacity] duration-300',
        chrome.shell,
        overlayHeader && 'border-transparent',
        !floatingPanel && surface,
        menuOpen && 'pointer-events-none invisible'
      )}
    >
      <div className="@container w-full min-w-0">
        <div ref={rowRef} className={cn(chrome.inner, 'relative', floatingPanel && surface)}>
          <div
            ref={brandRef}
            className={cn(
              'min-w-0',
              // Compact: use remaining row for the full name. Expanded: natural width only
              // when measure says name + nav fit (no 40% cap that forced ellipsis).
              compact ? 'max-w-[calc(100%-5.5rem)] flex-1' : 'shrink-0'
            )}
          >
            <ShowcaseBrand data={data} onHeroHeader={headerOnHero} allowTruncate={compact} />
          </div>

          {interactive && navSections.length > 0 ? (
            <>
              <nav
                ref={probeRef}
                className="pointer-events-none absolute left-0 top-0 -z-10 flex items-center gap-1.5 opacity-0"
                aria-hidden
              >
                {navSections.map((section) => (
                  <span key={section.id} className={navLinkClass(section.id)}>
                    {section.heading}
                  </span>
                ))}
              </nav>
              {!compact ? (
                <nav
                  className="ml-auto flex shrink-0 items-center gap-1.5"
                  aria-label="Showcase sections"
                >
                  {navSections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => scrollToAnchor(section.id)}
                      className={navLinkClass(section.id)}
                    >
                      {section.heading}
                    </button>
                  ))}
                </nav>
              ) : null}
            </>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {interactive ? <ShowcaseThemeToggle className={chrome.iconButton} /> : null}
            {interactive && compact ? (
              <button
                type="button"
                className={cn(
                  'flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center',
                  chrome.iconButton,
                  tokens.themeToggleHover,
                  headerOnHero && 'text-inherit hover:bg-white/10'
                )}
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                onClick={() => onMenuOpenChange(!menuOpen)}
              >
                {menuOpen ? (
                  <X className="size-5" aria-hidden />
                ) : (
                  <Menu className="size-5" aria-hidden />
                )}
              </button>
            ) : null}
            {!interactive ? (
              <span
                className={cn(
                  'flex min-h-11 min-w-11 shrink-0 items-center justify-center',
                  chrome.iconButton
                )}
                aria-hidden
              >
                <Menu className="size-5" />
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );

  if (!interactive) return header;
  if (!pin || typeof document === 'undefined') return null;
  // Page Editor: chrome host. Live / embed without host: body.
  return createPortal(header, pin.portalTarget ?? document.body);
}

function DeepLinkScroll({ enabled }: { enabled: boolean }) {
  const { scrollToAnchor } = useSmoothScroll();
  useEffect(() => {
    if (!enabled) return;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const t = window.setTimeout(() => scrollToAnchor(hash), 120);
    return () => window.clearTimeout(t);
  }, [enabled, scrollToAnchor]);
  return null;
}

function ShowcaseShellInner({
  data,
  containedChrome,
  mediaPalette,
  children,
}: {
  data: ShowcaseData;
  containedChrome: boolean;
  mediaPalette: ShowcaseMediaPalette | null;
  children: ReactNode;
}) {
  const isTemplateThumb = useShowcaseTemplateThumbSurface();
  const { tokens, variant, mode: themeMode } = useShowcaseTheme();
  const { displayFontClass, headingScaleClass, bodyScaleClass } = useShowcaseStyle();
  const accentColor = resolveShowcasePaletteAccent(
    data.config.palette.mode,
    themeMode,
    data.accentColor,
    mediaPalette,
    data.brandColor,
    data.config.palette.customPaletteBase
  );
  const paletteTones = resolveShowcasePaletteTones(
    data.config.palette.mode,
    themeMode,
    mediaPalette,
    data.brandColor,
    data.config.palette.customPaletteBase
  );
  const paletteToneStyle = resolveShowcasePaletteToneStyle(
    data.config.palette.mode,
    themeMode,
    mediaPalette,
    data.brandColor,
    data.config.palette.customPaletteBase
  );
  const smooth =
    !data.reducedMotion && data.config.motion.intensity !== 'subtle' && !isTemplateThumb;
  const scopeDisplayFont = variant === 'monolith' ? 'font-sans' : displayFontClass;
  const [menuOpen, setMenuOpen] = useState(false);
  const [compactNav, setCompactNav] = useState(true);
  const navSections = data.sections
    .filter(
      (section) => section.id !== 'hero' && section.kind !== 'quickNav' && Boolean(section.heading)
    )
    .slice(0, 6);
  const activeSectionId = useScrollSpy(
    isTemplateThumb ? [] : data.sections.map((section) => section.id)
  );

  return (
    <SmoothScrollProvider enabled={smooth}>
      <div
        className={cn(
          // No `@container` / warm-tint `filter` here — both create a containing
          // block that traps `position: sticky|fixed` so the header scrolls away.
          'showcase-scope @sm:scroll-pt-36 relative isolate w-full min-w-0 scroll-pt-32',
          scopeDisplayFont,
          headingScaleClass,
          bodyScaleClass,
          resolveShowcaseCustomPaletteClass(data.config.palette.mode),
          data.embed && !isTemplateThumb
            ? 'h-[100dvh] overflow-y-auto overflow-x-hidden overscroll-y-contain'
            : isTemplateThumb
              ? 'h-full overflow-hidden'
              : 'min-h-[100dvh]',
          tokens.page
        )}
        data-showcase-template-thumb={isTemplateThumb ? '' : undefined}
        data-showcase-scroll-root={data.embed && !isTemplateThumb ? '' : undefined}
        data-showcase-surface={
          paletteTones ? (paletteTones.surfaceIsDark ? 'dark' : 'light') : themeMode
        }
        style={{
          ['--primary' as string]: showcasePrimaryCssVar(accentColor),
          ['--showcase-accent' as string]: showcasePrimaryCssVar(accentColor),
          ...paletteToneStyle,
        }}
      >
        <ShowcaseNav
          data={data}
          containedChrome={containedChrome}
          menuOpen={menuOpen}
          onMenuOpenChange={setMenuOpen}
          interactive={!isTemplateThumb}
          onCompactNavChange={setCompactNav}
        />
        {!isTemplateThumb ? (
          <ShowcaseMobileMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            data={data}
            containedChrome={containedChrome}
            compactNav={compactNav}
            activeSectionId={activeSectionId}
            navSections={navSections}
          />
        ) : null}
        <DeepLinkScroll enabled={!data.embed && !containedChrome && !isTemplateThumb} />
        <div
          className={cn(
            '@container w-full min-w-0',
            resolveShowcaseWarmTintClass(
              data.config.palette.mode,
              mediaPalette?.warmHue,
              data.config.palette.customPaletteBase
            )
          )}
        >
          <main>{children}</main>
          <ShowcaseFooter data={data} />
        </div>
      </div>
    </SmoothScrollProvider>
  );
}

function ShowcaseShellBody({
  data,
  variant,
  children,
}: {
  data: ShowcaseData;
  variant: ShowcaseVariant;
  children: ReactNode;
}) {
  const containedChrome = useShowcaseContainedChrome(data.embed);
  const configControlled = useShowcaseConfigControlled();
  const mediaEnabled = data.config.palette.mode === 'media';
  const mediaUrls = useMemo(() => collectShowcaseMediaUrls(data), [data]);
  const { palette: mediaPalette } = useShowcaseMediaPalette(mediaUrls, mediaEnabled);

  return (
    <ShowcaseThemeProvider
      variant={variant}
      propertySlug={data.propertySlug}
      configControlled={configControlled}
    >
      <ShowcaseStyleProvider config={data.config}>
        <ShowcaseShellInner
          data={data}
          containedChrome={containedChrome}
          mediaPalette={mediaPalette}
        >
          {children}
        </ShowcaseShellInner>
      </ShowcaseStyleProvider>
    </ShowcaseThemeProvider>
  );
}

export function ShowcaseShell({
  data,
  variant,
  children,
}: {
  data: ShowcaseData;
  variant: ShowcaseVariant;
  children: ReactNode;
  className?: string;
}) {
  const isTemplateThumb = useShowcaseTemplateThumbSurface();
  usePageTitle(
    isTemplateThumb
      ? undefined
      : `${data.propertyName} - ${data.pageKind === 'stay-guide' ? 'Stay Guide' : 'Showcase'}`
  );
  useFavicon(isTemplateThumb ? undefined : (data.logoUrl ?? undefined));

  return (
    <ShowcaseShellBody data={data} variant={variant}>
      {children}
    </ShowcaseShellBody>
  );
}
