import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';

import {
  AnimatePresence,
  motion,
  type TargetAndTransition,
  type Transition,
  type Variants,
} from 'framer-motion';
import { X } from 'lucide-react';
import { createPortal, flushSync } from 'react-dom';

import { useShowcaseTheme } from '@/features/guest/marketing/showcase/components/ShowcaseThemeProvider';
import { useSmoothScroll } from '@/features/guest/marketing/showcase/components/SmoothScrollProvider';
import {
  SHOWCASE_MOBILE_MENU,
  type ShowcaseMobileMenuMotion,
} from '@/features/guest/marketing/showcase/lib/showcaseMobileMenuConfig';
import {
  showcaseMobileMenuEyebrowClass,
  showcaseMobileMenuIndexClass,
  showcaseMobileMenuItemPadClass,
  showcaseMobileMenuItemSizeByVariant,
  showcaseMobileMenuTitleSizeByVariant,
} from '@/features/guest/marketing/showcase/lib/showcaseMobileMenuTypography';
import {
  observeShowcaseFrameRect,
  readShowcaseScopeTheme,
  resolveShowcaseChromeHost,
  resolveShowcaseScrollRoot,
  type ShowcaseScopeThemeSnapshot,
} from '@/features/guest/marketing/showcase/lib/showcaseScroll';
import type { ShowcaseData } from '@/features/guest/marketing/showcase/types/showcase';

import { cn } from '@/lib/utils';

const EASE = [0.22, 1, 0.36, 1] as const;
const MENU_Z = 220;
const SCROLL_LOCK_ATTR = 'data-showcase-scroll-lock';

const CHROME_HOST_OVERLAY_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: MENU_Z,
  overflow: 'hidden',
  pointerEvents: 'auto',
};

type Props = {
  open: boolean;
  onClose: () => void;
  data: ShowcaseData;
  containedChrome: boolean;
  /** When false, inline desktop nav is showing — do not paint the overlay. */
  compactNav: boolean;
  activeSectionId: string | null;
  navSections: ShowcaseData['sections'];
};

function panelMotion(
  motionKind: ShowcaseMobileMenuMotion,
  reduced: boolean
): {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
  transition: Transition;
} {
  if (reduced) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.12 },
    };
  }

  switch (motionKind) {
    case 'slide-up':
      return {
        initial: { y: '100%' },
        animate: { y: 0 },
        exit: { y: '100%' },
        transition: { duration: 0.36, ease: EASE },
      };
    case 'slide-down':
      return {
        initial: { y: '-100%' },
        animate: { y: 0 },
        exit: { y: '-100%' },
        transition: { duration: 0.34, ease: EASE },
      };
    case 'slide-right':
      return {
        initial: { x: '100%' },
        animate: { x: 0 },
        exit: { x: '100%' },
        transition: { duration: 0.34, ease: EASE },
      };
    case 'curtain':
      return {
        initial: { y: '-100%' },
        animate: { y: 0 },
        exit: { y: '-100%' },
        transition: { duration: 0.38, ease: EASE },
      };
    case 'glass-fade':
    default:
      return {
        initial: { opacity: 0.92, scale: 0.985 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0.94, scale: 0.99 },
        transition: { duration: 0.28, ease: EASE },
      };
  }
}

function panelLayout(motionKind: ShowcaseMobileMenuMotion): string {
  if (motionKind === 'slide-up') {
    return 'absolute inset-x-0 bottom-0 z-[1] max-h-[min(88dvh,100%)] min-h-[min(68dvh,100%)]';
  }
  if (motionKind === 'slide-down' || motionKind === 'curtain') {
    return 'absolute inset-0 z-[1]';
  }
  if (motionKind === 'slide-right') {
    return 'absolute inset-y-0 right-0 z-[1] ml-auto w-full max-w-sm';
  }
  return 'absolute inset-0 z-[1]';
}

const navVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.035, delayChildren: 0.06 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.26, ease: EASE },
  },
};

function lockScrollRoot(root: HTMLElement | null) {
  if (!root) return () => undefined;
  root.setAttribute(SCROLL_LOCK_ATTR, '');
  return () => {
    root.removeAttribute(SCROLL_LOCK_ATTR);
  };
}

/**
 * Page Editor: absolute overlay inside `[data-page-editor-preview-chrome]`
 * (sibling of the scrollport — does not scroll with content, clips to frame).
 * Embed without a chrome host: `position: fixed` + frame rect on `document.body`
 * (`absolute inset-0` inside the scrollport anchors to content top and paints
 * off-screen after the host scrolls to a section).
 */
function useContainedOverlayStyle(
  _open: boolean,
  containedChrome: boolean,
  embed: boolean
): {
  style: CSSProperties | null;
  scrollRoot: HTMLElement | null;
  portalTarget: HTMLElement | null;
} {
  const needsFrame = containedChrome || embed;
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  const [chromeHost, setChromeHost] = useState<HTMLElement | null>(null);
  const [frame, setFrame] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!needsFrame) {
      setScrollRoot(null);
      setChromeHost(null);
      setFrame(null);
      return;
    }

    let cancelled = false;
    let rafId = 0;

    const bind = () => {
      if (cancelled) return;
      const root = resolveShowcaseScrollRoot({ embed, containedChrome });
      if (!root) {
        rafId = requestAnimationFrame(bind);
        return;
      }
      setScrollRoot(root);
      setChromeHost(resolveShowcaseChromeHost(root));
    };

    bind();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [needsFrame, containedChrome, embed]);

  /**
   * Keep the frame rect through close so AnimatePresence can finish panel
   * exit inside the clipped preview bounds (clearing the frame on `open=false`
   * unmounted the clip root and let the slide escape onto the dashboard).
   */
  useLayoutEffect(() => {
    if (!needsFrame || !scrollRoot) {
      setFrame(null);
      return;
    }

    if (chromeHost) {
      setFrame(CHROME_HOST_OVERLAY_STYLE);
      return;
    }

    return observeShowcaseFrameRect(scrollRoot, (rect) => {
      setFrame({
        position: 'fixed',
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        zIndex: MENU_Z,
        overflow: 'hidden',
      });
    });
  }, [needsFrame, scrollRoot, chromeHost]);

  return {
    style: needsFrame ? frame : null,
    scrollRoot,
    portalTarget: chromeHost,
  };
}

