/**
 * Per-surface staged rollout for image optimization (plan §12).
 *
 * The global kill switch (`VITE_DISABLE_IMAGE_OPTIMIZATION=1`) turns everything
 * into a pass-through. This module is the finer-grained control on top of it:
 * a surface only re-encodes once its §9.4 blind-A/B (and, for documents, §9.7
 * OCR) gate is green in production.
 *
 * `VITE_IMAGE_OPT_SURFACES` (build-time env):
 *   - unset          → every group optimizes EXCEPT `guest-documents`, which
 *                      stays off until the §9.7 OCR-regression gate is run (the
 *                      only surface whose re-encode could affect AI extraction).
 *                      Dev/staging default; also the safe production default.
 *   - `all`           → every surface optimizes, guest documents included.
 *   - `none`          → no surface optimizes (ceiling checks still run).
 *   - CSV list        → only the named rollout groups / surface ids optimize,
 *                      e.g. `settings,galleries` then widen per phase.
 *
 * A surface that is gated off still goes through `validateUploadFile` — only the
 * re-encode is skipped (preset is forced to `NONE`).
 */

export type RolloutGroup =
  | 'settings' // 1 — org/app/parking logos, template + verification/authorization proofs
  | 'galleries' // 2 — host property / parking / development media
  | 'marketing' // 3 — Marketing Studio exports (handled outside prepareUpload)
  | 'guest-profile' // 4 — guest profile photo + guest/host chat + support attachments
  | 'guest-documents'; // 5 — guest booking-form IDs/receipts + guest review media

/** Ordered lowest-blast-radius first (matches plan §12). */
export const ROLLOUT_GROUPS: RolloutGroup[] = [
  'settings',
  'galleries',
  'marketing',
  'guest-profile',
  'guest-documents',
];

/** Longest-prefix match wins; keep entries specific-first. */
const SURFACE_GROUP_PREFIXES: Array<[prefix: string, group: RolloutGroup]> = [
  ['org-settings', 'settings'],
  ['app-settings', 'settings'],
  ['parking-settings', 'settings'],
  ['property-template', 'settings'],
  ['org-verification', 'settings'],
  ['onboarding-verification', 'settings'],
  ['listing-authorization', 'settings'],
  ['listing-consideration', 'settings'],
  ['property-media', 'galleries'],
  ['parking-media', 'galleries'],
  ['development-media', 'galleries'],
  ['marketing', 'marketing'],
  ['guest-profile', 'guest-profile'],
  ['guest-chat', 'guest-profile'],
  ['support-ticket', 'guest-profile'],
  ['guest-form', 'guest-documents'],
  ['guest-review', 'guest-documents'],
  ['booking-asset', 'guest-documents'],
];

export function rolloutGroupForSurface(surface: string): RolloutGroup | null {
  const s = (surface || '').toLowerCase();
  let best: RolloutGroup | null = null;
  let bestLen = -1;
  for (const [prefix, group] of SURFACE_GROUP_PREFIXES) {
    if ((s === prefix || s.startsWith(`${prefix}-`)) && prefix.length > bestLen) {
      best = group;
      bestLen = prefix.length;
    }
  }
  return best;
}

type EnabledConfig = 'default' | 'all' | 'none' | Set<string>;

/** Groups held back under the `unset` default until their human gate runs. */
const DEFAULT_HELD_BACK: ReadonlySet<RolloutGroup> = new Set(['guest-documents']);

function parseSurfacesEnv(raw: string | undefined): EnabledConfig {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === '') return 'default';
  if (v === 'all') return 'all';
  if (v === 'none') return 'none';
  return new Set(
    v
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
  );
}

const ENABLED = parseSurfacesEnv(import.meta.env.VITE_IMAGE_OPT_SURFACES as string | undefined);

/**
 * `true` when re-encoding is allowed for this surface. Under the `unset` default
 * every group optimizes except `guest-documents` (OCR gate pending). With an
 * explicit CSV allow-list an unknown surface stays off.
 */
export function isSurfaceOptimizationEnabled(surface: string): boolean {
  if (ENABLED === 'all') return true;
  if (ENABLED === 'none') return false;
  const group = rolloutGroupForSurface(surface);
  if (ENABLED === 'default') return group ? !DEFAULT_HELD_BACK.has(group) : true;
  if (ENABLED.has(surface.toLowerCase())) return true;
  return group ? ENABLED.has(group) : false;
}
