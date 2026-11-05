-- 50-cleanup-guest-auth.sql — drop legacy guest Google sign-ins (idempotent).
-- Plan: docs/workflow/planned/kamespace-02-legacy-prod-to-mt-prod-cutover.md §2 (auth).
-- Legacy never allowed guests to sign in with Google; the 5 guest auth accounts that
-- exist in legacy are throwaway sign-ins and must not be carried into mt-prod.
-- Keep only the two admin accounts: sprmke.dev@gmail.com and kamehome.azurenorth@gmail.com.
-- Bookings keep their guest_email; guest_user_id is nulled (FK is ON DELETE NO ACTION).
-- Run after the auth data restore, before shaping.

begin;

update public.guest_submissions
set guest_user_id = null
where guest_user_id is not null
  and guest_user_id in (
    select id from auth.users
    where lower(email) not in ('sprmke.dev@gmail.com', 'kamehome.azurenorth@gmail.com')
  );

delete from auth.users
where lower(email) not in ('sprmke.dev@gmail.com', 'kamehome.azurenorth@gmail.com');

commit;
