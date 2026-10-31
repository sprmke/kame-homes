-- Marks a property_members row as auto-deactivated by team-seat reconciliation (plan downgrade,
-- subscription suspension, or an invite accepted while already at the plan's seat cap) rather
-- than a deliberate admin deactivation. Lets an upgrade auto-restore exactly the members the
-- plan took away, without resurrecting someone an admin manually deactivated for a real reason.
-- See reconcilePropertyTeamSeats in supabase/functions/_shared/planEntitlements.ts.
ALTER TABLE public.property_members
  ADD COLUMN IF NOT EXISTS plan_limited BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.property_members.plan_limited IS
  'True when status=inactive was set automatically because the property''s current plan does not cover this seat, not by an admin''s manual deactivation. Cleared on any manual status change.';
