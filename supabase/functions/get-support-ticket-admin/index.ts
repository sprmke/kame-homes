/**
 * get-support-ticket-admin — GET a single ticket + thread (super admin, any org).
 * Docs: docs/workflow/in-progress/help-support-center.md, Module 3.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';

const BUCKET = 'support-ticket-attachments';
const SIGNED_URL_TTL_SEC = 60 * 30;

type StoredAttachment = { name: string; mimeType: string; size: number; path: string };

serveSuperAdmin('get-support-ticket-admin', async (req) => {
  requireHttpMethod(req, 'GET');
  const url = new URL(req.url);
  const ticketId = url.searchParams.get('ticket_id')?.trim();
  if (!ticketId) return jsonError(req, 'ticket_id is required');

  const sb = createServiceClient();

  const { data: row, error: ticketError } = await sb
    .from('support_tickets')
    .select('*, organizations(id, name, slug)')
    .eq('id', ticketId)
    .maybeSingle();

  if (ticketError) throw new Error(ticketError.message);
  if (!row) return jsonError(req, 'Ticket not found', 404);

  const { organizations, ...ticketRow } = row as typeof row & {
    organizations: { id: string; name: string; slug: string } | null;
  };
  const ticket = {
    ...ticketRow,
    organizationName: organizations?.name ?? 'Explore guest',
    organizationSlug: organizations?.slug ?? null,
  };

  const { data: messages, error: messagesError } = await sb
    .from('support_ticket_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (messagesError) throw new Error(messagesError.message);

  const signedMessages = await Promise.all(
    (messages ?? []).map(async (message) => {
      const attachments = (message.attachments as StoredAttachment[] | null) ?? [];
      if (attachments.length === 0) return message;

      const withUrls = await Promise.all(
        attachments.map(async (attachment) => {
          const { data: signed } = await sb.storage
            .from(BUCKET)
            .createSignedUrl(attachment.path, SIGNED_URL_TTL_SEC);
          return { ...attachment, url: signed?.signedUrl ?? null };
        })
      );
      return { ...message, attachments: withUrls };
    })
  );

  return jsonSuccess(req, { ticket, messages: signedMessages });
});
