-- Free tier: allow the existing single member (the owner) but block any further invites,
-- instead of disabling team management outright. This reuses the same maxMembers gating path
-- Starter/Pro/etc. already use (canInviteTeamMember in planFeatures.ts), rather than a separate
-- "not available on this plan" behavior — the owner already counts as 1 slot in
-- countPropertyTeamSlotsUsed, so this correctly blocks a second invite via the existing
-- at-limit path (same code, no UI change needed).
UPDATE public.pricing_plans
SET features = jsonb_set(features, '{teamManagement}', '{"enabled": true, "maxMembers": 1}'::jsonb)
WHERE code = 'free';
