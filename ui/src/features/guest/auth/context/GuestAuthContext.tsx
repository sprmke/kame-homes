import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import { GuestAuthModal } from '@/features/guest/auth/components/GuestAuthModal';
import { useGuestSession } from '@/features/guest/auth/hooks/useGuestSession';
import {
  clearGuestAuthResume,
  hasGuestAuthResume,
  saveContactHostDraft,
  saveGuestAuthResume,
  takeGuestAuthResume,
  type GuestAuthResume,
} from '@/features/guest/auth/lib/guestAuthResume';
import {
  guestParkingContactHostOpenPath,
  guestParkingReserveFormOpenPath,
  guestPropertyContactHostOpenPath,
  guestPropertyReserveFormOpenPath,
} from '@/features/guest/lib/guestPublicPaths';

import { supabase } from '@/lib/supabase/client';

type RequireGuestAuthOptions = {
  resume?: GuestAuthResume;
};

type GuestAuthContextValue = {
  status: ReturnType<typeof useGuestSession>['status'];
  email: string | null;
  openAuthModal: () => void;
  requireGuestAuth: (onSuccess: () => void, options?: RequireGuestAuthOptions) => void;
  formSubmitResumeTick: number;
  savePropertyResumeTick: number;
  savePropertyResumeSlug: string | null;
};

const GuestAuthContext = createContext<GuestAuthContextValue | null>(null);

