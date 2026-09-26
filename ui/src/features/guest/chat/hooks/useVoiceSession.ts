import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { GUEST_MESSAGES_QUERY_KEY } from '@/features/guest/account/lib/guestAccountApi';
import {
  GUEST_CHAT_MESSAGES_KEY,
  GUEST_CHAT_RESUME_KEY,
} from '@/features/guest/chat/hooks/useGuestChat';
import {
  classifyLiveVoiceMessage,
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
  hasVoiceSessionIdled,
  shouldKeepInterruptedAssistantCaption,
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

export type VoiceSessionCaption = { role: VoiceReceptionistRole; text: string };
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

const AMPLITUDE_GAIN = 3.2;
const AMPLITUDE_SMOOTHING = 0.72;
const CAPTION_HISTORY_LIMIT = 20;
const MIC_ACTIVITY_RMS_THRESHOLD = 0.02;
/** Local VAD (UI only) — hysteresis so status flips before Gemini commits end-of-speech. */
const LOCAL_SPEAKING_ON_RMS = 0.022;
const LOCAL_SPEAKING_OFF_RMS = 0.01;
/** After guest mic goes quiet, show Thinking until AI audio / tool call arrives. */
const LOCAL_SILENCE_TO_THINKING_MS = 550;
/** Wait for late outputTranscription chunks after turnComplete before committing assistant text. */
const ASSISTANT_FLUSH_DEBOUNCE_MS = 450;

export function useVoiceSession(propertySlug: string) {
  const qc = useQueryClient();
  const [phase, dispatchPhase] = useReducer(voiceSessionPhaseReducer, 'idle');
  const [amplitude, setAmplitude] = useState(0);
  const [muted, setMuted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [captions, setCaptions] = useState<VoiceSessionCaption[]>([]);
  const [liveCaption, setLiveCaption] = useState<VoiceSessionCaption | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** True while local mic energy looks like guest speech (independent of Gemini VAD). */
  const [userSpeaking, setUserSpeaking] = useState(false);
  /** True while getPropertyFact is in flight (Phase 6.2 / 6.3 status copy). */
  const [toolPending, setToolPending] = useState(false);
  const [actions, setActions] = useState<VoiceSessionAction[]>([]);
  const [audioGuidance, setAudioGuidance] = useState<string | null>(null);
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
  const sessionIdRef = useRef<string | null>(null);
  const maxSessionSecondsRef = useRef(0);
  const startedAtMsRef = useRef(0);

  const microphoneRef = useRef<VoiceMicrophoneCapture | null>(null);
  if (!microphoneRef.current) microphoneRef.current = new VoiceMicrophoneCapture();
  const micRmsRef = useRef(0);

  const playbackRef = useRef<VoicePlaybackQueue | null>(null);
  if (!playbackRef.current) playbackRef.current = new VoicePlaybackQueue();

  const rafIdRef = useRef<number | null>(null);
  const lastRemainingRef = useRef(-1);
  const smoothedAmpRef = useRef(0);
  const lastSetAmpRef = useRef(0);
  const lastActivityMsRef = useRef(Date.now());

  const currentInputBufferRef = useRef('');
  const currentOutputBufferRef = useRef('');
  const transcriptRef = useRef<VoiceReceptionistTranscriptTurn[]>([]);
  const assistantFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumptionHandleRef = useRef<string | null>(null);
  const reconnectAttemptedRef = useRef(false);
  const reconnectRef = useRef<(() => Promise<void>) | null>(null);
  const greetingSentRef = useRef(false);
  const interruptionCountRef = useRef(0);
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

  /**
   * Local RMS → UI speaking / thinking. Does not replace Gemini server VAD for the model;
   * only closes the "stuck on LISTENING" gap after the guest stops talking.
   */
  const applyLocalVad = useCallback(
    (rms: number) => {
      if (mutedRef.current || endedRef.current) return;
      const phase = phaseRef.current;
      if (
        phase === 'connecting' ||
        phase === 'reconnecting' ||
        phase === 'ending' ||
        phase === 'ended' ||
        phase === 'error'
      ) {
        return;
      }

      if (!userSpeakingRef.current && rms >= LOCAL_SPEAKING_ON_RMS) {
        clearSilenceToThinkingTimer();
        setUserSpeakingState(true);
        if (phase === 'thinking' || phase === 'listening') {
          setPhaseIfActive('listening');
        }
        return;
      }

      if (userSpeakingRef.current && rms <= LOCAL_SPEAKING_OFF_RMS) {
        if (silenceToThinkingTimerRef.current !== null) return;
        silenceToThinkingTimerRef.current = setTimeout(() => {
          silenceToThinkingTimerRef.current = null;
          setUserSpeakingState(false);
          if (
            !endedRef.current &&
            playbackRef.current?.pendingCount === 0 &&
            (phaseRef.current === 'listening' || phaseRef.current === 'thinking')
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

  /** Commit bounded local captions without an extra model call. */
  const commitTurn = useCallback((role: VoiceReceptionistRole, rawText: string) => {
    const raw = normalizeVoiceTranscriptText(rawText);
    if (!raw) return;

    if (role === 'assistant') {
      const words = raw.split(/\s+/);
      if (words.length <= 2 && !/[.!?]$/.test(raw)) return;
    }

    const at = new Date().toISOString();
    const last = transcriptRef.current[transcriptRef.current.length - 1];
    let nextText = raw;
    if (last?.role === role) {
      nextText = mergeVoiceTranscription(last.text, raw);
      if (nextText === last.text) {
        setLiveCaption({ role, text: nextText });
        return;
      }
      transcriptRef.current = [...transcriptRef.current.slice(0, -1), { role, text: nextText, at }];
    } else {
      transcriptRef.current = [...transcriptRef.current, { role, text: nextText, at }];
    }

    const caption: VoiceSessionCaption = { role, text: nextText };
    setCaptions((prev) => {
      const prevLast = prev[prev.length - 1];
      if (prevLast?.role === role) {
        return [...prev.slice(0, -1), caption].slice(-CAPTION_HISTORY_LIMIT);
      }
      return [...prev, caption].slice(-CAPTION_HISTORY_LIMIT);
    });
    setLiveCaption(caption);
  }, []);

  const flushInputBuffer = useCallback(() => {
    const text = currentInputBufferRef.current.trim();
    currentInputBufferRef.current = '';
    if (text) commitTurn('guest', text);
  }, [commitTurn]);

  const flushOutputBuffer = useCallback(() => {
    clearAssistantFlushTimer();
    const text = currentOutputBufferRef.current.trim();
    currentOutputBufferRef.current = '';
    if (text) commitTurn('assistant', text);
  }, [clearAssistantFlushTimer, commitTurn]);

  const scheduleAssistantFlush = useCallback(() => {
    clearAssistantFlushTimer();
    assistantFlushTimerRef.current = setTimeout(() => {
      assistantFlushTimerRef.current = null;
      flushOutputBuffer();
    }, ASSISTANT_FLUSH_DEBOUNCE_MS);
  }, [clearAssistantFlushTimer, flushOutputBuffer]);

  const stopMic = useCallback(() => {
    microphoneRef.current?.stop();
  }, []);

  const stopPlayback = useCallback(() => {
    playbackRef.current?.stop();
  }, []);

  const stopAmplitudeLoop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const endingPromiseRef = useRef<Promise<void> | null>(null);

  const end = useCallback(
    (reason: VoiceReceptionistEndReason = 'guest_ended', message?: string): Promise<void> => {
      if (endedRef.current) return endingPromiseRef.current ?? Promise.resolve();
      endedRef.current = true;
      dispatchPhase({ type: 'begin_end' });
      if (message) setErrorMessage(message);

      flushInputBuffer();
      flushOutputBuffer();
      clearAssistantFlushTimer();
      setLiveCaption(null);
      clearSilenceToThinkingTimer();
      setUserSpeakingState(false);
      if (heartbeatTimerRef.current !== null) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      if (setupTimeoutRef.current !== null) {
        clearTimeout(setupTimeoutRef.current);
        setupTimeoutRef.current = null;
      }

      stopAmplitudeLoop();
      stopMic();
      stopPlayback();
      try {
        wsRef.current?.close();
      } catch {
        // already closed
      }
      wsRef.current = null;

      const sessionId = sessionIdRef.current;
      const transcript = transcriptRef.current;
      sessionIdRef.current = null;

      const finish = async () => {
        if (sessionId) {
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
        const failed =
          reason === 'error' || reason === 'provider_error' || reason === 'provider_go_away';
        dispatchPhase({ type: failed ? 'fail' : 'end_success' });
      };

      const promise = finish();
      endingPromiseRef.current = promise;
      captureAppEvent(
        reason === 'error' || reason === 'provider_error'
          ? 'voice_session_failed'
          : 'voice_session_ended',
        {
          reason,
          duration_ms: startedAtMsRef.current ? Date.now() - startedAtMsRef.current : 0,
        }
      );
      return promise;
    },
    [
      qc,
      clearAssistantFlushTimer,
      clearSilenceToThinkingTimer,
      flushInputBuffer,
      flushOutputBuffer,
      setUserSpeakingState,
      stopAmplitudeLoop,
      stopMic,
      stopPlayback,
    ]
  );

  const startAmplitudeLoop = useCallback(() => {
    lastRemainingRef.current = -1;
    smoothedAmpRef.current = 0;
    lastSetAmpRef.current = 0;

    const tick = () => {
      const nowMs = Date.now();
      const remaining = voiceRemainingSeconds({
        startedAtMs: startedAtMsRef.current,
        maxSessionSeconds: maxSessionSecondsRef.current,
        nowMs,
      });
      if (remaining !== lastRemainingRef.current) {
        lastRemainingRef.current = remaining;
        setRemainingSeconds(remaining);
        if (remaining <= 0 && !endedRef.current) {
          end('timeout');
          return;
        }
      }

      if (
        hasVoiceSessionIdled({
          phase: phaseRef.current,
          lastActivityMs: lastActivityMsRef.current,
          nowMs,
        })
      ) {
        end('idle_timeout', 'Ended the call due to inactivity.');
        return;
      }

      let target = 0;
      if (phaseRef.current === 'speaking') {
        target = playbackRef.current?.readRms() ?? 0;
      } else if (
        phaseRef.current === 'listening' ||
        phaseRef.current === 'thinking' ||
        userSpeakingRef.current
      ) {
        target = micRmsRef.current;
      }

      const smoothed =
        smoothedAmpRef.current * AMPLITUDE_SMOOTHING +
        Math.min(1, target * AMPLITUDE_GAIN) * (1 - AMPLITUDE_SMOOTHING);
      smoothedAmpRef.current = smoothed;
      if (Math.abs(smoothed - lastSetAmpRef.current) > 0.015) {
        lastSetAmpRef.current = smoothed;
        setAmplitude(smoothed);
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
  }, [end]);

  const playPcm16Base64 = useCallback(
    async (b64: string) => {
      await playbackRef.current?.enqueue(b64, {
        onStart: () => {
          setPhaseIfActive('speaking');
          clearSilenceToThinkingTimer();
          setUserSpeakingState(false);
        },
        onIdle: () => setPhaseIfActive('listening'),
      });
    },
    [clearSilenceToThinkingTimer, setPhaseIfActive, setUserSpeakingState]
  );

  /**
   * Requests mic permission up front — before minting a session/token — so a permission
   * denial never consumes a guest daily-cap slot or leaves an orphaned session row.
   */
  const acquireMicStream = useCallback(async (): Promise<void> => {
    await microphoneRef.current?.acquire(() => {
      if (!endedRef.current) end('error', 'Microphone disconnected.');
    });
  }, [end]);

  const attachMicWorklet = useCallback(async () => {
    await microphoneRef.current?.attach(({ pcm, rms }) => {
      micRmsRef.current = rms;
      if (rms > MIC_ACTIVITY_RMS_THRESHOLD) markActivity();
      applyLocalVad(rms);
      if (mutedRef.current) return;
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;
      const data = int16ToBase64(pcm);
      wsRef.current.send(
        JSON.stringify({
          realtimeInput: {
            audio: { mimeType: `audio/pcm;rate=${VOICE_MIC_SAMPLE_RATE}`, data },
          },
        })
      );
    });
  }, [applyLocalVad, markActivity]);

  const handleToolCall = useCallback(
    async (ws: WebSocket, toolCall: ToolCallMessage) => {
      const calls = toolCall.functionCalls ?? [];
      if (!calls.length) return;
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

        if (ws.readyState === WebSocket.OPEN) {
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
        setToolPending(false);
      }
    },
    [setPhaseIfActive]
  );

  const handleSocketMessage = useCallback(
    async (ws: WebSocket, event: MessageEvent) => {
      let raw = event.data as string;
      if (event.data instanceof Blob) raw = await event.data.text();
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return;
      }
      const messageKinds = classifyLiveVoiceMessage(msg);

      if (messageKinds.includes('setup_complete')) {
        try {
          if (setupTimeoutRef.current !== null) {
            clearTimeout(setupTimeoutRef.current);
            setupTimeoutRef.current = null;
          }
          const sessionId = sessionIdRef.current;
          if (!sessionId) throw new Error('Voice session is no longer active.');
          await updateVoiceReceptionistSession(sessionId, 'active');
          if (!greetingSentRef.current && ws.readyState === WebSocket.OPEN) {
            greetingSentRef.current = true;
            ws.send(JSON.stringify({ realtimeInput: { text: 'Start the call.' } }));
          }
          if (heartbeatTimerRef.current !== null) clearInterval(heartbeatTimerRef.current);
          heartbeatTimerRef.current = setInterval(() => {
            const activeSessionId = sessionIdRef.current;
            if (activeSessionId) {
              void updateVoiceReceptionistSession(activeSessionId, 'heartbeat').catch(() => {
                end('error', 'Voice session expired. Please try again.');
              });
            }
          }, 30_000);
          if (!microphoneRef.current?.isAttached) await attachMicWorklet();
          metricsRef.current.setupMs = metricsRef.current.permissionAt
            ? Date.now() - metricsRef.current.permissionAt
            : null;
          captureAppEvent('voice_setup_completed', {
            duration_ms: metricsRef.current.setupMs ?? 0,
          });
          markActivity();
          setPhaseIfActive('listening');
        } catch (e) {
          end('error', (e as Error).message || 'Microphone access failed.');
        }
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
          end('provider_go_away', 'Voice service is restarting. Continue in text chat.');
        }
        return;
      }
      if (messageKinds.includes('provider_error')) {
        end('provider_error', 'Voice service is unavailable. Continue in text chat.');
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
        stopPlayback();
        // Don't commit a half-spoken AI scrap ("Is there") after barge-in.
        const partialOut = currentOutputBufferRef.current.trim();
        if (partialOut) {
          if (shouldKeepInterruptedAssistantCaption(partialOut)) {
            flushOutputBuffer();
          } else {
            currentOutputBufferRef.current = '';
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
        const merged = mergeVoiceTranscription(
          currentInputBufferRef.current,
          serverContent.inputTranscription.text
        );
        currentInputBufferRef.current = merged;
        setLiveCaption({ role: 'guest', text: merged });
        setUserSpeakingState(true);
        clearSilenceToThinkingTimer();
        if (phaseRef.current !== 'speaking' || playbackRef.current?.pendingCount === 0) {
          setPhaseIfActive('listening');
        }
      }
      if (serverContent.outputTranscription?.text) {
        markActivity();
        // Late STT after turnComplete — cancel pending flush and keep accumulating.
        clearAssistantFlushTimer();
        if (lastCaptionRoleRef.current === 'guest' && currentInputBufferRef.current.trim()) {
          flushInputBuffer();
        }
        lastCaptionRoleRef.current = 'assistant';
        const merged = mergeVoiceTranscription(
          currentOutputBufferRef.current,
          serverContent.outputTranscription.text
        );
        currentOutputBufferRef.current = merged;
        setLiveCaption({ role: 'assistant', text: merged });
        setUserSpeakingState(false);
        clearSilenceToThinkingTimer();
      }

      const parts = serverContent.modelTurn?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
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
          void playPcm16Base64(part.inlineData.data);
        }
      }

      if (serverContent.turnComplete || serverContent.generationComplete) {
        flushInputBuffer();
        // Debounce assistant commit so late outputTranscription chunks can land.
        if (currentOutputBufferRef.current.trim()) {
          scheduleAssistantFlush();
        }
        lastCaptionRoleRef.current = null;
        if (playbackRef.current?.pendingCount === 0) {
          if (phaseRef.current === 'thinking' || phaseRef.current === 'speaking') {
            setPhaseIfActive('listening');
          }
        }
      }
    },
    [
      attachMicWorklet,
      clearAssistantFlushTimer,
      clearSilenceToThinkingTimer,
      end,
      flushInputBuffer,
      flushOutputBuffer,
      handleToolCall,
      markActivity,
      playPcm16Base64,
      scheduleAssistantFlush,
      setPhaseIfActive,
      setUserSpeakingState,
      stopPlayback,
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
    lastCaptionRoleRef.current = null;
    clearAssistantFlushTimer();
    setCaptions([]);
    setLiveCaption(null);
    setErrorMessage(null);
    setAmplitude(0);
    setUserSpeaking(false);
    userSpeakingRef.current = false;
    clearSilenceToThinkingTimer();
    setToolPending(false);
    setActions([]);
    setAudioGuidance(null);
    setEndedSessionId(null);
    setTranscriptDeleted(false);
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
    interruptionCountRef.current = 0;
    dispatchPhase({ type: 'start' });

    void (async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          throw new Error('You appear to be offline. Check your connection and try again.');
        }

        // Ask for the mic before minting a session/token, so a permission denial never
        // consumes a guest daily-cap slot or leaves an orphaned session row server-side.
        try {
          await acquireMicStream();
          metricsRef.current.permissionAt = Date.now();
          captureAppEvent('voice_mic_permission_outcome', { outcome: 'granted' });
        } catch (error) {
          captureAppEvent('voice_mic_permission_outcome', { outcome: 'denied' });
          throw error;
        }

        const minted = await startVoiceReceptionistSession(propertySlug);
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
          }
          const ws = new WebSocket(liveVoiceWebSocketUrl(minted));
          wsRef.current = ws;
          ws.onmessage = (event) => void handleSocketMessage(ws, event);
          ws.onerror = () => {
            if (wsRef.current === ws && !endedRef.current) {
              end('provider_error', 'Voice connection lost. Continue in text chat.');
            }
          };
          ws.onclose = (event) => {
            if (wsRef.current === ws && !endedRef.current) {
              const close = describeLiveVoiceClose(event);
              end('provider_error', close.message);
            }
          };

          await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(() => {
              reject(new Error('Voice connection timed out. Please try again.'));
            }, 8_000);
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
            end('provider_error', 'Voice setup timed out. Continue in text chat.');
          }, 8_000);
        };

        reconnectRef.current = async () => {
          if (reconnectAttemptedRef.current || endedRef.current) return;
          reconnectAttemptedRef.current = true;
          metricsRef.current.reconnectCount += 1;
          captureAppEvent('voice_reconnect_started');
          const previous = wsRef.current;
          if (previous) {
            previous.onclose = null;
            previous.onerror = null;
            previous.close();
          }
          try {
            setPhaseIfActive('reconnecting');
            await connect(true);
            captureAppEvent('voice_reconnected');
          } catch {
            captureAppEvent('voice_reconnect_failed');
            await end('provider_error', 'Voice service is unavailable. Continue in text chat.');
          }
        };

        await connect(false);
        captureAppEvent('voice_provider_connected', {
          duration_ms: metricsRef.current.permissionAt
            ? Date.now() - metricsRef.current.permissionAt
            : 0,
        });

        startAmplitudeLoop();
      } catch (e) {
        const message = (e as Error).message || 'Could not start the voice receptionist.';
        if (sessionIdRef.current) {
          await end('error', message);
        } else {
          stopMic();
          setErrorMessage(message);
          dispatchPhase({ type: 'fail' });
        }
      }
    })();
  }, [
    acquireMicStream,
    clearAssistantFlushTimer,
    clearSilenceToThinkingTimer,
    end,
    handleSocketMessage,
    propertySlug,
    setPhaseIfActive,
    startAmplitudeLoop,
    stopMic,
  ]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      if (next) {
        clearSilenceToThinkingTimer();
        setUserSpeakingState(false);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
        }
      }
      return next;
    });
  }, [clearSilenceToThinkingTimer, setUserSpeakingState]);

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

  useEffect(() => {
    return () => {
      // Only end a real server session on unmount. Calling end() with no sessionId
      // still flips phase → 'ended', which auto-closes the overlay after Strict Mode
      // remount races (and burns UX when opening from a dropdown).
      if (sessionIdRef.current) {
        end('guest_ended');
      } else {
        stopMic();
        try {
          wsRef.current?.close();
        } catch {
          // already closed
        }
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on unmount only
  }, []);

  // Hard browser close/refresh doesn't unmount React — best-effort end call so the session
  // row closes promptly instead of relying solely on the server's stale-session cap aging.
  useEffect(() => {
    const handlePageHide = () => {
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        endVoiceReceptionistSessionKeepalive(sessionId, transcriptRef.current, {
          setupMs: metricsRef.current.setupMs,
          firstAudioMs: metricsRef.current.firstAudioMs,
          reconnectCount: metricsRef.current.reconnectCount,
        });
      }
      void end('page_closed');
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable listener, end() is a ref-backed callback
  }, []);

  return {
    phase,
    amplitude,
    muted,
    toggleMute,
    remainingSeconds,
    captions,
    liveCaption,
    userSpeaking,
    toolPending,
    actions,
    audioGuidance,
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
