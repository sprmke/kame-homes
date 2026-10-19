import { useEffect, useState, type ReactNode } from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import { SlidersHorizontal } from 'lucide-react';

import { SidebarTenantScope } from '@/features/dashboard/org/components/TenantSwitchers';
import { SuperAdminSidebarScope } from '@/features/dashboard/super-admin/components/SuperAdminSidebarScope';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

const STICKY_EASE = [0.16, 1, 0.3, 1] as const;
/** Enter — soft slide from above (iOS-nav feel). */
const STICKY_ENTER_S = 0.34;
/** Exit — snappier than enter so unpin feels responsive. */
const STICKY_EXIT_S = 0.22;

type MobileStickyChromeProps = {
  pinned: boolean;
  superAdmin?: boolean;
  trailing?: ReactNode;
  /** Compact toolbar row — defaults to overlap primary when omitted at call site. */
  primary?: ReactNode;
  /** Secondary controls — enables a More sheet in sticky mode. */
  more?: ReactNode;
  moreActiveCount?: number;
  moreAriaLabel?: string;
  className?: string;
};

/**
 * Fixed sticky header for `max-lg`.
 * Brand teal band + optional floating white toolbar pill (compact, content-first).
 * Enter: slides down from above; float settles a beat later.
 */
export function MobileStickyChrome({
  pinned,
  superAdmin = false,
  trailing,
  primary,
  more,
  moreActiveCount = 0,
  moreAriaLabel = 'More filters',
  className,
}: MobileStickyChromeProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!pinned) {
      setMoreOpen(false);
    }
  }, [pinned]);

  const showFloat = Boolean(primary || more);

  return (
    <>
      <AnimatePresence initial={false}>
        {pinned ? (
          <motion.div
            key="mobile-sticky-chrome"
            role="region"
            aria-label="Page toolbar"
            initial={reducedMotion ? false : { y: '-110%', opacity: 0.55 }}
            animate={{ y: 0, opacity: 1 }}
            exit={
              reducedMotion
                ? undefined
                : {
                    y: '-110%',
                    opacity: 0.45,
                    transition: { duration: STICKY_EXIT_S, ease: [0.4, 0, 1, 1] },
                  }
            }
            transition={
              reducedMotion ? { duration: 0 } : { duration: STICKY_ENTER_S, ease: STICKY_EASE }
            }
            className={cn(
              'mobile-sticky-chrome fixed inset-x-0 top-0 z-40 will-change-transform lg:hidden',
              className
            )}
          >
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reducedMotion ? { duration: 0 } : { duration: 0.26, delay: 0.05, ease: STICKY_EASE }
              }
              className={cn(
                'flex items-center justify-between gap-2 px-3 sm:px-4',
                /*
                 * Safe-area only clears the notch. Content pad below it is mirrored
                 * on the bottom so no-float sticky bars don’t look top-heavy.
                 */
                showFloat
                  ? 'pb-1.5 pt-[max(0.5rem,env(safe-area-inset-top))]'
                  : 'pb-2.5 pt-[calc(env(safe-area-inset-top)+0.625rem)]'
              )}
            >
              <div className="mobile-sticky-chrome-scope min-w-0 flex-1">
                {superAdmin ? (
                  <SuperAdminSidebarScope collapsed={false} variant="onPrimary" />
                ) : (
                  <SidebarTenantScope collapsed={false} variant="onPrimary" />
                )}
              </div>
              {trailing ? (
                <div className="mobile-sticky-chrome-trailing flex shrink-0 items-center gap-0.5">
                  {trailing}
                </div>
              ) : null}
            </motion.div>

            {showFloat ? (
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, y: -12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { duration: 0.28, delay: 0.06, ease: STICKY_EASE }
                }
                className="origin-top px-3 pb-3 sm:px-4"
              >
                <div className="mobile-sticky-float relative flex items-center gap-1.5">
                  {primary ? (
                    <div className="mobile-sticky-float-body min-w-0 flex-1">{primary}</div>
                  ) : null}
                  {more ? (
                    <button
                      type="button"
                      onClick={() => setMoreOpen(true)}
                      aria-label={moreAriaLabel}
                      aria-expanded={moreOpen}
                      aria-haspopup="dialog"
                      className={cn(
                        'relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg',
                        'native-press min-h-[36px] min-w-[36px]',
                        moreActiveCount > 0 || moreOpen
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                      )}
                    >
                      <SlidersHorizontal className="size-3.5" aria-hidden />
                      {moreActiveCount > 0 ? (
                        <span className="bg-primary-strong text-primary-foreground absolute -right-0.5 -top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[8px] font-bold tabular-nums">
                          {moreActiveCount > 9 ? '9+' : moreActiveCount}
                        </span>
                      ) : null}
                    </button>
                  ) : null}
                </div>
              </motion.div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {more ? (
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="bottom" hideClose showHandle className="gap-0 p-0 lg:hidden">
            <SheetHeader className="border-border/60 flex-row items-center justify-between space-y-0 border-b px-4 pb-3 pt-1 text-left">
              <div className="min-w-0">
                <SheetTitle className="text-base font-semibold">More</SheetTitle>
                <SheetDescription className="sr-only">{moreAriaLabel}</SheetDescription>
              </div>
            </SheetHeader>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
              {more}
            </div>
            <div className="border-border/60 border-t px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="bg-primary-strong text-primary-foreground native-press flex min-h-[48px] w-full items-center justify-center rounded-xl text-sm font-semibold transition-colors"
              >
                Done
              </button>
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  );
}
