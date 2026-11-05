import { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { Bell } from 'lucide-react';

import { hostLoginPath } from '@/features/guest/auth/lib/hostAuthPaths';

import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';

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
import { requestPersistentStorage } from '@/lib/pwa/capabilities';
import { markFirstLaunchSeen, readInstallMemory } from '@/lib/pwa/installMemory';
import { enablePush, getPushState } from '@/lib/pwa/push';

/**
 * First launch after installing (2.6). On iOS the installed app has **separate
 * storage** from Safari, so the user arrives signed out: this is the one screen that
 * explains that, keeps the return path, and asks for notifications with a real user
 * gesture behind the permission prompt.
 *
 * Shown once (`firstLaunchSeen`), skippable.
 */
export function FirstLaunchWelcome() {
  const navigate = useNavigate();
  const { standalone } = useDisplayMode();
  const { status } = useAdminSession();
  const [open, setOpen] = useState(false);
  const [pushAvailable, setPushAvailable] = useState(false);

  useEffect(() => {
    // Only an installed launch. A browser tab (a guest landing on the marketing
    // site, an operator opening a deep link) already has the app chrome and must
    // never be told to "sign in once" behind a modal.
    if (!standalone) return;
    if (status === 'loading') return;
    if (readInstallMemory().firstLaunchSeen) return;
    setOpen(true);
    void requestPersistentStorage();
    void getPushState().then((state) => {
      setPushAvailable(state.supported && state.needsInstallFirst === false && !state.subscribed);
    });
  }, [standalone, status]);

  if (!open) return null;

  const signedOut = status === 'signed-out';
  const close = () => {
    markFirstLaunchSeen();
    setOpen(false);
  };

  const onSignIn = () => {
    markFirstLaunchSeen();
    setOpen(false);
    const returnPath = `${window.location.pathname}${window.location.search}`;
    navigate(hostLoginPath(returnPath));
  };

  const onEnableNotifications = async () => {
    try {
      await enablePush();
    } catch {
      // denial or unsupported: the Notifications page explains how to re-enable
    }
    close();
  };

  return (
    <ResponsiveModal open onOpenChange={(next) => (next ? undefined : close())}>
      <ResponsiveModalContent className="pb-[max(env(safe-area-inset-bottom),1rem)]">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{`Welcome to ${PLATFORM_APP_NAME}`}</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            {signedOut
              ? 'Sign in once to finish setting up. This app keeps its own sign-in, separate from your browser.'
              : 'Turn on notifications so new bookings and messages reach you here.'}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="mt-5 space-y-2">
          {signedOut ? (
            <>
              <Button className="w-full" onClick={onSignIn}>
                Sign in
              </Button>
              <Button className="w-full" variant="ghost" onClick={close}>
                Later
              </Button>
            </>
          ) : (
            <>
              {pushAvailable ? (
                <Button className="w-full gap-2" onClick={() => void onEnableNotifications()}>
                  <Bell className="size-4" aria-hidden />
                  Turn on notifications
                </Button>
              ) : null}
              <Button
                className="w-full"
                variant={pushAvailable ? 'ghost' : 'default'}
                onClick={close}
              >
                Start
              </Button>
            </>
          )}
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
