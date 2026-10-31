/**
 * Shared support ticket creation — used by submit-support-ticket and the AI assistant.
 */

import { loadAuthUserProfile } from './authUserProfile.ts';
import { createServiceClient } from './orgAuth.ts';
import { sendSupportTicketNotify } from './emailService.ts';
import {
  type IncomingSupportTicketAttachment,
  validateSupportTicketAttachments,
} from './supportTicketAttachments.ts';
import type { SupportTicketScope } from './supportTicketScope.ts';

const CATEGORIES = ['bug_report', 'feature_suggestion', 'general_inquiry', 'business_inquiry'];
const SEVERITIES = ['low', 'medium', 'high'];

export type CreateSupportTicketInput = {
  category: string;
  subject: string;
  description: string;
  severity?: string;
  pageUrl?: string;
  browserInfo?: string;
  expectedBenefit?: string;
  contactPreference?: string;
  attachments?: IncomingSupportTicketAttachment[];
};

export class SupportTicketCreateError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function createSupportTicket(
  scope: SupportTicketScope,
  input: CreateSupportTicketInput
): Promise<{ ticket: Record<string, unknown>; message: Record<string, unknown> }> {
  const category = input.category.trim();
  if (!CATEGORIES.includes(category)) {
    throw new SupportTicketCreateError(
      'category must be one of bug_report, feature_suggestion, general_inquiry, business_inquiry'
    );
  }

  const subject = input.subject.trim();
  if (!subject) throw new SupportTicketCreateError('subject is required');
  if (subject.length > 200) {
    throw new SupportTicketCreateError('subject must be 200 characters or fewer');
  }

  const description = input.description.trim();
  if (!description) throw new SupportTicketCreateError('description is required');
  if (description.length > 5000) {
    throw new SupportTicketCreateError('description must be 5000 characters or fewer');
  }

  const categoryFields: Record<string, unknown> = {};
  if (category === 'bug_report') {
    const severity = input.severity?.trim() || 'medium';
    if (!SEVERITIES.includes(severity)) {
      throw new SupportTicketCreateError('severity must be low, medium, or high');
    }
    categoryFields.severity = severity;
    if (input.pageUrl?.trim()) {
      categoryFields.page_url = input.pageUrl.trim().slice(0, 500);
    }
    if (input.browserInfo?.trim()) {
      categoryFields.browser_info = input.browserInfo.trim().slice(0, 500);
    }
  } else if (category === 'feature_suggestion') {
    if (input.expectedBenefit?.trim()) {
      categoryFields.expected_benefit = input.expectedBenefit.trim().slice(0, 1000);
    }
  } else if (category === 'business_inquiry') {
    const contactPreference = input.contactPreference?.trim() ?? '';
    if (!contactPreference) {
      throw new SupportTicketCreateError('contactPreference is required');
    }
    if (contactPreference.length > 200) {
      throw new SupportTicketCreateError('contactPreference must be 200 characters or fewer');
    }
    categoryFields.contact_preference = contactPreference;
  }

  let attachments: IncomingSupportTicketAttachment[] = [];
  if (input.attachments && input.attachments.length > 0) {
    try {
      attachments = validateSupportTicketAttachments(input.attachments, scope);
    } catch {
      throw new SupportTicketCreateError('Invalid attachment path');
    }
  }

  const sb = createServiceClient();
  const profile = await loadAuthUserProfile(sb, scope.user.id);
  const senderType = scope.channel === 'guest' ? 'guest' : 'host';

  const { data: ticket, error: ticketError } = await sb
    .from('support_tickets')
    .insert({
      channel: scope.channel,
      organization_id: scope.org?.id ?? null,
      property_id: scope.propertyId,
      parking_id: scope.parkingId,
      submitted_by_user_id: scope.user.id,
      submitted_by_name: profile.name,
      submitted_by_email: profile.email || scope.user.email,
      category,
      subject,
      category_fields: categoryFields,
    })
    .select('*')
    .single();

  if (ticketError || !ticket) {
    throw new SupportTicketCreateError(
      `Failed to create ticket: ${ticketError?.message ?? 'unknown error'}`,
      500
    );
  }

  const { data: message, error: messageError } = await sb
    .from('support_ticket_messages')
    .insert({
      ticket_id: ticket.id,
      sender_type: senderType,
      sender_user_id: scope.user.id,
      sender_name: profile.name,
      body: description,
      attachments,
    })
    .select('*')
    .single();

  if (messageError || !message) {
    await sb.from('support_tickets').delete().eq('id', ticket.id);
    throw new SupportTicketCreateError(
      `Failed to save ticket message: ${messageError?.message ?? 'unknown error'}`,
      500
    );
  }

  try {
    await sendSupportTicketNotify({
      organizationName: scope.org?.name ?? 'Explore guest',
      propertyName: scope.propertyName,
      parkingName: scope.parkingName,
      category,
      subject,
      submittedByName: profile.name,
      submittedByEmail: profile.email || scope.user.email,
      bodyPreview: description,
    });
  } catch (notifyErr) {
    console.error('[supportTicketCreate] notify email failed (non-fatal):', notifyErr);
  }

  return { ticket, message };
}
