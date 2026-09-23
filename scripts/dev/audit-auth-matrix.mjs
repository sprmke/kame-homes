#!/usr/bin/env node
/**
 * Auth matrix sweep — production-readiness doc 21 "Auth / Permissions", Phase 21.1.
 *
 * Static, regex/string-based audit over every `supabase/functions/<fn>/index.ts`
 * (skips `_shared/` and `tests/`). Classifies each function's three check types:
 *
 *   1. Authentication  — which serve* wrapper verifies identity (or none/raw).
 *   2. Resource scope  — does the handler call an org/property/parking/booking
 *                        ownership check before touching tenant data.
 *   3. Permission leaf — does the handler call a permission-expansion / leaf
 *                        check (e.g. hasPermission, requirePermission) beyond
 *                        plain resource-scope resolution.
 *
 * Like scripts/dev/audit-edge-functions.mjs (doc 18), this is a heuristic
 * triage list, not ground truth for any single function — a function with
 * zero scope-check hits still needs a human read before being called clean,
 * especially ones that only read/write org-independent or already-scoped-by-ID
 * rows. Use --gaps-only to focus review time.
 *
 * Usage:
 *   node scripts/dev/audit-auth-matrix.mjs                # markdown table
 *   node scripts/dev/audit-auth-matrix.mjs --csv           # CSV
 *   node scripts/dev/audit-auth-matrix.mjs --gaps-only     # only rows with >=1 gap
 *   node scripts/dev/audit-auth-matrix.mjs --check         # CI: fail on new unscoped tenant-tier fn
 *   node scripts/dev/audit-auth-matrix.mjs --summary       # counts only
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const FUNCTIONS_DIR = join(REPO_ROOT, 'supabase', 'functions');

const args = process.argv.slice(2);
const format = args.includes('--csv') ? 'csv' : 'markdown';
const gapsOnly = args.includes('--gaps-only');
const checkMode = args.includes('--check');
const summaryMode = args.includes('--summary');

const WRAPPER_TIER = {
  serveAdmin: 'legacy-admin',
  serveSuperAdmin: 'super-admin',
  serveAuthenticated: 'org (authenticated user)',
  servePublic: 'guest-anon',
  serveCronPost: 'cron (secret-gated)',
};

const WRAPPER_PATTERNS = [
  ['serveAdmin', /\bserveAdmin\s*\(/],
  ['serveSuperAdmin', /\bserveSuperAdmin\s*\(/],
  ['serveAuthenticated', /\bserveAuthenticated\s*\(/],
  ['servePublic', /\bservePublic\s*\(/],
  ['serveCronPost', /\bserveCronPost\s*\(/],
];

const RAW_SERVE_PATTERNS = [/\bDeno\.serve\s*\(/, /(?<!\w)serve\s*\(\s*async/, /\bserve\s*\(\s*\(/];

/** Resource-scope check call sites (check type 2 — ownership/IDOR). */
const SCOPE_PATTERNS = [
  /\bverifyOrgAccess\s*\(/,
  /\bverifyOrgOwner\s*\(/,
  /\bverifyOrgOwnerBySlug\s*\(/,
  /\bverifyOrgListAccess\s*\(/,
  /\bverifyOrgTeamAccess\s*\(/,
  /\bverifyPropertyAccess\s*\(/,
  /\bverifyPropertyOwner\s*\(/,
  /\bverifyParkingTeamAccess\s*\(/,
  /\bresolveScopedParkingAccess\s*\(/,
  /\bresolveScopedPropertyAccess\s*\(/,
  /\bresolvePropertyAccessContext\s*\(/,
  /\bresolveOrgAccessContext\s*\(/,
  /\bresolveAdminOrgId\s*\(/,
  /\bresolveAdminPropertyId\s*\(/,
  /\bresolveAdminParkingId\s*\(/,
  /\bassertBookingBelongsToProperty\s*\(/,
  /\bverifyBookingBelongsToProperty\s*\(/,
  /\bverifyBookingBelongsToParking\s*\(/,
  /\bresolveOrganizationIdForProperty\s*\(/,
  /\bresolveOrganizationIdForParking\s*\(/,
  /\bresolvePublicPropertyId\s*\(/,
  /\bresolveParkingTeamAccessContext\s*\(/,
  /\blistPropertyIdsForOrganization\s*\(/,
  /\blistParkingIdsForOrganization\s*\(/,
  /\bverifySuperAdminJwt\s*\(/,
  /\bguestBookingAccessToken\b/,
  /\bverifyGuestBookingAccessToken\s*\(/,
  /\bverifyGuestSession\s*\(/,
  // Indirection layer: service-level require*/resolve* helpers that call the
  // primitives above internally (discovered via a full-repo scan of every
  // `export async function require*`/`resolve*Context`/`resolve*Access` in
  // `_shared/`; grepping only the primitives misses these wrapper layers).
  /\brequireOrgTeamContext\s*\(/,
  /\brequireTeamParkingAccess\s*\(/,
  /\brequireTeamPropertyAccess\s*\(/,
  /\bresolveFinanceAssetAccess\s*\(/,
  /\bresolveImportAccess\s*\(/,
  /\bresolveImportAccessWithPlan\s*\(/,
  /\brequirePropertyPermissionAndFeature\s*\(/,
  /\bresolveInboxAccess\s*\(/,
  /\bresolveNotificationsAccess\s*\(/,
  /\brequireSettingsVerificationToken\s*\(/,
  /\brequireSuperAdminStepUp\s*\(/,
  /\bresolveTelegramAssetAccess\s*\(/,
  /\brequirePropertyFeature\s*\(/,
  /\brequireOrgFeature\s*\(/,
  /\brequireOrgPropertyFeature\s*\(/,
  /\bresolveSupportTicketScope\s*\(/,
  // Own-record access: the wrapper-verified `user` is passed straight into a
  // named service function that scopes internally by user.id — legitimate
  // when the resource IS the caller's own data (guest profile/trips/messages,
  // vouchers, push subscriptions, voice sessions). Named explicitly (not a
  // generic `fn(user)` regex — that would match nearly anything and defeat
  // the heuristic's purpose).
  /\blistGuestTrips\s*\(\s*user\s*\)/,
  /\bgetGuestProfile\s*\(\s*user\s*\)/,
  /\bpatchGuestProfile\s*\(\s*user\s*,/,
  /\blistGuestMessageThreads\s*\(\s*user\b/,
  /\blistGuestVouchers\s*\(\s*user\b/,
  /\bloadVoiceReceptionistSessionForGuest\s*\(\s*\w+\s*,\s*user\.id\s*\)/,
  /\bloadVoiceReceptionistSessionForEnd\s*\(\s*\w+\s*,\s*user\.id\s*\)/,
  /\bstartGuestWebChat\s*\(\s*user\b/,
  /\bresumeGuestWebChat\s*\(\s*user\b/,
  /\bsendGuestWebChatMessage\s*\(\s*user\b/,
  /\bverifyListingReviewerOrOwner\s*\(/,
  /\bverifyListingOwner\s*\(/,
  /\bassertGuestOwnsWebConversation\s*\(/,
  /\bmarkGuestWebConversationRead\s*\(\s*user\.id\b/,
  /\blistGuestWebMessages\s*\(\s*user\.id\b/,
  /\bsendGuestWebMessage\s*\(\s*user\.id\b/,
  /\bunsendGuestWebMessage\s*\(\s*user\.id\b/,
  /\beditGuestWebMessage\s*\(\s*user\.id\b/,
  /\blistLinkableParkingBookingsForGuest\s*\(\s*user\.id\b/,
  // Ownership-by-caller-identity convention: `resourceId, user.id[, user.email]`
  // passed into a service function that verifies the caller owns the resource
  // before acting. Common in the guest-parking self-service surface. This is a
  // real check (verified by reading cancelParkingBooking/createParkingPaymentTransaction/
  // requestParkingEndorsementResend/verifyLinkablePropertyBooking — each takes the id first
  // then rejects on mismatch) but the static sweep cannot verify every callee's body, so this
  // pattern is intentionally narrow: it only matches the specific known call sites below.
  /\bcancelParkingBooking\s*\(\s*\w+\s*,\s*user\.id\s*,\s*user\.email\s*\)/,
  /\bcreateParkingPaymentTransaction\s*\(\s*\w+\s*,\s*user\.id\s*,\s*user\.email\s*\)/,
  /\brequestParkingEndorsementResend\s*\(\s*\w+\s*,\s*user\.id\s*,\s*user\.email\s*\)/,
  /\bverifyLinkablePropertyBooking\s*\(/,
  /\bassertParkingSubmitAllowed\s*\(/,
];

/**
 * Functions where "no resource-scope check" is correct by design: creating a
 * brand-new resource (nothing pre-existing to own-check), or a global
 * availability/uniqueness probe that intentionally has no tenant scope.
 * Each entry needs its handler read once to confirm, then stays allowlisted —
 * same shape as doc 18's RAW_SERVE_ALLOWLIST.
 */
const NO_SCOPE_NEEDED_ALLOWLIST = new Set([
  'accept-org-invite', // scoped by single-use token bound to invitee email, not a pre-owned resource
  'create-organization', // caller becomes owner of a brand-new org — nothing to own-check yet
  'check-organization-name', // global uniqueness probe, no tenant data returned
  'check-property-name', // global uniqueness probe, no tenant data returned
  'check-tower-unit', // global uniqueness probe, no tenant data returned
  'push-subscribe', // registers a new subscription keyed to the caller's own device/endpoint
  'push-unsubscribe', // removes by endpoint the caller supplies; no cross-tenant read
  'list-help-center-articles', // dashboard-wide knowledge base content, not tenant-scoped
  'list-help-center-faqs', // dashboard-wide knowledge base content, not tenant-scoped
]);

/**
 * Functions whose real scope check lives one import-hop below the handler
 * (inside a `_shared/*.ts` helper the handler calls), so a single-file regex
 * sweep of the handler cannot see it. Verified by hand by reading the callee.
 * Treated as having a scope check; re-verify if the callee changes.
 */
const SCOPE_VIA_CALLEE_ALLOWLIST = new Set([
  'upload-listing-authorization-asset', // applyListingAuthorizationAssetFromBytes() -> verifyListingOwner()
]);

/** Permission-leaf check call sites (check type 3 — action within a resource). */
const PERMISSION_LEAF_PATTERNS = [
  /\bhasPermission\s*\(/,
  /\brequirePermission\s*\(/,
  /\bexpandPermissions\s*\(/,
  /\baccessPermissionExpansion\b/,
  /\bbookingsPermissionExpansion\b/,
  /\blegacyPermissionExpansion\b/,
  /\bopsPermissionExpansion\b/,
  /\borgLegacyPermissionExpansion\b/,
  /\bsettingsPermissionExpansion\b/,
  /\bsettingsPatchPermissions\b/,
  /\btelegramModulePermissions\b/,
  /\borgTeamPermissions\b/,
  /\bpropertyTeamPermissions\b/,
  /\bparkingTeamPermissions\b/,
  /\.permissions\?\./,
  /\bcanAccess[A-Z]\w*\s*\(/,
];

const CRON_SECRET_PATTERNS = [/\bcronSecretGate\b/, /verifySecret/];

const SERVICE_ROLE_IN_HANDLER = /\bcreateServiceClient\s*\(/;

function walkFunctionDirs() {
  const entries = readdirSync(FUNCTIONS_DIR, { withFileTypes: true });
  const dirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '_shared' || entry.name === 'tests') continue;
    if (entry.name.startsWith('.')) continue;
    dirs.push(entry.name);
  }
  return dirs.sort();
}

function findIndexFile(fnDir) {
  const direct = join(FUNCTIONS_DIR, fnDir, 'index.ts');
  try {
    statSync(direct);
    return direct;
  } catch {
    return null;
  }
}

function detectWrapper(src) {
  for (const [name, pattern] of WRAPPER_PATTERNS) {
    if (pattern.test(src)) return name;
  }
  return null;
}

function detectRawServe(src) {
  return RAW_SERVE_PATTERNS.some((p) => p.test(src));
}

function detectAny(src, patterns) {
  return patterns.some((p) => p.test(src));
}

/**
 * Public-anon functions and pure cron/webhook functions are exempt from the
 * "must have a resource-scope check" rule by design — they either have no
 * tenant resource to scope to, or scope by an unguessable capability token
 * (audited separately, doc 21 Phase 21.3) or webhook signature.
 */
function scopeCheckApplies(fnDir, wrapper, src) {
  if (wrapper === 'serveCronPost') return false;
  if (NO_SCOPE_NEEDED_ALLOWLIST.has(fnDir)) return false;
  if (wrapper === 'servePublic') {
    // A public function IS still expected to scope if it reads/writes a
    // specific tenant resource by ID (e.g. get-public-property?property=slug).
    // Heuristic: only flag if it touches booking/property/parking/org tables
    // AND does not resolve a public-scoped ID via the known helpers.
    const touchesTenantTable =
      /\.from\(['"](bookings|properties|parkings|organizations|guest_submissions)['"]\)/.test(src);
    return touchesTenantTable;
  }
  return true;
}

function auditFunction(fnDir) {
  const filePath = findIndexFile(fnDir);
  if (!filePath) return { fn: fnDir, missingIndex: true };

  const src = readFileSync(filePath, 'utf8');
  const relPath = relative(REPO_ROOT, filePath);

  const wrapper = detectWrapper(src);
  const rawServe = !wrapper && detectRawServe(src);
  const declaredTier = wrapper ? WRAPPER_TIER[wrapper] : rawServe ? 'UNKNOWN (raw serve)' : 'UNKNOWN (no serve detected)';

  const hasScopeCheck = detectAny(src, SCOPE_PATTERNS) || SCOPE_VIA_CALLEE_ALLOWLIST.has(fnDir);
  const hasPermissionLeaf = detectAny(src, PERMISSION_LEAF_PATTERNS);
  const hasCronSecret = detectAny(src, CRON_SECRET_PATTERNS);
  const usesServiceClientDirectly = SERVICE_ROLE_IN_HANDLER.test(src);

  const scopeExpected = scopeCheckApplies(fnDir, wrapper, src);

  const gaps = [];
  if (!wrapper && !rawServe) gaps.push('no-serve-detected');
  if (rawServe) gaps.push('raw-serve-not-audited-by-doc18-allowlist-here');
  if (scopeExpected && !hasScopeCheck) gaps.push('MISSING-resource-scope-check');
  if (
    scopeExpected &&
    (wrapper === 'serveAdmin' || wrapper === 'serveAuthenticated') &&
    !hasPermissionLeaf &&
    !hasScopeCheck
  ) {
    gaps.push('MISSING-any-authz-beyond-identity');
  }

  return {
    fn: fnDir,
    relPath,
    wrapper: wrapper ?? (rawServe ? 'RAW serve()' : 'none-detected'),
    declaredTier,
    hasScopeCheck,
    hasPermissionLeaf,
    hasCronSecret,
    usesServiceClientDirectly,
    gaps,
  };
}

function main() {
  const fnDirs = walkFunctionDirs();
  const results = fnDirs.map(auditFunction);
  const valid = results.filter((r) => !r.missingIndex);

  const missingScope = valid.filter((r) => r.gaps.includes('MISSING-resource-scope-check'));
  const missingAnyAuthz = valid.filter((r) => r.gaps.includes('MISSING-any-authz-beyond-identity'));
  const noServe = valid.filter((r) => r.gaps.includes('no-serve-detected'));

  if (checkMode) {
    if (noServe.length || missingAnyAuthz.length) {
      if (noServe.length) {
        console.error('Functions with no serve*/Deno.serve detected (doc 21):');
        for (const r of noServe) console.error(`  ${r.fn}`);
      }
      if (missingAnyAuthz.length) {
        console.error(
          'Functions on an identity-requiring wrapper with zero resource-scope AND zero permission-leaf call (doc 21) — review each by hand, this is a heuristic trigger, not proof of a vulnerability:'
        );
        for (const r of missingAnyAuthz) console.error(`  ${r.fn}`);
      }
      process.exit(1);
    }
    console.error(`ok: ${valid.length} functions; 0 with zero authz signal beyond identity`);
    return;
  }

  if (summaryMode) {
    const tierCounts = {};
    for (const r of valid) tierCounts[r.declaredTier] = (tierCounts[r.declaredTier] ?? 0) + 1;
    console.log('Auth matrix summary (doc 21, heuristic static sweep)');
    console.log('Total functions:', valid.length);
    console.log('By declared tier:', JSON.stringify(tierCounts, null, 2));
    console.log('Missing resource-scope check (heuristic):', missingScope.length);
    console.log('Missing any authz signal beyond identity (heuristic):', missingAnyAuthz.length);
    console.log('No serve wrapper detected:', noServe.length);
    return;
  }

  const rows = gapsOnly ? valid.filter((r) => r.gaps.length > 0) : valid;

  if (format === 'csv') {
    const header = [
      'function',
      'path',
      'wrapper',
      'declared_tier',
      'has_resource_scope_check',
      'has_permission_leaf_check',
      'uses_service_client_directly',
      'gaps',
    ];
    console.log(header.join(','));
    for (const r of rows) {
      console.log(
        [
          r.fn,
          r.relPath,
          r.wrapper,
          `"${r.declaredTier}"`,
          r.hasScopeCheck ? 'yes' : 'no',
          r.hasPermissionLeaf ? 'yes' : 'no',
          r.usesServiceClientDirectly ? 'yes' : 'no',
          `"${r.gaps.join('; ')}"`,
        ].join(',')
      );
    }
  } else {
    console.log('| Function | Wrapper | Declared tier | Scope check | Permission leaf | Gaps |');
    console.log('| --- | --- | --- | --- | --- | --- |');
    for (const r of rows) {
      console.log(
        `| ${r.fn} | ${r.wrapper} | ${r.declaredTier} | ${r.hasScopeCheck ? 'yes' : 'no'} | ${r.hasPermissionLeaf ? 'yes' : 'no'} | ${r.gaps.join('; ') || '—'} |`
      );
    }
  }
}

main();
