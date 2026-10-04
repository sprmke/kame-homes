import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { GUEST_MESSAGES_QUERY_KEY } from '@/features/guest/account/lib/guestAccountApi';
import {
  GUEST_CHAT_MESSAGES_KEY,
  GUEST_CHAT_RESUME_KEY,
} from '@/features/guest/chat/hooks/useGuestChat';
import {
  classifyLiveVoiceMessage,
  decodeLiveVoiceFrame,
  describeLiveVoiceClose,
  liveVoiceWebSocketUrl,
} from '@/features/guest/chat/lib/liveVoiceProtocol';
import { int16ToBase64 } from '@/features/guest/chat/lib/voiceAudioCodec';
import {
  VoiceMicrophoneCapture,
  VOICE_MIC_SAMPLE_RATE,
} from '@/features/guest/chat/lib/voiceMicrophoneCapture';
import { VoicePlaybackQueue } from '@/features/guest/chat/lib/voicePlaybackQueue';
import {
  deleteVoiceReceptionistTranscript,
  endVoiceReceptionistSession,
  endVoiceReceptionistSessionKeepalive,
  startVoiceReceptionistSession,
  updateVoiceReceptionistSession,
  type VoiceReceptionistAction,
  type VoiceReceptionistEndReason,
  type VoiceReceptionistRole,
  type VoiceReceptionistTranscriptTurn,
} from '@/features/guest/chat/lib/voiceReceptionistApi';
import {
  voiceSessionPhaseReducer,
  type VoiceSessionPhase,
} from '@/features/guest/chat/lib/voiceSessionState';
import {
  shouldKeepInterruptedAssistantCaption,
  VOICE_OFFLINE_GRACE_MS,
  VOICE_SEND_BUFFER_LIMIT_BYTES,
  voiceIdleStage,
  voiceReconnectDelayMs,
  voiceRemainingSeconds,
} from '@/features/guest/chat/lib/voiceSessionTiming';
import {
  dispatchVoiceToolCalls,
  type VoiceToolFunctionCall,
} from '@/features/guest/chat/lib/voiceToolDispatch';
import {
  mergeVoiceTranscription,
  normalizeVoiceTranscriptText,
} from '@/features/guest/chat/lib/voiceTranscript';

import { captureAppEvent } from '@/lib/posthog/capture';

export type { VoiceSessionPhase } from '@/features/guest/chat/lib/voiceSessionState';

/** `id` is stable for a turn's lifetime (streaming → committed) so captions never remount. */
export type VoiceSessionCaption = { id: string; role: VoiceReceptionistRole; text: string };
export type VoiceSessionAction = VoiceReceptionistAction;

type ToolCallMessage = { functionCalls?: VoiceToolFunctionCall[] };
type ServerContentMessage = {
  modelTurn?: { parts?: Array<{ inlineData?: { data?: string }; text?: string }> };
  inputTranscription?: { text?: string };
  outputTranscription?: { text?: string };
  turnComplete?: boolean;
  interrupted?: boolean;
  generationComplete?: boolean;
};
type SessionResumptionUpdate = { newHandle?: string; resumable?: boolean };
type EndOptions = { notifyServer?: boolean };

const AMPLITUDE_GAIN = 3.2;
const AMPLITUDE_SMOOTHING = 0.72;
/** Below this the meter is visually still; the loop stops after the call ends. */
const AMPLITUDE_REST = 0.004;
const CAPTION_HISTORY_LIMIT = 20;
/** Countdown, idle, and offline checks. Not rAF: browsers pause rAF in background tabs. */
const SESSION_CLOCK_INTERVAL_MS = 250;
/** Local VAD (UI only) — hysteresis so status flips before Gemini commits end-of-speech. */
const LOCAL_SPEAKING_ON_RMS = 0.022;
const LOCAL_SPEAKING_OFF_RMS = 0.01;
/** After guest mic goes quiet, show Thinking until AI audio / tool call arrives. */
const LOCAL_SILENCE_TO_THINKING_MS = 550;
/** Wait for late outputTranscription chunks after turnComplete before committing assistant text. */
const ASSISTANT_FLUSH_DEBOUNCE_MS = 450;
const CONNECT_TIMEOUT_MS = 8_000;
const HEARTBEAT_INTERVAL_MS = 30_000;

/** iOS 17+: route Web Audio as a call so the ringer switch does not silence the receptionist. */
function setCallAudioSession(): void {
  const audioSession = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (!audioSession) return;
  try {
    audioSession.type = 'play-and-record';
  } catch {
    // unsupported value on this browser
  }
}

/**
 * Guest voice receptionist session: mic capture → Gemini Live WebSocket → gapless playback.
 *
 * Audio level never goes through React state. Attach `meterRef` to the element that hosts the
 * visuals; one rAF loop writes `--voice-in`, `--voice-out`, and `--voice-amp` (0..1) on it.
 */
