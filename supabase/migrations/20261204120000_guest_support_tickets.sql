-- Guest explore-mode support tickets (nullable org, channel = guest).
-- Contact (/contact) + /account/tickets; host Help & Support stays org-scoped.

ALTER TABLE public.support_tickets
  ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'host';

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_channel_check;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_channel_check
  CHECK (channel IN ('host', 'guest'));

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_channel_org_check;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_channel_org_check
  CHECK (
    (channel = 'host' AND organization_id IS NOT NULL)
    OR (channel = 'guest' AND organization_id IS NULL AND property_id IS NULL AND parking_id IS NULL)
  );

UPDATE public.support_tickets
SET channel = 'guest'
WHERE organization_id IS NULL AND channel = 'host';

CREATE INDEX IF NOT EXISTS idx_support_tickets_submitter_created
  ON public.support_tickets (submitted_by_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_channel_created
  ON public.support_tickets (channel, created_at DESC);

COMMENT ON COLUMN public.support_tickets.channel IS
  'host = org/property/parking Help & Support; guest = explore Contact /account/tickets (organization_id null).';

COMMENT ON TABLE public.support_tickets IS
  'Support tickets from hosts (org-scoped) or explore guests (channel=guest, no org). category_fields holds per-category dynamic fields.';

ALTER TABLE public.support_ticket_messages
  DROP CONSTRAINT IF EXISTS support_ticket_messages_sender_type_check;

ALTER TABLE public.support_ticket_messages
  ADD CONSTRAINT support_ticket_messages_sender_type_check
  CHECK (sender_type IN ('host', 'guest', 'admin'));

COMMENT ON TABLE public.support_ticket_messages IS
  'Ticket reply thread. First row is the initial submission (sender_type host or guest). attachments: [{ name, mimeType, size, path }] in private support-ticket-attachments bucket.';
