/**
 * Internal-user detection for analytics.
 *
 * The team uses the product every day. Without a flag, every dashboard insight is dominated
 * by the handful of accounts that never churn, never bounce and always finish onboarding, so
 * a funnel that says "100% activation" is measuring us.
 *
 * `is_internal` is set as a person property at identify time; the PostHog project filter
 * "exclude internal users" then does the rest. Detection is by email allow list
 * (`VITE_SUPER_ADMIN_EMAILS`, already present in the Vercel env) because that is the only
 * reliable sign of "this is an operator account" available to the browser.
 */

/** Parse a comma/space separated allow list into lowercase addresses. */
export function parseInternalEmails(raw: string | undefined): Set<string> {
  const out = new Set<string>();
  if (!raw) return out;
  for (const part of raw.split(/[,;\s]+/)) {
    const value = part.trim().toLowerCase();
    // Needs a local part and a domain: `@nope` would otherwise mark every user internal.
    if (/^[^@\s]+@[^@\s]+$/.test(value)) out.add(value);
  }
  return out;
}

/**
 * True when the signed-in user is one of us. An email missing from the session is treated as
 * external: marking a real guest as internal would remove them from every insight.
 */
export function isInternalUser(
  email: string | null | undefined,
  allowList = parseInternalEmails(import.meta.env.VITE_SUPER_ADMIN_EMAILS as string | undefined)
): boolean {
  if (!email) return false;
  return allowList.has(email.trim().toLowerCase());
}