export function useVoiceSession(propertySlug: string) {
  const qc = useQueryClient();
  const [phase, dispatchPhase] = useReducer(voiceSessionPhaseReducer, 'idle');
  const [muted, setMuted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [captions, setCaptions] = useState<VoiceSessionCaption[]>([]);
  const [liveCaption, setLiveCaption] = useState<VoiceSessionCaption | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** True while local mic energy looks like guest speech (independent of Gemini VAD). */
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [toolPending, setToolPending] = useState(false);
  const [actions, setActions] = useState<VoiceSessionAction[]>([]);
  const [audioGuidance, setAudioGuidance] = useState<string | null>(null);
  /** Short notice for silence or a dropped network, cleared when the condition clears. */
  const [notice, setNotice] = useState<'idle' | 'offline' | null>(null);
  const [endedSessionId, setEndedSessionId] = useState<string | null>(null);
  const [transcriptDeleted, setTranscriptDeleted] = useState(false);

  const phaseRef = useRef<VoiceSessionPhase>('idle');
  const mutedRef = useRef(false);
  const endedRef = useRef(false);
  const userSpeakingRef = useRef(false);
  const silenceToThinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Last role that received a Live transcription chunk — used to flush only on role switch. */
  const lastCaptionRoleRef = useRef<VoiceReceptionistRole | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  /** False between socket open and `setupComplete`; audio sent then is a protocol error. */
  const setupReadyRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const maxSessionSecondsRef = useRef(0);
  const startedAtMsRef = useRef(0);

  const microphoneRef = useRef<VoiceMicrophoneCapture | null>(null);
  if (!microphoneRef.current) microphoneRef.current = new VoiceMicrophoneCapture();
  const micRmsRef = useRef(0);

  const playbackHandlersRef = useRef({ onStart: () => {}, onIdle: () => {} });
  const playbackRef = useRef<VoicePlaybackQueue | null>(null);
  if (!playbackRef.current) {
    playbackRef.current = new VoicePlaybackQueue({
      onStart: () => playbackHandlersRef.current.onStart(),
      onIdle: () => playbackHandlersRef.current.onIdle(),
    });
  }

  const meterElRef = useRef<HTMLElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastRemainingRef = useRef(-1);
  const meterRef = useRef({ input: 0, output: 0 });
  const lastActivityMsRef = useRef(Date.now());

  const currentInputBufferRef = useRef('');
  const currentOutputBufferRef = useRef('');
  const inputTurnIdRef = useRef<string | null>(null);
  const outputTurnIdRef = useRef<string | null>(null);
  const turnSeqRef = useRef(0);
  const transcriptRef = useRef<Array<VoiceReceptionistTranscriptTurn & { id: string }>>([]);
  const assistantFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const offlineSinceRef = useRef<number | null>(null);
  const noticeRef = useRef<'idle' | 'offline' | null>(null);
  const setupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumptionHandleRef = useRef<string | null>(null);
  const reconnectAttemptedRef = useRef(false);
  const reconnectRef = useRef<(() => Promise<void>) | null>(null);
  const greetingSentRef = useRef(false);
  const acknowledgedRef = useRef(false);
  const interruptionCountRef = useRef(0);
  const toolPendingRef = useRef(false);
  const metricsRef = useRef({
    requestedAt: 0,
    permissionAt: 0,
    firstCaptionCaptured: false,
    firstAudioCaptured: false,
    setupMs: null as number | null,
    firstAudioMs: null as number | null,
    reconnectCount: 0,
  });

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const setPhaseIfActive = useCallback((next: VoiceSessionPhase) => {
    if (
      next === 'connecting' ||
      next === 'reconnecting' ||
      next === 'listening' ||
      next === 'thinking' ||
      next === 'speaking'
    ) {
      dispatchPhase({ type: 'activity', phase: next });
    }
  }, []);

  const clearSilenceToThinkingTimer = useCallback(() => {
    if (silenceToThinkingTimerRef.current !== null) {
      clearTimeout(silenceToThinkingTimerRef.current);
      silenceToThinkingTimerRef.current = null;
    }
  }, []);

  const clearAssistantFlushTimer = useCallback(() => {
    if (assistantFlushTimerRef.current !== null) {
      clearTimeout(assistantFlushTimerRef.current);
      assistantFlushTimerRef.current = null;
    }
  }, []);

  const setUserSpeakingState = useCallback((next: boolean) => {
    if (userSpeakingRef.current === next) return;
    userSpeakingRef.current = next;
    setUserSpeaking(next);
  }, []);

  playbackHandlersRef.current = {
    onStart: () => {
      setPhaseIfActive('speaking');
      clearSilenceToThinkingTimer();
      setUserSpeakingState(false);
    },
    onIdle: () => setPhaseIfActive('listening'),
  };

  /**
   * Local RMS → UI speaking / thinking. Does not replace Gemini server VAD for the model;
   * only closes the "stuck on LISTENING" gap after the guest stops talking.
   */
  const applyLocalVad = useCallback(
    (rms: number) => {
      if (mutedRef.current || endedRef.current) return;
      const current = phaseRef.current;
      if (current !== 'listening' && current !== 'thinking' && current !== 'speaking') return;

      if (!userSpeakingRef.current && rms >= LOCAL_SPEAKING_ON_RMS) {
        clearSilenceToThinkingTimer();
        setUserSpeakingState(true);
        if (current === 'thinking') setPhaseIfActive('listening');
        return;
      }

      if (userSpeakingRef.current && rms <= LOCAL_SPEAKING_OFF_RMS) {
        if (silenceToThinkingTimerRef.current !== null) return;
        silenceToThinkingTimerRef.current = setTimeout(() => {
          silenceToThinkingTimerRef.current = null;
          setUserSpeakingState(false);
          if (
            !endedRef.current &&
            !playbackRef.current?.isPlaying &&
            phaseRef.current === 'listening'
          ) {
            setPhaseIfActive('thinking');
          }
        }, LOCAL_SILENCE_TO_THINKING_MS);
      } else if (userSpeakingRef.current && rms > LOCAL_SPEAKING_OFF_RMS) {
        clearSilenceToThinkingTimer();
      }
    },
    [clearSilenceToThinkingTimer, setPhaseIfActive, setUserSpeakingState]
  );

  const markActivity = useCallback(() => {
    lastActivityMsRef.current = Date.now();
  }, []);

  /** Reuse the previous turn's id when the same role keeps talking, so the bubble stays mounted. */
  const turnIdFor = useCallback((role: VoiceReceptionistRole): string => {
    const last = transcriptRef.current[transcriptRef.current.length - 1];
    if (last?.role === role) return last.id;
    turnSeqRef.current += 1;
    return `turn-${turnSeqRef.current}`;
  }, []);

  /** Commit bounded local captions without an extra model call. */
  const commitTurn = useCallback((role: VoiceReceptionistRole, rawText: string, id: string) => {
    const raw = normalizeVoiceTranscriptText(rawText);
    if (!raw) return;

    if (role === 'assistant') {
      const words = raw.split(/\s+/);
      if (words.length <= 2 && !/[.!?]$/.test(raw)) return;
    }

    const at = new Date().toISOString();
    const last = transcriptRef.current[transcriptRef.current.length - 1];
    let caption: VoiceSessionCaption;
    if (last?.role === role) {
      const merged = mergeVoiceTranscription(last.text, raw);
      caption = { id: last.id, role, text: merged };
      transcriptRef.current = [...transcriptRef.current.slice(0, -1), { ...caption, at }];
    } else {
      caption = { id, role, text: raw };
      transcriptRef.current = [...transcriptRef.current, { ...caption, at }];
    }

    setCaptions((prev) => {
      const next =
        prev[prev.length - 1]?.id === caption.id
          ? [...prev.slice(0, -1), caption]
          : [...prev, caption];
      return next.slice(-CAPTION_HISTORY_LIMIT);
    });
    setLiveCaption(caption);
  }, []);

  const flushInputBuffer = useCallback(() => {
    const text = currentInputBufferRef.current.trim();
    const id = inputTurnIdRef.current;
    currentInputBufferRef.current = '';
    inputTurnIdRef.current = null;
    if (text && id) commitTurn('guest', text, id);
  }, [commitTurn]);

  const flushOutputBuffer = useCallback(() => {
    clearAssistantFlushTimer();
    const text = currentOutputBufferRef.current.trim();
    const id = outputTurnIdRef.current;
    currentOutputBufferRef.current = '';
    outputTurnIdRef.current = null;
    if (text && id) commitTurn('assistant', text, id);
  }, [clearAssistantFlushTimer, commitTurn]);

  const scheduleAssistantFlush = useCallback(() => {
    clearAssistantFlushTimer();
    assistantFlushTimerRef.current = setTimeout(() => {
      assistantFlushTimerRef.current = null;
      flushOutputBuffer();
    }, ASSISTANT_FLUSH_DEBOUNCE_MS);
  }, [clearAssistantFlushTimer, flushOutputBuffer]);

  const writeMeter = useCallback((input: number, output: number) => {
    const el = meterElRef.current;
    if (!el) return;
    el.style.setProperty('--voice-in', input.toFixed(3));
    el.style.setProperty('--voice-out', output.toFixed(3));
    el.style.setProperty('--voice-amp', Math.max(input, output).toFixed(3));
  }, []);

  const stopAmplitudeLoop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const clearSessionTimers = useCallback(() => {
    if (clockTimerRef.current !== null) {
      clearInterval(clockTimerRef.current);
      clockTimerRef.current = null;
    }
    if (heartbeatTimerRef.current !== null) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (setupTimeoutRef.current !== null) {
      clearTimeout(setupTimeoutRef.current);
      setupTimeoutRef.current = null;
    }
  }, []);

  const closeSocket = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    setupReadyRef.current = false;
    if (!ws) return;
    ws.onmessage = null;
    ws.onclose = null;
    ws.onerror = null;
    try {
      ws.close();
    } catch {
      // already closed
    }
  }, []);

  const endingPromiseRef = useRef<Promise<void> | null>(null);

  const end = useCallback(
    (
      reason: VoiceReceptionistEndReason = 'guest_ended',
      message?: string,
      options: EndOptions = {}
    ): Promise<void> => {
      if (endedRef.current) return endingPromiseRef.current ?? Promise.resolve();
      endedRef.current = true;
      dispatchPhase({ type: 'begin_end' });
      if (message) setErrorMessage(message);

      flushInputBuffer();
      flushOutputBuffer();
      setLiveCaption(null);
      clearSilenceToThinkingTimer();
      setUserSpeakingState(false);
      clearSessionTimers();
      offlineSinceRef.current = null;
      noticeRef.current = null;
      setNotice(null);
      // The rAF loop keeps running so the meter eases to rest, then stops itself.
      microphoneRef.current?.stop();
      micRmsRef.current = 0;
      playbackRef.current?.close();
      closeSocket();

      const sessionId = sessionIdRef.current;
      const transcript = transcriptRef.current.map(({ role, text, at }) => ({ role, text, at }));
      sessionIdRef.current = null;
      const failed =
        reason === 'error' || reason === 'provider_error' || reason === 'provider_go_away';

      const finish = async () => {
        if (sessionId && options.notifyServer !== false) {
          try {
            await endVoiceReceptionistSession(sessionId, {
              endReason: reason,
              transcript,
              metrics: {
                setupMs: metricsRef.current.setupMs,
                firstAudioMs: metricsRef.current.firstAudioMs,
                reconnectCount: metricsRef.current.reconnectCount,
              },
            });
            setEndedSessionId(sessionId);
            await Promise.all([
              qc.invalidateQueries({ queryKey: [GUEST_CHAT_MESSAGES_KEY] }),
              qc.invalidateQueries({ queryKey: [GUEST_CHAT_RESUME_KEY] }),
              qc.invalidateQueries({ queryKey: GUEST_MESSAGES_QUERY_KEY }),
            ]);
          } catch (e) {
            console.warn('[useVoiceSession] end call failed:', (e as Error).message);
          }
        }
        dispatchPhase({ type: failed ? 'fail' : 'end_success' });
      };

      const promise = finish();
      endingPromiseRef.current = promise;
      captureAppEvent(failed ? 'voice_session_failed' : 'voice_session_ended', {
        reason,
        duration_ms: startedAtMsRef.current ? Date.now() - startedAtMsRef.current : 0,
      });
      return promise;
    },
    [
      qc,
      clearSessionTimers,
      clearSilenceToThinkingTimer,
      closeSocket,
      flushInputBuffer,
      flushOutputBuffer,
      setUserSpeakingState,
    ]
  );

  const updateNotice = useCallback((next: 'idle' | 'offline' | null) => {
    if (noticeRef.current === next) return;
    noticeRef.current = next;
    setNotice(next);
  }, []);

  /** Session clock: countdown, idle warning/timeout, and the offline grace period. */
  const startSessionClock = useCallback(() => {
    if (clockTimerRef.current !== null) clearInterval(clockTimerRef.current);
    lastRemainingRef.current = -1;
    clockTimerRef.current = setInterval(() => {
      if (endedRef.current) return;
      const nowMs = Date.now();
      const remaining = voiceRemainingSeconds({
        startedAtMs: startedAtMsRef.current,
        maxSessionSeconds: maxSessionSecondsRef.current,
        nowMs,
      });
      if (remaining !== lastRemainingRef.current) {
        lastRemainingRef.current = remaining;
        setRemainingSeconds(remaining);
        if (remaining <= 0) {
          void end('timeout');
          return;
        }
      }

      const offlineSince = offlineSinceRef.current;
      if (offlineSince !== null) {
        if (nowMs - offlineSince > VOICE_OFFLINE_GRACE_MS) {
          void end('provider_error', 'You went offline. Continue in text chat when you are back.');
          return;
        }
        // Silence while offline is not the guest's fault; keep the idle timer from firing.
        lastActivityMsRef.current = nowMs;
        updateNotice('offline');
        return;
      }

      const stage = voiceIdleStage({
        phase: phaseRef.current,
        lastActivityMs: lastActivityMsRef.current,
        nowMs,
      });
      if (stage === 'idle') {
        void end('idle_timeout', 'Ended the call due to inactivity.');
        return;
      }
      updateNotice(stage === 'warning' ? 'idle' : null);
    }, SESSION_CLOCK_INTERVAL_MS);
  }, [end, updateNotice]);

  const startAmplitudeLoop = useCallback(() => {
    stopAmplitudeLoop();
    meterRef.current = { input: 0, output: 0 };

    const tick = () => {
      const current = phaseRef.current;
      let inputTarget = 0;
      let outputTarget = 0;

      if (!endedRef.current) {
        if (current === 'speaking') outputTarget = playbackRef.current?.readRms() ?? 0;
        if (
          !mutedRef.current &&
          (current === 'listening' || current === 'thinking' || userSpeakingRef.current)
        ) {
          inputTarget = micRmsRef.current;
        }
      }

      const ease = (value: number, target: number) =>
        value * AMPLITUDE_SMOOTHING +
        Math.min(1, target * AMPLITUDE_GAIN) * (1 - AMPLITUDE_SMOOTHING);
      const meter = meterRef.current;
      meter.input = ease(meter.input, inputTarget);
      meter.output = ease(meter.output, outputTarget);

      if (endedRef.current && meter.input < AMPLITUDE_REST && meter.output < AMPLITUDE_REST) {
        writeMeter(0, 0);
        rafIdRef.current = null;
        return;
      }
      writeMeter(meter.input, meter.output);
      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
  }, [stopAmplitudeLoop, writeMeter]);

  const attachMicWorklet = useCallback(async () => {
    await microphoneRef.current?.attach(({ pcm, rms }) => {
      micRmsRef.current = rms;
      // Raw mic level is not activity: room noise (boosted by auto gain) would keep a silent
      // call open. Activity comes from recognized speech, replies, and tools.
      applyLocalVad(rms);
      if (mutedRef.current || !setupReadyRef.current) return;
      const ws = wsRef.current;
      if (ws?.readyState !== WebSocket.OPEN) return;
      if (ws.bufferedAmount > VOICE_SEND_BUFFER_LIMIT_BYTES) return;
      ws.send(
        JSON.stringify({
          realtimeInput: {
            audio: {
              mimeType: `audio/pcm;rate=${VOICE_MIC_SAMPLE_RATE}`,
              data: int16ToBase64(pcm),
            },
          },
        })
      );
    });
  }, [applyLocalVad]);

  const handleToolCall = useCallback(
    async (ws: WebSocket, toolCall: ToolCallMessage) => {
      const calls = toolCall.functionCalls ?? [];
      if (!calls.length) return;
      toolPendingRef.current = true;
      setToolPending(true);
      setPhaseIfActive('thinking');
      const toolStartedAt = performance.now();
      let failedCount = 0;
      captureAppEvent('voice_tool_started', { call_count: calls.length });

      try {
        const result = await dispatchVoiceToolCalls(sessionIdRef.current ?? '', calls);
        const { responses, actions: nextActions } = result;
        failedCount = result.failedCount;
        if (nextActions.length) {
          captureAppEvent('voice_handoff_offered', { action_count: nextActions.length });
          setActions((current) => {
            const byUrl = new Map(current.map((action) => [action.url, action]));
            for (const action of nextActions) byUrl.set(action.url, action);
            return Array.from(byUrl.values()).slice(-3);
          });
        }

        if (ws === wsRef.current && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
        }
        // Stay on thinking until AI audio (or the next listening cycle) — don't flash Listening.
      } finally {
        captureAppEvent('voice_tool_completed', {
          duration_ms: Math.round(performance.now() - toolStartedAt),
          call_count: calls.length,
        });
        if (failedCount > 0) {
          captureAppEvent('voice_tool_failed', { failed_count: failedCount });
        }
        toolPendingRef.current = false;
        setToolPending(false);
      }
    },
    [setPhaseIfActive]
  );

  const handleSetupComplete = useCallback(
    async (ws: WebSocket) => {
      if (setupTimeoutRef.current !== null) {
        clearTimeout(setupTimeoutRef.current);
        setupTimeoutRef.current = null;
      }
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      setupReadyRef.current = true;

      // Ack in the background: the first setup activates the lease, a resumed one only renews it.
      const ack = acknowledgedRef.current ? 'heartbeat' : 'active';
      acknowledgedRef.current = true;
      void updateVoiceReceptionistSession(sessionId, ack).catch(() => {
        void end('error', 'Voice session expired. Please try again.');
      });
      if (heartbeatTimerRef.current !== null) clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = setInterval(() => {
        const activeSessionId = sessionIdRef.current;
        if (!activeSessionId) return;
        void updateVoiceReceptionistSession(activeSessionId, 'heartbeat').catch(() => {
          void end('error', 'Voice session expired. Please try again.');
        });
      }, HEARTBEAT_INTERVAL_MS);

      if (!greetingSentRef.current && ws.readyState === WebSocket.OPEN) {
        greetingSentRef.current = true;
        ws.send(JSON.stringify({ realtimeInput: { text: 'Start the call.' } }));
      }

      try {
        if (!microphoneRef.current?.isAttached) await attachMicWorklet();
      } catch {
        void end('error', 'Microphone access failed.');
        return;
      }
      if (metricsRef.current.setupMs === null) {
        metricsRef.current.setupMs = metricsRef.current.permissionAt
          ? Date.now() - metricsRef.current.permissionAt
          : null;
        captureAppEvent('voice_setup_completed', { duration_ms: metricsRef.current.setupMs ?? 0 });
      }
      markActivity();
      setPhaseIfActive('listening');
    },
    [attachMicWorklet, end, markActivity, setPhaseIfActive]
  );

  const handleSocketMessage = useCallback(
    (ws: WebSocket, event: MessageEvent) => {
      if (ws !== wsRef.current || endedRef.current) return;
      const msg = decodeLiveVoiceFrame(event.data);
      if (!msg) return;
      const messageKinds = classifyLiveVoiceMessage(msg);

      if (messageKinds.includes('setup_complete')) {
        void handleSetupComplete(ws);
        return;
      }

      const resumption = msg.sessionResumptionUpdate as SessionResumptionUpdate | undefined;
      if (resumption?.newHandle) {
        resumptionHandleRef.current = resumption.newHandle;
      }
      if (messageKinds.includes('go_away')) {
        if (resumptionHandleRef.current && !reconnectAttemptedRef.current) {
          void reconnectRef.current?.();
        } else {
          void end('provider_go_away', 'Voice service is restarting. Continue in text chat.');
        }
        return;
      }
      if (messageKinds.includes('provider_error')) {
        void end('provider_error', 'Voice service is unavailable. Continue in text chat.');
        return;
      }

      if (msg.toolCall) {
        markActivity();
        void handleToolCall(ws, msg.toolCall as ToolCallMessage);
        return;
      }

      const serverContent = msg.serverContent as ServerContentMessage | undefined;
      if (!serverContent) return;

      if (serverContent.interrupted) {
        captureAppEvent('voice_interrupted');
        interruptionCountRef.current += 1;
        if (interruptionCountRef.current >= 3) {
          setAudioGuidance('Use headphones if audio keeps cutting out.');
        }
        markActivity();
        // Drop queued AI audio so barge-in feels immediate.
        playbackRef.current?.interrupt();
        // Don't commit a half-spoken AI scrap ("Is there") after barge-in.
        const partialOut = currentOutputBufferRef.current.trim();
        if (partialOut) {
          if (shouldKeepInterruptedAssistantCaption(partialOut)) {
            flushOutputBuffer();
          } else {
            currentOutputBufferRef.current = '';
            outputTurnIdRef.current = null;
          }
        }
        setPhaseIfActive('listening');
      }

      if (serverContent.inputTranscription?.text) {
        if (!metricsRef.current.firstCaptionCaptured) {
          metricsRef.current.firstCaptionCaptured = true;
          captureAppEvent('voice_first_caption', {
            duration_ms: Date.now() - metricsRef.current.requestedAt,
          });
        }
        markActivity();
        clearAssistantFlushTimer();
        if (lastCaptionRoleRef.current === 'assistant' && currentOutputBufferRef.current.trim()) {
          flushOutputBuffer();
        }
        lastCaptionRoleRef.current = 'guest';
        inputTurnIdRef.current ??= turnIdFor('guest');
        const merged = mergeVoiceTranscription(
          currentInputBufferRef.current,
          serverContent.inputTranscription.text
        );
        currentInputBufferRef.current = merged;
        setLiveCaption({ id: inputTurnIdRef.current, role: 'guest', text: merged });
        setUserSpeakingState(true);
        clearSilenceToThinkingTimer();
        if (!playbackRef.current?.isPlaying) setPhaseIfActive('listening');
      }
      if (serverContent.outputTranscription?.text) {
        markActivity();
        // Late STT after turnComplete — cancel pending flush and keep accumulating.
        clearAssistantFlushTimer();
        if (lastCaptionRoleRef.current === 'guest' && currentInputBufferRef.current.trim()) {
          flushInputBuffer();
        }
        lastCaptionRoleRef.current = 'assistant';
        outputTurnIdRef.current ??= turnIdFor('assistant');
        const merged = mergeVoiceTranscription(
          currentOutputBufferRef.current,
          serverContent.outputTranscription.text
        );
        currentOutputBufferRef.current = merged;
        setLiveCaption({ id: outputTurnIdRef.current, role: 'assistant', text: merged });
        setUserSpeakingState(false);
        clearSilenceToThinkingTimer();
      }

      const parts = serverContent.modelTurn?.parts ?? [];
      for (const part of parts) {
        if (!part.inlineData?.data) continue;
        if (!metricsRef.current.firstAudioCaptured) {
          metricsRef.current.firstAudioCaptured = true;
          metricsRef.current.firstAudioMs = metricsRef.current.permissionAt
            ? Date.now() - metricsRef.current.permissionAt
            : null;
          captureAppEvent('voice_first_audio', {
            duration_ms: Date.now() - metricsRef.current.requestedAt,
          });
        }
        markActivity();
        playbackRef.current?.enqueue(part.inlineData.data);
      }

      if (serverContent.turnComplete || serverContent.generationComplete) {
        flushInputBuffer();
        // Debounce assistant commit so late outputTranscription chunks can land.
        if (currentOutputBufferRef.current.trim()) scheduleAssistantFlush();
        lastCaptionRoleRef.current = null;
        // Playback reports idle itself once queued speech drains.
        if (
          !playbackRef.current?.isPlaying &&
          phaseRef.current === 'thinking' &&
          !toolPendingRef.current
        ) {
          setPhaseIfActive('listening');
        }
      }
    },
    [
      clearAssistantFlushTimer,
      clearSilenceToThinkingTimer,
      end,
      flushInputBuffer,
      flushOutputBuffer,
      handleSetupComplete,
      handleToolCall,
      markActivity,
      scheduleAssistantFlush,
      setPhaseIfActive,
      setUserSpeakingState,
      turnIdFor,
    ]
  );

  const start = useCallback(() => {
    if (
      phaseRef.current !== 'idle' &&
      phaseRef.current !== 'ended' &&
      phaseRef.current !== 'error'
    ) {
      return;
    }

    endedRef.current = false;
    endingPromiseRef.current = null;
    transcriptRef.current = [];
    currentInputBufferRef.current = '';
    currentOutputBufferRef.current = '';
    inputTurnIdRef.current = null;
    outputTurnIdRef.current = null;
    lastCaptionRoleRef.current = null;
    clearAssistantFlushTimer();
    setCaptions([]);
    setLiveCaption(null);
    setErrorMessage(null);
    setUserSpeaking(false);
    userSpeakingRef.current = false;
    clearSilenceToThinkingTimer();
    toolPendingRef.current = false;
    setToolPending(false);
    setActions([]);
    setAudioGuidance(null);
    offlineSinceRef.current = null;
    noticeRef.current = null;
    setNotice(null);
    setEndedSessionId(null);
    setTranscriptDeleted(false);
    setRemainingSeconds(null);
    metricsRef.current = {
      requestedAt: Date.now(),
      permissionAt: 0,
      firstCaptionCaptured: false,
      firstAudioCaptured: false,
      setupMs: null,
      firstAudioMs: null,
      reconnectCount: 0,
    };
    captureAppEvent('voice_session_requested');
    reconnectAttemptedRef.current = false;
    resumptionHandleRef.current = null;
    greetingSentRef.current = false;
    acknowledgedRef.current = false;
    interruptionCountRef.current = 0;
    dispatchPhase({ type: 'start' });

    // Inside the tap: unlock both audio contexts (iOS) and start loading the mic worklet early.
    setCallAudioSession();
    microphoneRef.current?.prepare();
    playbackRef.current?.unlock();

    void (async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          throw new Error('You appear to be offline. Check your connection and try again.');
        }

        // Ask for the mic before minting a session/token, so a permission denial never
        // consumes a guest daily-cap slot or leaves an orphaned session row server-side.
        try {
          await microphoneRef.current?.acquire(() => {
            if (!endedRef.current) void end('error', 'Microphone disconnected.');
          });
          captureAppEvent('voice_mic_permission_outcome', { outcome: 'granted' });
          // Closed while the permission prompt was open: release the mic right away.
          if (endedRef.current) {
            microphoneRef.current?.stop();
            return;
          }
          metricsRef.current.permissionAt = Date.now();
        } catch (error) {
          captureAppEvent('voice_mic_permission_outcome', { outcome: 'denied' });
          throw error;
        }

        const minted = await startVoiceReceptionistSession(propertySlug);
        if (endedRef.current) {
          // Closed while minting: release the reservation instead of opening a socket.
          await endVoiceReceptionistSession(minted.sessionId, {
            endReason: 'guest_ended',
            transcript: [],
            metrics: { setupMs: null, firstAudioMs: null, reconnectCount: 0 },
          }).catch(() => undefined);
          return;
        }
        sessionIdRef.current = minted.sessionId;
        maxSessionSecondsRef.current = minted.maxSessionSeconds;
        startedAtMsRef.current = Date.now();
        lastActivityMsRef.current = Date.now();
        setRemainingSeconds(minted.maxSessionSeconds);

        const connect = async (resuming: boolean): Promise<void> => {
          if (resuming) {
            await new Promise((resolve) =>
              window.setTimeout(resolve, voiceReconnectDelayMs(Math.random()))
            );
            if (endedRef.current) return;
          }
          const ws = new WebSocket(liveVoiceWebSocketUrl(minted));
          ws.binaryType = 'arraybuffer';
          wsRef.current = ws;
          setupReadyRef.current = false;
          ws.onmessage = (event) => handleSocketMessage(ws, event);
          ws.onclose = (event) => {
            if (wsRef.current !== ws || endedRef.current) return;
            const close = describeLiveVoiceClose(event);
            // A dropped connection with a resumption handle gets one resume, same as GoAway.
            if (!close.expected && resumptionHandleRef.current && !reconnectAttemptedRef.current) {
              void reconnectRef.current?.();
              return;
            }
            void end('provider_error', close.message);
          };

          await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(() => {
              reject(new Error('Voice connection timed out. Please try again.'));
            }, CONNECT_TIMEOUT_MS);
            ws.addEventListener(
              'open',
              () => {
                window.clearTimeout(timeout);
                resolve();
              },
              { once: true }
            );
            ws.addEventListener(
              'error',
              () => {
                window.clearTimeout(timeout);
                reject(new Error('Could not connect to the voice receptionist.'));
              },
              { once: true }
            );
          });

          const setup = {
            ...minted.clientSetup,
            ...(resuming && resumptionHandleRef.current
              ? { sessionResumption: { handle: resumptionHandleRef.current } }
              : {}),
          };
          ws.send(JSON.stringify({ setup }));
          if (setupTimeoutRef.current !== null) clearTimeout(setupTimeoutRef.current);
          setupTimeoutRef.current = setTimeout(() => {
            void end('provider_error', 'Voice setup timed out. Continue in text chat.');
          }, CONNECT_TIMEOUT_MS);
        };

        reconnectRef.current = async () => {
          if (reconnectAttemptedRef.current || endedRef.current) return;
          reconnectAttemptedRef.current = true;
          metricsRef.current.reconnectCount += 1;
          captureAppEvent('voice_reconnect_started');
          playbackRef.current?.interrupt();
          closeSocket();
          try {
            setPhaseIfActive('reconnecting');
            await connect(true);
            captureAppEvent('voice_reconnected');
          } catch {
            captureAppEvent('voice_reconnect_failed');
            await end('provider_error', 'Voice service is unavailable. Continue in text chat.');
          }
        };

        startAmplitudeLoop();
        startSessionClock();
        await connect(false);
        captureAppEvent('voice_provider_connected', {
          duration_ms: metricsRef.current.permissionAt
            ? Date.now() - metricsRef.current.permissionAt
            : 0,
        });
      } catch (e) {
        const message = (e as Error).message || 'Could not start the voice receptionist.';
        if (sessionIdRef.current) {
          await end('error', message);
        } else if (!endedRef.current) {
          endedRef.current = true;
          microphoneRef.current?.stop();
          playbackRef.current?.close();
          stopAmplitudeLoop();
          setErrorMessage(message);
          dispatchPhase({ type: 'fail' });
        }
      }
    })();
  }, [
    clearAssistantFlushTimer,
    clearSilenceToThinkingTimer,
    closeSocket,
    end,
    handleSocketMessage,
    propertySlug,
    setPhaseIfActive,
    startAmplitudeLoop,
    startSessionClock,
    stopAmplitudeLoop,
  ]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    markActivity();
    if (!next) return;
    clearSilenceToThinkingTimer();
    setUserSpeakingState(false);
    if (setupReadyRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
    }
  }, [clearSilenceToThinkingTimer, markActivity, setUserSpeakingState]);

  const deleteTranscript = useCallback(async () => {
    if (!endedSessionId || transcriptDeleted) return;
    await deleteVoiceReceptionistTranscript(endedSessionId);
    transcriptRef.current = [];
    setCaptions([]);
    setLiveCaption(null);
    setTranscriptDeleted(true);
  }, [endedSessionId, transcriptDeleted]);

  const handoffToHost = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (sessionId) {
      await updateVoiceReceptionistSession(sessionId, 'handoff').catch(() => undefined);
    }
    await end('guest_ended');
  }, [end]);

  /** Callback ref for the element that hosts meter-driven visuals (`--voice-*` variables). */
  const setMeterElement = useCallback(
    (el: HTMLElement | null) => {
      meterElRef.current = el;
      if (el) writeMeter(meterRef.current.input, meterRef.current.output);
    },
    [writeMeter]
  );

  useEffect(() => {
    return () => {
      stopAmplitudeLoop();
      // Only end a real server session on unmount. Calling end() with no sessionId
      // still flips phase → 'ended', which auto-closes the overlay after Strict Mode
      // remount races (and burns UX when opening from a dropdown).
      if (sessionIdRef.current) {
        void end('guest_ended');
      } else {
        endedRef.current = true;
        microphoneRef.current?.stop();
        playbackRef.current?.close();
        closeSocket();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on unmount only
  }, []);

  // Network drops: hold the call for a short grace period, then end with a text-chat fallback.
  // Returning from the background: iOS suspends audio contexts, so resume both.
  useEffect(() => {
    const handleOffline = () => {
      if (!sessionIdRef.current || endedRef.current) return;
      offlineSinceRef.current ??= Date.now();
      updateNotice('offline');
    };
    const handleOnline = () => {
      offlineSinceRef.current = null;
      lastActivityMsRef.current = Date.now();
      if (noticeRef.current === 'offline') updateNotice(null);
    };
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible' || endedRef.current) return;
      if (!sessionIdRef.current) return;
      microphoneRef.current?.resume();
      playbackRef.current?.unlock();
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [updateNotice]);

  // Hard browser close/refresh doesn't unmount React. Send one keepalive end (the only request
  // that survives unload) and tear down locally; the reaper remains the source of truth.
  useEffect(() => {
    const handlePageHide = () => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      endVoiceReceptionistSessionKeepalive(
        sessionId,
        transcriptRef.current.map(({ role, text, at }) => ({ role, text, at })),
        {
          setupMs: metricsRef.current.setupMs,
          firstAudioMs: metricsRef.current.firstAudioMs,
          reconnectCount: metricsRef.current.reconnectCount,
        }
      );
      void end('page_closed', undefined, { notifyServer: false });
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable listener, end() is a ref-backed callback
  }, []);

  return {
    phase,
    meterRef: setMeterElement,
    muted,
    toggleMute,
    remainingSeconds,
    captions,
    liveCaption,
    userSpeaking,
    toolPending,
    actions,
    audioGuidance,
    notice,
    hasEndedSession: Boolean(endedSessionId),
    canDeleteTranscript: Boolean(endedSessionId) && !transcriptDeleted,
    transcriptDeleted,
    errorMessage,
    start,
    end,
    handoffToHost,
    deleteTranscript,
  };
}