function usePortaledShowcaseTheme(
  open: boolean,
  enabled: boolean
): ShowcaseScopeThemeSnapshot | null {
  const [theme, setTheme] = useState<ShowcaseScopeThemeSnapshot | null>(null);

  useLayoutEffect(() => {
    if (!open || !enabled) {
      setTheme(null);
      return;
    }
    setTheme(readShowcaseScopeTheme());
  }, [open, enabled]);

  return theme;
}

export function ShowcaseMobileMenu({
  open,
  onClose,
  data,
  containedChrome,
  compactNav,
  activeSectionId,
  navSections,
}: Props) {
  const { scrollToAnchor } = useSmoothScroll();
  const { variant } = useShowcaseTheme();
  const config = SHOWCASE_MOBILE_MENU[variant];
  const reduced = data.reducedMotion || data.embed;
  const motionProps = panelMotion(config.motion, reduced);
  const needsContainedOverlay = containedChrome || data.embed;
  const {
    style: frameStyle,
    scrollRoot,
    portalTarget,
  } = useContainedOverlayStyle(open, containedChrome, data.embed);
  const portaledTheme = usePortaledShowcaseTheme(open, true);
  const canShow = open && compactNav && (!needsContainedOverlay || frameStyle != null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    if (needsContainedOverlay) {
      if (!scrollRoot) return;
      return lockScrollRoot(scrollRoot);
    }

    return lockScrollRoot(document.body);
  }, [open, needsContainedOverlay, scrollRoot]);

  function goTo(id: string) {
    flushSync(() => {
      onClose();
    });
    scrollToAnchor(id);
  }

  const frameClassName = cn(
    // Clip root: panel slide/curtain % translates must stay inside the preview.
    'showcase-scope overflow-hidden',
    needsContainedOverlay ? null : 'fixed inset-0'
  );

  const frameMotionStyle: CSSProperties = {
    zIndex: MENU_Z,
    ...(needsContainedOverlay && frameStyle ? frameStyle : null),
    ...(portaledTheme ? portaledTheme.style : null),
    overflow: 'hidden',
  };

  const overlay = (
    <AnimatePresence>
      {canShow ? (
        <motion.div
          key="showcase-mobile-menu"
          className={frameClassName}
          style={frameMotionStyle}
          data-showcase-surface={portaledTheme?.surface ?? undefined}
          role="dialog"
          aria-modal="true"
          aria-label="Page sections"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.1 : 0.2, ease: EASE }}
        >
          <motion.button
            type="button"
            aria-label="Close menu"
            className={cn('absolute inset-0 z-0 cursor-pointer', config.backdrop)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.08 : 0.22, ease: EASE }}
            onClick={onClose}
          />

          <motion.div
            className={cn(
              panelLayout(config.motion),
              config.panel,
              '@container flex flex-col overflow-hidden will-change-transform'
            )}
            {...motionProps}
          >
            {config.motion === 'slide-up' ? (
              <div
                className="bg-current/20 mx-auto mb-1 mt-3 h-1 w-10 shrink-0 rounded-full opacity-50"
                aria-hidden
              />
            ) : null}
            <div className={cn('flex shrink-0 items-center justify-between gap-3', config.header)}>
              <div className="min-w-0 flex-1 pr-2">
                <p className={cn('truncate', showcaseMobileMenuEyebrowClass, config.eyebrow)}>
                  {config.uppercase ? 'Sections' : 'Explore'}
                </p>
                <p
                  className={cn(
                    'truncate',
                    showcaseMobileMenuTitleSizeByVariant[variant],
                    config.title
                  )}
                >
                  {data.propertyName}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center',
                  config.closeButton
                )}
                aria-label="Close menu"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <motion.nav
              className="@sm:px-5 @sm:py-4 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-4 py-3"
              aria-label="Showcase sections"
              variants={reduced ? undefined : navVariants}
              initial={reduced ? false : 'hidden'}
              animate={reduced ? undefined : 'show'}
            >
              {navSections.map((section, index) => {
                const active = activeSectionId === section.id;
                return (
                  <motion.button
                    key={section.id}
                    type="button"
                    variants={reduced ? undefined : itemVariants}
                    onClick={() => goTo(section.id)}
                    className={cn(
                      'flex w-full cursor-pointer items-center text-left',
                      showcaseMobileMenuItemSizeByVariant[variant],
                      showcaseMobileMenuItemPadClass,
                      config.item,
                      active ? config.itemActive : config.itemIdle
                    )}
                  >
                    {config.showIndices ? (
                      <span className={cn(showcaseMobileMenuIndexClass, config.index)}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 break-words">{section.heading}</span>
                  </motion.button>
                );
              })}
            </motion.nav>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  // Page Editor: chrome host (clips to frame, under admin sheets).
  // Embed / live: document.body with fixed frame / fullscreen.
  if (typeof document !== 'undefined') {
    return createPortal(overlay, portalTarget ?? document.body);
  }

  return overlay;
}
