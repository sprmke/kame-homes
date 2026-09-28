import type { AssistantAiBlocker } from '@/features/dashboard/ai-assistant/lib/assistantAiOff';
import type { AttachedContextItem } from '@/features/dashboard/ai-assistant/lib/attachedContext';
import { scopedOrgFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

export type ActionConfirmationBlock = {
  type: 'action_confirmation';
  actionId: string;
  toolName: string;
  riskTier: 'tier1_auto' | 'tier2_confirmed';
  summary: string;
  details: Array<{ label: string; value: string }>;
  status: 'proposed' | 'confirmed' | 'executed' | 'denied' | 'expired';
  isExternalSend?: boolean;
  errorMessage?: string;
  /** Server-built outcome line after Confirm (e.g. "Applied to 42 nights."). */
  resultNote?: string;
};

export type ActivityPhase = 'understanding' | 'tool' | 'synthesizing' | 'safety';

export type ActivityTimelineEntry = {
  id: string;
  phase: ActivityPhase;
  label: string;
  toolName?: string;
  status: 'done' | 'failed';
  durationMs?: number;
  /** Host-facing reason for a failed tool row. */
  reason?: string;
};

export type TaskPlanStepStatus = 'pending' | 'running' | 'done' | 'failed';

export type TaskPlanStep = {
  id: string;
  label: string;
  status: TaskPlanStepStatus;
  toolName?: string;
  reason?: string;
};

export type StepperStep = {
  label: string;
  status: 'done' | 'current' | 'upcoming';
  description?: string;
  actionBlock?: ActionConfirmationBlock;
};

export type DynamicFormFieldOption = { value: string; label: string };

export type DynamicFormFieldType =
  'text' | 'textarea' | 'number' | 'select' | 'radio' | 'date' | 'email' | 'tel' | 'checkbox';

export type DynamicFormField = {
  fieldType: DynamicFormFieldType;
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  /** `select` / `radio` only. */
  options?: DynamicFormFieldOption[];
  /** `number` only. */
  min?: number;
  max?: number;
  /** `text` / `textarea` only. */
  maxLength?: number;
};

export type DynamicFormBlock = {
  type: 'dynamic_form';
  formId: string;
  /** Tool the model intends to call once the host submits — informational only. */
  toolName?: string;
  title?: string;
  description?: string;
  fields: DynamicFormField[];
  submitLabel?: string;
  status: 'pending' | 'submitted';
  /** Filled values, present once `status` is `submitted` (read-only recap). */
  values?: Record<string, string>;
};

export type FlowBlock = {
  type: 'flow';
  title?: string;
  steps: string[];
};

export type DiagramBlock = {
  type: 'diagram';
  title?: string;
  format: 'mermaid' | 'text';
  source: string;
};

export type MapBlock = {
  type: 'map';
  href: string;
  lat: number | null;
  lng: number | null;
  label: string;
};

/** Server-built handoff to an allowlisted dashboard screen (`open_page` tool). */
export type OpenPageBlock = {
  type: 'open_page';
  routeKey: string;
  label: string;
  href: string;
};

export type ChatBlock =
  | { type: 'text'; text: string }
  | OpenPageBlock
  | {
      type: 'booking_card';
      bookingId: string;
      guestName: string;
      status: string;
      checkIn: string;
      checkOut: string;
      propertyName: string;
      balanceDue: number | null;
    }
  | { type: 'stat_list'; title: string; items: Array<{ label: string; value: string }> }
  | {
      type: 'data_table';
      title: string;
      columns: string[];
      rows: Array<Record<string, string | number>>;
      /** Aligned with `rows`; set by the server for rows that map to a booking. */
      rowTargets?: Array<{ bookingId: string; propertyId?: string; parkingId?: string } | null>;
    }
  | { type: 'link_list'; title: string; links: Array<{ label: string; href: string }> }
  | {
      type: 'file_list';
      title: string;
      files: Array<{ label: string; url: string; kind?: 'image' | 'pdf' | 'file' }>;
    }
  | { type: 'image'; title: string; url: string; alt: string }
  | { type: 'stepper'; title: string; steps: StepperStep[] }
  | { type: 'activity_timeline'; entries: ActivityTimelineEntry[] }
  | { type: 'task_plan'; title: string; steps: TaskPlanStep[] }
  | { type: 'quick_actions'; actions: Array<{ label: string; prompt: string }> }
  | FlowBlock
  | DiagramBlock
  | MapBlock
  | DynamicFormBlock
  | ActionConfirmationBlock;

export type ChatAttachmentMeta = {
  name: string;
  mimeType: string;
  size?: number;
  path?: string;
};

export type PageContext = {
  propertyId?: string | null;
  parkingId?: string | null;
  bookingId?: string | null;
};

export type ChatTurnResponse = {
  conversationId: string;
  blocks: ChatBlock[];
  upgradeHook?: boolean;
};

export type ConfirmActionResponse = {
  status: 'executed' | 'denied' | 'expired' | 'pending';
  ok?: boolean;
  error?: string | null;
  data?: unknown;
  alreadyResolved?: boolean;
  resultNote?: string | null;
};

export type AiDashboardAssistantUsageSummary = {
  todayMessageCount: number;
  monthMessageCount: number;
  todayWriteActionCount: number;
  monthWriteActionCount: number;
  todayCreditsConsumed: number;
  monthCreditsConsumed: number;
};

export type AiDashboardAssistantOrgSettings = {
  organizationId: string;
  enabled: boolean;
  disabledPropertyIds: string[];
  dailyMessageLimit: number;
  monthlyMessageLimit: number;
  dailyWriteActionLimit: number;
  updatedBy: string | null;
  updatedAt: string;
  platformEnabled: boolean;
  /** Platform switch for full-page AI mode (already false when `platformEnabled` is false). */
  aiModeEnabled?: boolean;
  /** AI platform layer that turns the assistant off: super admin (`platform`) or the org AI switch. */
  aiBlocker?: AssistantAiBlocker | null;
  usage: AiDashboardAssistantUsageSummary | null;
};

export type AiDashboardAssistantGlobalSettings = {
  enabled: boolean;
  aiModeEnabled: boolean;
  updatedBy: string | null;
  updatedAt: string;
};

async function callAiAssistantFn<T>(url: string, init?: RequestInit): Promise<T> {
  const jwt = await getSessionJwt();
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const json = (await res.json()) as { success?: boolean; error?: string; data?: T } & Record<
    string,
    unknown
  >;
  if (!res.ok || !json.success) {
    const err = new Error(json.error ?? 'Request failed') as Error & {
      status?: number;
      upgradeHook?: boolean;
    };
    err.status = res.status;
    err.upgradeHook = json.upgradeHook === true;
    throw err;
  }
  return json.data as T;
}

function baseUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
}

