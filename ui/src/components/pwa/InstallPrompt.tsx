import { useEffect, useState } from 'react';

import { Download, Share, X } from 'lucide-react';

import { aboveBottomTabBarOverlayClassName } from '@/components/mobile/BottomTabBar';
import { useDisplayMode } from '@/hooks/useDisplayMode';
import { PLATFORM_APP_NAME } from '@/lib/platformBranding';
import { getPwaCapabilities } from '@/lib/pwa/capabilities';
import { canPromptInstall, promptInstall, subscribeInstallPrompt } from '@/lib/pwa/installPrompt';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'gfm:install-dismissed-at';
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const APPEAR_DELAY_MS = 8000;

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return !!raw && Date.now() - Number(raw) < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

/**
 * Custom install affordance. Chromium: a real "Install" button (`beforeinstallprompt`).
 * iOS Safari (not installed): a one-line "Add to Home Screen" instruction. Hidden
 * when already installed or dismissed within the cooldown.
 */
export function InstallPrompt() {
  const { standalone, isIos } = useDisplayMode();
  const [ready, setReady] = useState(false);
  const [canPrompt, setCanPrompt] = useState(canPromptInstall());
  const [dismissed, setDismissed] = useState(recentlyDismissed);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), APPEAR_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => subscribeInstallPrompt(() => setCanPrompt(canPromptInstall())), []);

  const caps = getPwaCapabilities();
  const iosEligible = isIos && caps.isSafari && !standalone;

  if (standalone || dismissed || !ready) return null;
  if (!canPrompt && !iosEligible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <div
      role="dialog"
      aria-label={`Install ${PLATFORM_APP_NAME}`}
      className={cn(
        /* Above BottomTabBar (z-40); below Sheet/Dialog overlays (z-50 / z-100). */
        'fixed inset-x-0 z-[45] flex justify-center px-3',
        /* Sit above the floating admin/guest bottom tab bar so nav stays tappable. */
        aboveBottomTabBarOverlayClassName()
      )}
    >
      <div className="border-border bg-background flex w-full max-w-sm items-center gap-2.5 rounded-xl border px-3 py-2.5 shadow-lg">
        <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Download className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-[13px] font-semibold leading-tight">
            Install {PLATFORM_APP_NAME}
          </p>
          {canPrompt ? (
            <p className="text-muted-foreground text-[11px] leading-snug">
              Add it to your device for a full-screen app with notifications.
            </p>
          ) : (
            <p className="text-muted-foreground inline-flex flex-wrap items-center gap-1 text-[11px] leading-snug">
              Tap <Share className="inline size-3" /> then “Add to Home Screen”.
            </p>
          )}
        </div>
        {canPrompt ? (
          <button
            type="button"
            onClick={() => void promptInstall().then(dismiss)}
            className="bg-primary text-primary-foreground rounded-lg px-2.5 py-1.5 text-xs font-semibold"
          >
            Install
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="admin-overflow-trigger"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
