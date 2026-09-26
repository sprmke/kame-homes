import { supabase } from '@/lib/supabase/client';

import { sanitizeVoiceReceptionistActions } from './voiceActions';

import type { LiveVoiceConnectionDescriptor } from './liveVoiceProtocol';

const FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
let cachedGuestJwt: string | null = null;

type EdgeJson = {
  success?: boolean;
  error?: string;
  data?: Record<string, unknown>;
};

function unwrapEdgePayload(json: EdgeJson): Record<string, unknown> {
  if (!json.success) throw new Error(json.error ?? 'Request failed');
  const payload = json.data;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload;
  }
  return json as Record<string, unknown>;
}

async function guestJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required.');
  cachedGuestJwt = token;
  return token;
}

async function guestEdgePost(path: string, body: Record<string, unknown>) {
  const jwt = await guestJwt();
  const res = await fetch(`${FUNCTIONS_URL}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as EdgeJson;
  return unwrapEdgePayload(json);
}

export type VoiceReceptionistStartResult = LiveVoiceConnectionDescriptor & {
  sessionId: string;
  model: string;
  voiceId: string;
  maxSessionSeconds: number;
};

export type VoiceReceptionistAction = {
  type: 'open_text_chat' | 'open_booking' | 'open_calendar' | 'open_stay_guide' | 'open_property';
  label: string;
  url: string;
};

export async function startVoiceReceptionistSession(
  propertySlug: string
): Promise<VoiceReceptionistStartResult> {
  const payload = await guestEdgePost('voice-receptionist-start', { propertySlug });
  return payload as unknown as VoiceReceptionistStartResult;
}

export async function callVoiceReceptionistTool(
  sessionId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<{
  toolName: string;
  spokenText: string;
  actions: VoiceReceptionistAction[];
}> {
  const payload = await guestEdgePost('voice-receptionist-tool', { sessionId, toolName, args });
  return {
    toolName: String(payload.toolName ?? ''),
    spokenText: String(payload.spokenText ?? ''),
    actions: sanitizeVoiceReceptionistActions(payload.actions),
  };
}

export async function updateVoiceReceptionistSession(
  sessionId: string,
  action: 'active' | 'heartbeat' | 'handoff'
): Promise<void> {
  await guestEdgePost('voice-receptionist-session', { sessionId, action });
}

export async function deleteVoiceReceptionistTranscript(sessionId: string): Promise<void> {
  await guestEdgePost('voice-receptionist-session', {
    sessionId,
    action: 'delete_transcript',
  });
}

export type VoiceReceptionistRole = 'guest' | 'assistant';
export type VoiceReceptionistTranscriptTurn = {
  role: VoiceReceptionistRole;
  text: string;
  at?: string;
};
export type VoiceReceptionistEndReason =
  | 'guest_ended'
  | 'timeout'
  | 'cap_reached'
  | 'error'
  | 'provider_go_away'
  | 'provider_error'
  | 'page_closed'
  | 'idle_timeout';

export type VoiceReceptionistClientMetrics = {
  setupMs: number | null;
  firstAudioMs: number | null;
  reconnectCount: number;
};

export async function endVoiceReceptionistSession(
  sessionId: string,
  input: {
    endReason: VoiceReceptionistEndReason;
    transcript: VoiceReceptionistTranscriptTurn[];
    metrics: VoiceReceptionistClientMetrics;
  }
): Promise<{ endedAt: string; durationSeconds: number }> {
  const payload = await guestEdgePost('voice-receptionist-end', {
    sessionId,
    endReason: input.endReason,
    transcript: input.transcript,
    metrics: input.metrics,
  });
  return payload as unknown as { endedAt: string; durationSeconds: number };
}

export function endVoiceReceptionistSessionKeepalive(
  sessionId: string,
  transcript: VoiceReceptionistTranscriptTurn[],
  metrics: VoiceReceptionistClientMetrics
): void {
  if (!cachedGuestJwt) return;
  const boundedTranscript = transcript
    .slice(-20)
    .map((turn) => ({ ...turn, text: turn.text.slice(0, 2_000) }));
  void fetch(`${FUNCTIONS_URL}/voice-receptionist-end`, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${cachedGuestJwt}`,
    },
    body: JSON.stringify({
      sessionId,
      endReason: 'page_closed',
      transcript: boundedTranscript,
      metrics,
    }),
  }).catch(() => undefined);
}
