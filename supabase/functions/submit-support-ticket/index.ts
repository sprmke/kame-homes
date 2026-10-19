/**
 * submit-support-ticket — POST creates a support ticket + its first message.
 * Host: org/property/parking scoped. Guest explore: channel=guest, no org.
 */

import { createSupportTicket, SupportTicketCreateError } from '../_shared/supportTicketCreate.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { resolveSupportTicketScope } from '../_shared/supportTicketScope.ts';
import { validateSupportTicketAttachments } from '../_shared/supportTicketAttachments.ts';
import { antiSpamGate } from '../_shared/antiSpam.ts';

serveAuthenticated('submit-support-ticket', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  // Durable per-user rate limit + honeypot (no CAPTCHA — behind the auth wall).
  // Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md
  const antiSpamBlocked = await antiSpamGate(req, body, {
    scope: 'submit-support-ticket',
    user,
    captcha: false,
    rateLimit: { limit: 6, windowSec: 3600 },
  });
  if (antiSpamBlocked) return antiSpamBlocked;

  const scope = await resolveSupportTicketScope(req, {
    orgSlug: typeof body.orgSlug === 'string' ? body.orgSlug : null,
    orgId: typeof body.orgId === 'string' ? body.orgId : null,
    propertyId: typeof body.propertyId === 'string' ? body.propertyId : null,
    parkingId: typeof body.parkingId === 'string' ? body.parkingId : null,
  });

  const attachments = (() => {
    try {
      return validateSupportTicketAttachments(body.attachments, scope);
    } catch {
      return null;
    }
  })();
  if (attachments === null) return jsonError(req, 'Invalid attachment path', 400);

  try {
    const { ticket, message } = await createSupportTicket(scope, {
      category: typeof body.category === 'string' ? body.category : '',
      subject: typeof body.subject === 'string' ? body.subject : '',
      description: typeof body.description === 'string' ? body.description : '',
      severity: typeof body.severity === 'string' ? body.severity : undefined,
      pageUrl: typeof body.pageUrl === 'string' ? body.pageUrl : undefined,
      browserInfo: typeof body.browserInfo === 'string' ? body.browserInfo : undefined,
      expectedBenefit: typeof body.expectedBenefit === 'string' ? body.expectedBenefit : undefined,
      contactPreference:
        typeof body.contactPreference === 'string' ? body.contactPreference : undefined,
      attachments,
    });
    return jsonSuccess(req, { ticket, message });
  } catch (err) {
    if (err instanceof SupportTicketCreateError) {
      return jsonError(req, err.message, err.status);
    }
    throw err;
  }
});