export function sendChatMessage(input: {
  orgSlug: string;
  conversationId?: string | null;
  pageContext: PageContext;
  attachedContext?: AttachedContextItem[];
  message: string;
  attachments?: Array<{ name: string; mimeType: string; dataBase64: string }>;
}): Promise<ChatTurnResponse> {
  return callAiAssistantFn<ChatTurnResponse>(`${baseUrl()}/dashboard-assistant-chat`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function confirmAssistantAction(input: {
  actionId: string;
  confirm: boolean;
}): Promise<ConfirmActionResponse> {
  return callAiAssistantFn<ConfirmActionResponse>(`${baseUrl()}/dashboard-assistant-confirm`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchAiDashboardAssistantSettings(
  orgSlug: string | null,
  orgId: string | null,
  options?: { includeUsage?: boolean }
): Promise<AiDashboardAssistantOrgSettings> {
  const url = scopedOrgFunctionsUrl('dashboard-assistant-settings', orgSlug, orgId);
  const withUsage = options?.includeUsage
    ? `${url}${url.includes('?') ? '&' : '?'}includeUsage=true`
    : url;
  return callAiAssistantFn<AiDashboardAssistantOrgSettings>(withUsage);
}

export function updateAiDashboardAssistantSettings(
  orgSlug: string | null,
  orgId: string | null,
  patch: {
    enabled?: boolean;
    disabledPropertyIds?: string[];
    dailyMessageLimit?: number;
    monthlyMessageLimit?: number;
    dailyWriteActionLimit?: number;
  }
): Promise<AiDashboardAssistantOrgSettings> {
  return callAiAssistantFn<AiDashboardAssistantOrgSettings>(
    scopedOrgFunctionsUrl('dashboard-assistant-settings', orgSlug, orgId),
    { method: 'PATCH', body: JSON.stringify(patch) }
  );
}

export function fetchAiDashboardAssistantGlobalSettings(): Promise<AiDashboardAssistantGlobalSettings> {
  return callAiAssistantFn<AiDashboardAssistantGlobalSettings>(
    `${baseUrl()}/dashboard-assistant-global-settings`
  );
}

export function updateAiDashboardAssistantGlobalSettings(patch: {
  enabled?: boolean;
  aiModeEnabled?: boolean;
}): Promise<AiDashboardAssistantGlobalSettings> {
  return callAiAssistantFn<AiDashboardAssistantGlobalSettings>(
    `${baseUrl()}/dashboard-assistant-global-settings`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }
  );
}

export type AiAssistantConversationSummary = {
  id: string;
  title: string | null;
  property_id: string | null;
  last_message_at: string;
  created_at: string;
  pinned_at?: string | null;
  archived_at?: string | null;
};

export type AiAssistantConversationPage = {
  conversations: AiAssistantConversationSummary[];
  nextOffset: number | null;
};

export type AssistantFeedbackRating = 1 | -1;

export type AiAssistantMessageRow = {
  id: string;
  role: 'user' | 'assistant';
  content_text: string | null;
  blocks: ChatBlock[];
  attachments?: ChatAttachmentMeta[];
  created_at: string;
};

export function fetchAiAssistantConversations(
  orgSlug: string | null,
  orgId: string | null,
  options: { offset?: number; q?: string; archived?: boolean } = {}
): Promise<AiAssistantConversationPage> {
  const url = new URL(scopedOrgFunctionsUrl('dashboard-assistant-conversations', orgSlug, orgId));
  if (options.offset) url.searchParams.set('offset', String(options.offset));
  if (options.q?.trim()) url.searchParams.set('q', options.q.trim());
  if (options.archived) url.searchParams.set('archived', 'true');
  return callAiAssistantFn(url.toString());
}

export function fetchAiAssistantConversationMessages(conversationId: string): Promise<{
  conversation: AiAssistantConversationSummary;
  messages: AiAssistantMessageRow[];
  /** The caller's own rating per assistant message id. */
  feedback?: Record<string, AssistantFeedbackRating>;
}> {
  return callAiAssistantFn(
    `${baseUrl()}/dashboard-assistant-conversations?conversation_id=${encodeURIComponent(conversationId)}`
  );
}

export function deleteAiAssistantConversation(
  conversationId: string
): Promise<{ deleted: boolean }> {
  return callAiAssistantFn(
    `${baseUrl()}/dashboard-assistant-conversations?conversation_id=${encodeURIComponent(conversationId)}`,
    { method: 'DELETE' }
  );
}

export function updateAiAssistantConversation(
  conversationId: string,
  patch: { title?: string; pinned?: boolean; archived?: boolean }
): Promise<{ conversation: AiAssistantConversationSummary }> {
  return callAiAssistantFn(
    `${baseUrl()}/dashboard-assistant-conversations?conversation_id=${encodeURIComponent(conversationId)}`,
    { method: 'PATCH', body: JSON.stringify(patch) }
  );
}

export function sendAssistantFeedback(input: {
  messageId: string;
  rating: AssistantFeedbackRating | 0;
  reason?: string;
}): Promise<{ messageId: string; rating: AssistantFeedbackRating | 0 }> {
  return callAiAssistantFn(`${baseUrl()}/dashboard-assistant-feedback`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type AssistantBriefingCard = {
  id: string;
  label: string;
  count: number;
  severity: 'critical' | 'warning' | 'info';
  prompt: string;
  /** Legacy flat dashboard href (`/bookings?…`); resolve with `resolveScopedDashboardHref`. */
  href: string;
};

export function fetchAssistantBriefing(
  orgSlug: string | null,
  orgId: string | null,
  scope: { propertyId?: string | null; parkingId?: string | null }
): Promise<{ cards: AssistantBriefingCard[]; manilaDate: string | null }> {
  const url = new URL(scopedOrgFunctionsUrl('dashboard-assistant-briefing', orgSlug, orgId));
  if (scope.propertyId) url.searchParams.set('property_id', scope.propertyId);
  else if (scope.parkingId) url.searchParams.set('parking_id', scope.parkingId);
  return callAiAssistantFn(url.toString());
}

export type UserUiPreferences = {
  dashboardMode: 'advanced' | 'ai';
  updatedAt: string | null;
};

export function fetchUserUiPreferences(): Promise<UserUiPreferences> {
  return callAiAssistantFn(`${baseUrl()}/user-ui-preferences`);
}

export function updateUserUiPreferences(patch: {
  dashboardMode: 'advanced' | 'ai';
}): Promise<UserUiPreferences> {
  return callAiAssistantFn(`${baseUrl()}/user-ui-preferences`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export type AssistantMemoryItem = {
  id: string;
  kind: 'preference' | 'house_style';
  content: string;
  createdAt: string;
};

export type AssistantMemory = {
  preferences: AssistantMemoryItem[];
  houseStyle: AssistantMemoryItem[];
  canManageHouseStyle: boolean;
};

export function fetchAssistantMemory(
  orgSlug: string | null,
  orgId: string | null
): Promise<AssistantMemory> {
  return callAiAssistantFn(scopedOrgFunctionsUrl('dashboard-assistant-memory', orgSlug, orgId));
}

export function addAssistantMemory(
  orgSlug: string | null,
  orgId: string | null,
  input: { kind: 'preference' | 'house_style'; content: string }
): Promise<{ memory: AssistantMemoryItem }> {
  return callAiAssistantFn(scopedOrgFunctionsUrl('dashboard-assistant-memory', orgSlug, orgId), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteAssistantMemory(
  orgSlug: string | null,
  orgId: string | null,
  id: string
): Promise<{ deleted: boolean }> {
  const url = new URL(scopedOrgFunctionsUrl('dashboard-assistant-memory', orgSlug, orgId));
  url.searchParams.set('id', id);
  return callAiAssistantFn(url.toString(), { method: 'DELETE' });
}
