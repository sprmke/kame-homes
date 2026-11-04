import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useDisplayMode } from '@/hooks/useDisplayMode';
import { PLATFORM_APP_NAME } from '@/lib/platformBranding';

/**
 * Installed app on a retired origin.
 *
 * When the app moves to a new domain, an app installed from the old host keeps a
 * different origin (and separate storage) forever. This shows one sheet explaining
 * the move and links to the canonical host, so the user reinstalls once from the
 * right place (1.12).
 *
 * Inert unless `VITE_LEGACY_APP_HOSTS` lists the old host, so it can ship before
 * the move and activate at cutover.
 */
const SEEN_KEY = 'gfm:legacy-origin-notice-seen';

function legacyHosts(): string[] {
  const raw = (import.meta.env.VITE_LEGACY_APP_HOSTS ?? '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function canonicalOrigin(): string {
  return (import.meta.env.VITE_CANONICAL_APP_ORIGIN ?? '').trim().replace(/\/$/, '');
}

export function LegacyOriginNotice() {
  const { standalone } = useDisplayMode();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!standalone) return;
    const hosts = legacyHosts();
    const origin = canonicalOrigin();
    if (hosts.length === 0 || !origin) return;
    if (!hosts.includes(window.location.hostname.toLowerCase())) return;
    try {
      if (window.localStorage.getItem(SEEN_KEY) === '1') return;
    } catch {
      return;
    }
    setOpen(true);
  }, [standalone]);

  if (!open) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // ignore
    }
    setOpen(false);
  };

  const target = canonicalOrigin().replace(/^https?:\/\//, '');

  return (
    <ResponsiveModal open onOpenChange={(next) => (next ? undefined : dismiss())}>
      <ResponsiveModalContent className="pb-[max(env(safe-area-inset-bottom),1rem)]">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{`${PLATFORM_APP_NAME} moved`}</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            {`Install it again from ${target} to keep getting updates.`}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <Button className="mt-5 w-full" onClick={dismiss}>
          Noted
        </Button>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
