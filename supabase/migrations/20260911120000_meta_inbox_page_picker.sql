-- Pending Facebook Page selection after Meta OAuth when user manages multiple Pages.

ALTER TABLE public.meta_inbox_oauth_state
  ADD COLUMN IF NOT EXISTS encrypted_user_token TEXT,
  ADD COLUMN IF NOT EXISTS pending_pages JSONB;

COMMENT ON COLUMN public.meta_inbox_oauth_state.encrypted_user_token IS
  'Long-lived Meta user token (encrypted) while awaiting Page picker completion.';

COMMENT ON COLUMN public.meta_inbox_oauth_state.pending_pages IS
  'Sanitized Page list [{ id, name, profileImageUrl, hasInstagram }] for picker UI — no tokens.';