export function GuestAuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, email } = useGuestSession();
  const [modalOpen, setModalOpen] = useState(false);
  const [formSubmitResumeTick, setFormSubmitResumeTick] = useState(0);
  const [savePropertyResumeTick, setSavePropertyResumeTick] = useState(0);
  const [savePropertyResumeSlug, setSavePropertyResumeSlug] = useState<string | null>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const pendingResumeRef = useRef<GuestAuthResume | undefined>(undefined);
  const awaitingSessionRef = useRef(false);
  const authFlowActiveRef = useRef(false);
  const returnPath = `${location.pathname}${location.search}`;
  const [oauthRedirectPath, setOauthRedirectPath] = useState(returnPath);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasOAuthCallback = params.has('code') || window.location.hash.includes('access_token=');
    if (!hasOAuthCallback) return;

    void supabase.auth.getSession();
  }, []);

  const completeAuth = useCallback(() => {
    setModalOpen(false);
    authFlowActiveRef.current = false;

    const resume = takeGuestAuthResume();
    if (resume?.type === 'navigate') {
      navigate(resume.to, resume.navState ? { state: resume.navState } : undefined);
      pendingActionRef.current = null;
      return;
    }

    if (resume?.type === 'contact_host_sheet') {
      if (resume.draft) saveContactHostDraft(resume.draft);
      if (resume.parkingSlug?.trim()) {
        navigate(
          guestParkingContactHostOpenPath(
            resume.parkingSlug,
            resume.checkInDate,
            resume.checkOutDate
          )
        );
      } else if (resume.propertySlug?.trim()) {
        navigate(
          guestPropertyContactHostOpenPath(
            resume.propertySlug,
            resume.checkInDate,
            resume.checkOutDate
          )
        );
      }
      pendingActionRef.current = null;
      return;
    }

    if (resume?.type === 'booking_form_modal') {
      navigate(
        guestPropertyReserveFormOpenPath(resume.propertySlug, {
          checkInDate: resume.checkInDate,
          checkOutDate: resume.checkOutDate,
          adults: resume.adults,
          children: resume.children,
        })
      );
      pendingActionRef.current = null;
      return;
    }

    if (resume?.type === 'parking_booking_form_modal') {
      navigate(
        guestParkingReserveFormOpenPath(resume.parkingSlug, {
          checkInDate: resume.checkInDate,
          checkOutDate: resume.checkOutDate,
        })
      );
      pendingActionRef.current = null;
      return;
    }

    if (resume?.type === 'form_submit') {
      setFormSubmitResumeTick((tick) => tick + 1);
      pendingActionRef.current = null;
      return;
    }

    if (resume?.type === 'save_property') {
      setSavePropertyResumeSlug(resume.propertySlug);
      setSavePropertyResumeTick((tick) => tick + 1);
      pendingActionRef.current = null;
      return;
    }

    pendingActionRef.current?.();
    pendingActionRef.current = null;
  }, [navigate]);

  useEffect(() => {
    if (status === 'loading') return;

    if (awaitingSessionRef.current) {
      awaitingSessionRef.current = false;
      const action = pendingActionRef.current;
      const resume = pendingResumeRef.current;
      pendingResumeRef.current = undefined;

      if (status === 'authenticated') {
        pendingActionRef.current = null;
        takeGuestAuthResume();
        authFlowActiveRef.current = false;
        action?.();
        return;
      }

      if (resume) {
        saveGuestAuthResume(resume);
      }
      setModalOpen(true);
      return;
    }

    if (status !== 'authenticated') return;

    const shouldComplete =
      pendingActionRef.current !== null ||
      modalOpen ||
      authFlowActiveRef.current ||
      hasGuestAuthResume();

    if (!shouldComplete) return;
    completeAuth();
  }, [status, modalOpen, completeAuth]);

  const openAuthModal = useCallback(() => {
    if (status === 'authenticated') return;
    setOauthRedirectPath(returnPath);
    setModalOpen(true);
  }, [status, returnPath]);

  const requireGuestAuth = useCallback(
    (onSuccess: () => void, options?: RequireGuestAuthOptions) => {
      authFlowActiveRef.current = true;

      const redirectPath =
        options?.resume?.type === 'navigate'
          ? options.resume.to
          : options?.resume?.type === 'contact_host_sheet'
            ? options.resume.parkingSlug?.trim()
              ? guestParkingContactHostOpenPath(
                  options.resume.parkingSlug,
                  options.resume.checkInDate,
                  options.resume.checkOutDate
                )
              : guestPropertyContactHostOpenPath(
                  options.resume.propertySlug ?? '',
                  options.resume.checkInDate,
                  options.resume.checkOutDate
                )
            : options?.resume?.type === 'booking_form_modal'
              ? guestPropertyReserveFormOpenPath(options.resume.propertySlug, {
                  checkInDate: options.resume.checkInDate,
                  checkOutDate: options.resume.checkOutDate,
                  adults: options.resume.adults,
                  children: options.resume.children,
                })
              : options?.resume?.type === 'parking_booking_form_modal'
                ? guestParkingReserveFormOpenPath(options.resume.parkingSlug, {
                    checkInDate: options.resume.checkInDate,
                    checkOutDate: options.resume.checkOutDate,
                  })
                : returnPath;
      setOauthRedirectPath(redirectPath);

      if (status === 'loading') {
        pendingActionRef.current = onSuccess;
        pendingResumeRef.current = options?.resume;
        awaitingSessionRef.current = true;
        return;
      }

      if (status === 'authenticated') {
        authFlowActiveRef.current = false;
        onSuccess();
        return;
      }

      if (options?.resume) {
        saveGuestAuthResume(options.resume);
      }
      pendingActionRef.current = onSuccess;
      setModalOpen(true);
    },
    [status, returnPath]
  );

  const handleModalOpenChange = useCallback(
    (open: boolean) => {
      setModalOpen(open);
      if (open) return;
      if (status === 'authenticated') return;
      authFlowActiveRef.current = false;
      pendingActionRef.current = null;
      pendingResumeRef.current = undefined;
      clearGuestAuthResume();
    },
    [status]
  );

  const value: GuestAuthContextValue = useMemo(
    () => ({
      status,
      email,
      openAuthModal,
      requireGuestAuth,
      formSubmitResumeTick,
      savePropertyResumeTick,
      savePropertyResumeSlug,
    }),
    [
      status,
      email,
      openAuthModal,
      requireGuestAuth,
      formSubmitResumeTick,
      savePropertyResumeTick,
      savePropertyResumeSlug,
    ]
  );

  return (
    <GuestAuthContext.Provider value={value}>
      {children}
      <GuestAuthModal
        open={modalOpen}
        onOpenChange={handleModalOpenChange}
        oauthRedirectPath={oauthRedirectPath}
      />
    </GuestAuthContext.Provider>
  );
}

export function useGuestAuth(): GuestAuthContextValue {
  const ctx = useContext(GuestAuthContext);
  if (!ctx) {
    throw new Error('useGuestAuth must be used within GuestAuthProvider');
  }
  return ctx;
}
