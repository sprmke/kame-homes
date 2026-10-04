import { useEffect, useRef, useState } from 'react';

import { Loader2, Mic, MicOff, PhoneOff } from 'lucide-react';

import { ReceptionistAvatar } from '@/features/guest/chat/components/voice/ReceptionistAvatar';
import { VoiceBoothRing } from '@/features/guest/chat/components/voice/VoiceBoothRing';
import { VoiceMicWaveform } from '@/features/guest/chat/components/voice/VoiceMicWaveform';
import { useDwellValue } from '@/features/guest/chat/hooks/useDwellValue';
import { useVoiceSession } from '@/features/guest/chat/hooks/useVoiceSession';
import {
  deriveVoiceSessionView,
  isBusyVoiceView,
  isUrgentVoiceView,
  showsVoiceLevel,
  VOICE_VIEW_LABEL,
  VOICE_VIEW_MIN_DWELL_MS,
  voiceViewAvatarState,
  type VoiceSessionView,
} from '@/features/guest/chat/lib/voiceSessionView';

import { ChatRichBody } from '@/components/chat/ChatRichBody';
import { captureAppEvent } from '@/lib/posthog/capture';
import { cn } from '@/lib/utils';

type Props = {
  propertySlug: string;
  onClose: () => void;
  className?: string;
};

const VOICE_CONSENT_KEY = 'guest-voice-receptionist-consent-v1';
const EXIT_MS = 180;
const AVATAR_SIZE = 138;

