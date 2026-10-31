import {
  appendOrgId,
  appendParkingId,
  appendPropertyId,
} from '@/features/dashboard/org/lib/adminApiScope';
import { callEdgeFunction, getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

import { prepareUpload } from '@/lib/media/prepareUpload';
import { withAntiSpam, type AntiSpamRequestFields } from '@/lib/security/antiSpamRequest';

import type { SupportTicketAttachmentDraft, SupportTicketCategory } from './supportTicketSchema';

export type SupportTicketScopeParams = {
  orgSlug: string | null;
  orgId: string | null;
  propertyId: string | null;
  parkingId: string | null;
  /** Explore Contact /account/tickets — omit org params so the API uses guest channel. */
  channel?: 'host' | 'guest';
};

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type SupportTicket = {
  id: string;
  channel?: 'host' | 'guest';
  organization_id: string | null;
  property_id: string | null;
  parking_id: string | null;
  submitted_by_user_id: string;
  submitted_by_name: string;
  submitted_by_email: string;
  category: SupportTicketCategory;
  subject: string;
  status: SupportTicketStatus;
  priority: 'low' | 'medium' | 'high' | null;
  category_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SupportTicketMessage = {
  id: string;
  ticket_id: string;
  sender_type: 'host' | 'guest' | 'admin';
  sender_user_id: string | null;
  sender_name: string;
  body: string;
  attachments: Array<SupportTicketAttachmentDraft & { url?: string | null }>;
  created_at: string;
};

function scopeQuery(scope: SupportTicketScopeParams): URLSearchParams {
  const params = new URLSearchParams();
  if (scope.channel === 'guest') return params;
  appendOrgId(params, scope.orgSlug, scope.orgId);
  appendPropertyId(params, scope.propertyId);
  appendParkingId(params, scope.parkingId);
  return params;
}

export function fetchSupportTickets(
  scope: SupportTicketScopeParams
): Promise<{ tickets: SupportTicket[] }> {
  return callEdgeFunction(`list-support-tickets?${scopeQuery(scope).toString()}`);
}

export function fetchSupportTicket(
  scope: SupportTicketScopeParams,
  ticketId: string
): Promise<{ ticket: SupportTicket; messages: SupportTicketMessage[] }> {
  const params = scopeQuery(scope);
  params.set('ticket_id', ticketId);
  return callEdgeFunction(`get-support-ticket?${params.toString()}`);
}

export type SubmitSupportTicketPayload = SupportTicketScopeParams & {
  category: SupportTicketCategory;
  subject: string;
  description: string;
  pageUrl?: string;
  browserInfo?: string;
  severity?: string;
  expectedBenefit?: string;
  contactPreference?: string;
  attachments?: SupportTicketAttachmentDraft[];
};

export function submitSupportTicket(
  payload: SubmitSupportTicketPayload,
  antiSpam?: Partial<AntiSpamRequestFields>
): Promise<{ ticket: SupportTicket; message: SupportTicketMessage }> {
  return callEdgeFunction('submit-support-ticket', {
    method: 'POST',
    body: JSON.stringify(withAntiSpam({ ...payload }, antiSpam)),
  });
}

export function replySupportTicket(
  scope: SupportTicketScopeParams,
  ticketId: string,
  message: string,
  attachments?: SupportTicketAttachmentDraft[]
): Promise<{ message: SupportTicketMessage }> {
  return callEdgeFunction('reply-support-ticket', {
    method: 'POST',
    body: JSON.stringify({ ...scope, ticketId, message, attachments }),
  });
}

export function reopenSupportTicket(
  scope: SupportTicketScopeParams,
  ticketId: string
): Promise<{ ticket: SupportTicket }> {
  return callEdgeFunction('reopen-support-ticket', {
    method: 'POST',
    body: JSON.stringify({ ...scope, ticketId }),
  });
}

export async function uploadSupportTicketAttachment(
  scope: SupportTicketScopeParams,
  file: File
): Promise<SupportTicketAttachmentDraft> {
  const prepared = await prepareUpload(file, {
    imagePreset: 'CONTENT',
    surface: 'support-ticket-attachment',
  });
  if (prepared.error) throw new Error(prepared.error);

  const jwt = await getSessionJwt();
  const formData = new FormData();
  formData.append('file', prepared.file);
  if (scope.orgSlug) formData.append('orgSlug', scope.orgSlug);
  if (scope.orgId) formData.append('orgId', scope.orgId);
  if (scope.channel !== 'guest') {
    if (scope.propertyId) formData.append('propertyId', scope.propertyId);
    if (scope.parkingId) formData.append('parkingId', scope.parkingId);
  }

  const baseUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/upload-support-ticket-attachment`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: formData,
  });
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: { attachment: SupportTicketAttachmentDraft };
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Upload failed');
  }
  return json.data.attachment;
}