function formatCountdown(seconds: number | null): string {
  if (seconds === null) return '';
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

function statusToneClass(view: VoiceSessionView): string {
  if (view === 'error') return 'text-destructive';
  if (isBusyVoiceView(view)) return 'text-warning';
  if (showsVoiceLevel(view)) return 'text-primary';
  return 'text-muted-foreground';
}

function readConsent(): boolean {
  try {
    return window.localStorage.getItem(VOICE_CONSENT_KEY) === 'yes';
  } catch {
    return false;
  }
}

function writeConsent(): void {
  try {
    window.localStorage.setItem(VOICE_CONSENT_KEY, 'yes');
  } catch {
    // private mode: the disclosure shows again next time
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const secondaryButtonClass =
  'border-border text-foreground hover:bg-muted/50 min-h-[44px] flex-1 rounded-xl border px-3 text-sm font-semibold transition-colors disabled:opacity-50';
const primaryButtonClass =
  'bg-primary text-primary-foreground hover:bg-primary/90 min-h-[44px] flex-1 rounded-xl px-3 text-sm font-semibold transition-colors';
const roundButtonClass =
  'flex size-12 min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors disabled:opacity-50';

/**
 * In-thread voice receptionist. Fills the conversation column (not a modal) and uses theme
 * tokens so light/dark match guest chat. The booth stays mounted from disclosure to call end;
 * only the content under it and the footer change.
 */
export function VoiceSessionPanel({ propertySlug, onClose, className }: Props) {
  const session = useVoiceSession(propertySlug);
  const [callStarted, setCallStarted] = useState(false);
  const [hasConsent] = useState(readConsent);
  const [closing, setClosing] = useState(false);
  const endingRef = useRef(false);
  const disclosureOutcomeRef = useRef(false);
  const [deletingTranscript, setDeletingTranscript] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const rawView = callStarted
    ? deriveVoiceSessionView({
        phase: session.phase,
        userSpeaking: session.userSpeaking,
        toolPending: session.toolPending,
      })
    : 'idle';
  const view = useDwellValue<VoiceSessionView>(rawView, VOICE_VIEW_MIN_DWELL_MS, isUrgentVoiceView);
  const finished = session.phase === 'ended' || session.phase === 'error';
  const inCall = callStarted && !finished;

  /** Fade out, then unmount. */
  const closePanel = () => {
    if (closing) return;
    if (prefersReducedMotion()) {
      onClose();
      return;
    }
    setClosing(true);
    window.setTimeout(onClose, EXIT_MS);
  };

  const handleClose = () => {
    if (!inCall) {
      if (!callStarted && !hasConsent && !disclosureOutcomeRef.current) {
        disclosureOutcomeRef.current = true;
        captureAppEvent('voice_disclosure_cancelled');
      }
      closePanel();
      return;
    }
    if (endingRef.current) return;
    endingRef.current = true;
    void session.end('guest_ended');
  };

  const handleStart = () => {
    if (!hasConsent && !disclosureOutcomeRef.current) {
      disclosureOutcomeRef.current = true;
      captureAppEvent('voice_disclosure_accepted');
    }
    writeConsent();
    endingRef.current = false;
    setCallStarted(true);
    session.start();
  };

  const handleHandoff = () => {
    if (inCall && endingRef.current) return;
    endingRef.current = true;
    captureAppEvent('voice_handoff_selected');
    void session.handoffToHost().finally(closePanel);
  };

  const handleDeleteTranscript = () => {
    setDeleteError(null);
    setDeletingTranscript(true);
    void session
      .deleteTranscript()
      .catch(() => setDeleteError('Could not delete captions.'))
      .finally(() => setDeletingTranscript(false));
  };

  useEffect(() => {
    captureAppEvent('voice_entry_shown', { disclosure_required: !hasConsent });
  }, [hasConsent]);

  const handleCloseRef = useRef(handleClose);
  handleCloseRef.current = handleClose;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      handleCloseRef.current();
    };
    // Capture so a parent Dialog (Contact host) does not dismiss on Escape mid-call.
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const live = session.liveCaption?.text.trim() ? session.liveCaption : null;
  const captionLines = (() => {
    const committed = session.captions.filter((caption) => caption.text.trim());
    if (!live) return committed.slice(-2);
    const prior = [...committed].reverse().find((caption) => caption.id !== live.id);
    return prior && prior.role !== live.role ? [prior, live] : [live];
  })();

  const isEnding = session.phase === 'ending';
  const controlsDisabled = view === 'connecting' || view === 'reconnecting' || isEnding;
  const footerStage = !callStarted
    ? 'precall'
    : session.phase === 'error'
      ? 'error'
      : finished
        ? 'ended'
        : 'call';

  return (
    <section
      className={cn('voice-panel bg-card flex min-h-0 flex-1 flex-col overflow-hidden', className)}
      data-closing={closing}
      aria-label="Voice receptionist"
    >
      <div className="border-border flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <span className="text-muted-foreground w-11 shrink-0 text-xs font-medium tabular-nums">
          {inCall && !isEnding ? formatCountdown(session.remainingSeconds) : ''}
        </span>
        <p
          aria-live="polite"
          className={cn(
            'min-w-0 truncate text-center text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors duration-300',
            statusToneClass(view)
          )}
        >
          <span key={view} className="voice-fade-up inline-block">
            {VOICE_VIEW_LABEL[view]}
          </span>
        </p>
        {inCall ? (
          <span className="size-11 shrink-0" aria-hidden />
        ) : (
          <button
            type="button"
            aria-label="Close"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground hover:bg-muted/60 inline-flex size-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition-colors"
          >
            <PhoneOff className="size-5" aria-hidden />
          </button>
        )}
      </div>

      <div
        ref={session.meterRef}
        className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto overscroll-y-contain px-3 py-5"
      >
        <div className="relative size-40 shrink-0">
          <div
            className="voice-booth-glow bg-primary/25 pointer-events-none absolute inset-2 rounded-full blur-2xl"
            aria-hidden
          />
          <VoiceBoothRing state={voiceViewAvatarState(view)} busy={isBusyVoiceView(view)} />
          <div className="absolute inset-[11px] flex items-center justify-center">
            <ReceptionistAvatar state={voiceViewAvatarState(view)} size={AVATAR_SIZE} />
          </div>
        </div>

        <VoiceMicWaveform active={showsVoiceLevel(view) && !session.muted} />

        {!callStarted ? (
          <div className="voice-fade-up max-w-sm space-y-2 text-center">
            <h2 className="text-foreground text-base font-semibold">AI voice receptionist</h2>
            {!hasConsent ? (
              <p className="text-muted-foreground text-sm">
                Uses your microphone and Google Gemini. Audio is not stored. Captions may be stored.
              </p>
            ) : null}
            <a
              href="/privacy"
              className="text-primary inline-flex min-h-[44px] items-center text-sm"
            >
              Privacy
            </a>
          </div>
        ) : null}

        {session.errorMessage ? (
          <p role="alert" className="voice-fade-up text-destructive max-w-sm text-center text-sm">
            {session.errorMessage}
          </p>
        ) : null}
        {inCall && session.notice ? (
          <p
            key={session.notice}
            role="status"
            className="voice-fade-up text-warning max-w-sm text-center text-sm font-medium"
          >
            {session.notice === 'offline'
              ? 'Waiting for your connection…'
              : 'Still there? The call ends soon if it stays quiet.'}
          </p>
        ) : null}
        {session.audioGuidance ? (
          <p
            role="status"
            className="voice-fade-up text-muted-foreground max-w-sm text-center text-sm"
          >
            {session.audioGuidance}
          </p>
        ) : null}
        {deleteError ? (
          <p role="alert" className="voice-fade-up text-destructive max-w-sm text-center text-sm">
            {deleteError}
          </p>
        ) : null}

        {callStarted && captionLines.length > 0 ? (
          <div className="flex w-full max-w-md flex-col gap-2">
            {captionLines.map((line) => {
              const guest = line.role === 'guest';
              return (
                <div
                  key={line.id}
                  className={cn(
                    'voice-fade-up w-fit max-w-[min(100%,28rem)] rounded-2xl px-3 py-2 text-left text-sm leading-snug',
                    guest
                      ? 'bg-primary text-primary-foreground self-end'
                      : 'border-border/60 bg-card text-foreground self-start border'
                  )}
                >
                  {guest ? (
                    <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{line.text}</p>
                  ) : (
                    <ChatRichBody text={line.text} compactMaps />
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {callStarted && session.actions.length > 0 ? (
          <div className="flex w-full max-w-md flex-col gap-2">
            {session.actions.map((action) => (
              <a
                key={`${action.type}-${action.url}`}
                href={action.url}
                className="voice-fade-up border-border bg-background text-foreground hover:bg-muted/50 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition-colors"
              >
                {action.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-border bg-card shrink-0 border-t px-3 py-2.5 pb-[max(env(safe-area-inset-bottom,0px),0.625rem)]">
        <div key={footerStage} className="voice-fade-up flex items-center justify-center gap-2">
          {footerStage === 'precall' ? (
            <>
              <button type="button" onClick={handleClose} className={secondaryButtonClass}>
                Not now
              </button>
              <button type="button" onClick={handleStart} className={primaryButtonClass}>
                Start call
              </button>
            </>
          ) : footerStage === 'call' ? (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleHandoff}
                disabled={controlsDisabled}
                className="border-border text-foreground hover:bg-muted/50 min-h-[44px] rounded-xl border px-3 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Message host
              </button>
              <button
                type="button"
                aria-label={session.muted ? 'Unmute microphone' : 'Mute microphone'}
                aria-pressed={session.muted}
                onClick={session.toggleMute}
                disabled={controlsDisabled}
                className={cn(
                  roundButtonClass,
                  'border',
                  session.muted
                    ? 'border-border bg-muted text-foreground'
                    : 'border-primary/40 bg-background text-foreground hover:bg-muted/50'
                )}
              >
                {session.muted ? (
                  <MicOff className="size-5" aria-hidden />
                ) : (
                  <Mic className="size-5" aria-hidden />
                )}
              </button>
              <button
                type="button"
                aria-label="End call"
                onClick={handleClose}
                disabled={isEnding}
                className={cn(
                  roundButtonClass,
                  'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                )}
              >
                {isEnding ? (
                  <Loader2 className="size-5 motion-safe:animate-spin" aria-hidden />
                ) : (
                  <PhoneOff className="size-5" aria-hidden />
                )}
              </button>
            </div>
          ) : (
            <>
              {session.canDeleteTranscript ? (
                <button
                  type="button"
                  disabled={deletingTranscript}
                  onClick={handleDeleteTranscript}
                  className={secondaryButtonClass}
                >
                  Delete captions
                </button>
              ) : null}
              {footerStage === 'error' ? (
                <>
                  <button type="button" onClick={handleHandoff} className={secondaryButtonClass}>
                    Message host
                  </button>
                  <button type="button" onClick={handleStart} className={primaryButtonClass}>
                    Retry
                  </button>
                </>
              ) : (
                <button type="button" onClick={closePanel} className={primaryButtonClass}>
                  Done
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
