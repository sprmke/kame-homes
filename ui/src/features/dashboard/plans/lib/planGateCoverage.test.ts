import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PLAN_FEATURES,
  type PlanFeatureKey,
} from '@/features/dashboard/plans/lib/planFeatures';

const ROOT = resolve(import.meta.dirname, '../../../../../..');
const UI_FEATURES = resolve(ROOT, 'ui/src/features');
const FUNCTIONS = resolve(ROOT, 'supabase/functions');

/**
 * Where each plan feature is actually enforced.
 * - `client`: files under ui/src/features that gate the UI (upgrade modal / TierBadge / RequireFeature).
 * - `server`: edge handler dirs or `_shared` files that enforce the plan on the server.
 * - `clientNa` / `serverNa`: why there is no gate on that side (must be a real reason).
 * - `gap`: advertised on Plans cards/Compare but NOT enforced anywhere. Pinned in KNOWN_GAPS.
 *
 * Adding a plan feature? Add it here or this test fails. Adding a gate to an existing key?
 * List it here or the reverse scan fails.
 */
type Coverage = {
  client?: string[];
  clientNa?: string;
  server?: string[];
  serverNa?: string;
  gap?: string;
};

const GATE_COVERAGE: Record<PlanFeatureKey, Coverage> = {
  automatedBookingFlow: {
    client: ['dashboard/bookings/components/workflow-panel/WorkflowPanel.tsx'],
    server: ['_shared/propertyAutomationToggles.ts', '_shared/workflowEmailManualSendCooldown.ts'],
  },
  verifiedBadgeEligible: {
    clientNa: 'Badge is shown from verification status; no action to gate.',
    serverNa: 'Not enforced anywhere on the server; see the gap note.',
    gap: 'Starter+ on the cards, but base verification submission (submit-org-verification) has no plan check. Free orgs can still be verified.',
  },
  recommendedBadgeEligible: {
    client: ['dashboard/org/components/verification/GetVerifiedModal.tsx'],
    server: ['submit-listing-recommended', 'submit-org-verification'],
  },
  telegramNotifications: {
    client: ['dashboard/bookings/pages/NotificationsPage.tsx'],
    server: ['_shared/telegramSettingsHttp.ts', '_shared/planEntitlements.ts'],
  },
  teamManagement: {
    client: ['dashboard/team/pages/PropertyTeamPage.tsx', 'dashboard/team/pages/OrgTeamPage.tsx'],
    server: ['_shared/planEntitlements.ts'],
  },
  searchVisibilityTier: {
    clientNa: 'Ranking signal, not an action.',
    serverNa: 'Not enforced anywhere on the server; see the gap note.',
    gap: 'Top 30 / Top 15 search placement is sold on the cards but no code ranks or filters by searchVisibilityTier.',
  },
  marketingPublishLimitPerGroup: {
    client: ['dashboard/marketing/components/publishing/PublishDialog.tsx'],
    server: ['publish-to-meta'],
  },
  aiValidations: {
    client: ['dashboard/bookings/components/booking-detail/panels/AiSummaryPanel.tsx'],
    server: ['booking-ai-review', 'validate-booking-receipts'],
  },
  aiMonthlyCreditAllowance: {
    client: ['dashboard/org/components/org-settings/OrgAiSettingsSection.tsx'],
    server: ['_shared/planEntitlements.ts'],
  },
  marketingStudio: {
    client: ['dashboard/marketing/components/design-editor/PolotnoDesignStudio.tsx'],
    server: ['marketing-music', 'marketing-templates', 'publish-to-meta', 'upload-marketing-asset'],
  },
  customPages: {
    clientNa: 'Gallery and editor are open on every plan.',
    serverNa: 'Open on every plan. Saving is publicPagesAutosave.',
  },
  propertyShowcase: {
    // Showcase editor stays explore-open; the per-booking stay guide link is Pro+. The public
    // stay guide read, email CTA and guest-portal link check `propertyHasStayGuideAccess`
    // in `_shared/guestStayGuide.ts`.
    client: [
      'dashboard/bookings/hooks/useBookingStayGuideLink.ts',
      'dashboard/bookings/components/workflow-panel/WorkflowPanel.tsx',
    ],
    server: [
      'public-page-configs',
      'get-public-showcase',
      'issue-guest-stay-guide-token',
    ],
  },
  aiDashboardAssistant: {
    client: ['dashboard/ai-assistant/hooks/useAiAssistantAccess.ts'],
    server: ['dashboard-assistant-chat', 'dashboard-assistant-confirm'],
  },
  aiReceptionist: {
    client: ['dashboard/org/components/org-settings/OrgVoiceReceptionistGroup.tsx'],
    server: ['voice-receptionist-settings', 'voice-receptionist-start'],
  },
  aiMarketingGeneration: {
    client: ['dashboard/marketing/components/shared/MarketingAiGeneratePanel.tsx'],
    server: ['generate-marketing-caption', 'generate-marketing-template'],
  },
  aiMarketingImageGeneration: {
    client: ['dashboard/marketing/components/shared/MarketingStudioModeTabs.tsx'],
    server: ['upload-marketing-generation-reference', 'generate-marketing-media'],
  },
  aiMarketingVideoGeneration: {
    client: ['dashboard/marketing/components/ai-studio/AiStudioSection.tsx'],
    server: ['generate-marketing-media'],
  },
  aiChatAutoReply: {
    client: ['dashboard/inbox/components/InboxAutomationTab.tsx'],
    server: ['social-inbox-settings'],
  },
  fullyManagedByPlatform: {
    clientNa: 'Marketing flag for the Managed tier; no product surface to gate.',
    serverNa: 'Marketing flag for the Managed tier; no product surface to gate.',
  },
  financeReporting: {
    client: ['dashboard/finance/components/FinanceExportMenu.tsx'],
    server: ['finance-export'],
  },
  maintenanceReporting: {
    client: ['dashboard/maintenance/components/MaintenanceExportMenu.tsx'],
    serverNa:
      'Export is built client-side from data already readable under maintenance:view (no export endpoint).',
  },
  metaChatChannel: {
    client: ['dashboard/inbox/components/InboxChannelsTab.tsx'],
    server: ['meta-inbox-oauth-start'],
  },
  quickReplies: {
    client: ['dashboard/inbox/components/InboxInsertMenu.tsx'],
    // Gate lives in the shared module used by social-inbox-templates and the assistant tool.
    server: ['_shared/inboxQuickReplyTemplates.ts'],
  },
  customTemplates: {
    client: ['dashboard/bookings/pages/TemplatesPage.tsx'],
    server: ['marketing-templates', 'property-templates-settings'],
  },
  publicPagesAutosave: {
    client: ['dashboard/page-editor/components/PageEditorHeader.tsx'],
    server: [
      'public-page-configs',
      'app-settings',
      'update-property',
      'property-templates-settings',
    ],
  },
  bookingImport: {
    client: ['dashboard/import/components/ImportWizardModal.tsx'],
    server: ['_shared/importAccess.ts'],
  },
  calendarSync: {
    client: ['dashboard/pricing/components/ChannelSyncDialog.tsx'],
    server: ['calendar-sync-settings', 'calendar-sync-cron'],
  },
  smartPricing: {
    client: ['dashboard/pricing/components/SmartPricingDialog.tsx'],
    server: ['smart-pricing-settings', 'smart-pricing-preview', 'smart-pricing-apply'],
  },
  customRoles: {
    client: ['dashboard/team/components/CustomRolesSection.tsx'],
    server: ['org-team-custom-roles', 'parking-team-custom-roles', 'property-team-custom-roles'],
  },
  copyPropertySettings: {
    client: ['dashboard/org/components/org-properties/CopyPropertySettingsDialog.tsx'],
    server: ['copy-property-settings'],
  },
  analyticsInsights: {
    client: ['dashboard/analytics/pages/PropertyAnalyticsPage.tsx'],
    server: ['analytics-ai-review', '_shared/analyticsService.ts'],
  },
  activityLogExport: {
    client: ['dashboard/activity/components/ActivityLogPanel.tsx'],
    server: ['activity-log-export'],
  },
};

/** Advertised but unenforced today. Fixing one means removing it here (the test then passes). */
const KNOWN_GAPS: PlanFeatureKey[] = ['verifiedBadgeEligible', 'searchVisibilityTier'];

const KEYS = Object.keys(DEFAULT_PLAN_FEATURES) as PlanFeatureKey[];

function walk(dir: string, accept: (file: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) walk(full, accept, out);
    else if (accept(full)) out.push(full);
  }
  return out;
}

function serverFile(entry: string): string {
  return entry.startsWith('_shared/')
    ? resolve(FUNCTIONS, entry)
    : resolve(FUNCTIONS, entry, 'index.ts');
}

function mentionsKey(source: string, key: string): boolean {
  return new RegExp(`['"]${key}['"]|\\.${key}\\b|\\b${key}\\b`).test(source);
}

/** A real server gate: the key is passed to a require...Feature or isFeatureEnabled call, not just named. */
function callsServerGate(source: string, key: string): boolean {
  const calls = source.matchAll(
    /\b(require\w*Feature|isFeatureEnabled|PlanFeatureRequiredError|entitlements\.\w+)\(?([^)]*)\)?/g
  );
  for (const call of calls) {
    if (new RegExp(`['"]${key}['"]`).test(call[2])) return true;
  }
  // The key chosen into a variable first (`const planFeature = isVideo ? 'a' : 'b'`), then gated.
  for (const assign of source.matchAll(/const (\w+)\s*=\s*([^;]*);/g)) {
    if (!new RegExp(`['"]${key}['"]`).test(assign[2])) continue;
    if (new RegExp(`require\\w*Feature\\([^)]*\\b${assign[1]}\\b`).test(source)) return true;
  }
  // Property reads such as `entitlements.smartPricing` or `features.smartPricing`.
  return new RegExp(`\\b(?:entitlements|features|planFeatures)\\??\\.${key}\\b`).test(source);
}

describe('every plan feature has a documented gate', () => {
  it('the map covers exactly the feature keys', () => {
    expect(Object.keys(GATE_COVERAGE).sort()).toEqual([...KEYS].sort());
  });

  it.each(KEYS)('%s declares client + server coverage or a reason', (key) => {
    const c = GATE_COVERAGE[key];
    expect(Boolean(c.client?.length) || Boolean(c.clientNa), `${key} client`).toBe(true);
    expect(Boolean(c.server?.length) || Boolean(c.serverNa), `${key} server`).toBe(true);
    for (const reason of [c.clientNa, c.serverNa, c.gap]) {
      if (reason) expect(reason.trim().length).toBeGreaterThan(10);
    }
  });

  it('unenforced (advertised) features are exactly the pinned gaps', () => {
    const gaps = KEYS.filter((key) => GATE_COVERAGE[key].gap);
    expect(gaps.sort()).toEqual([...KNOWN_GAPS].sort());
  });
});

describe('listed gates really reference the feature', () => {
  it.each(
    KEYS.flatMap((key) => (GATE_COVERAGE[key].client ?? []).map((file) => [key, file] as const))
  )('client %s in %s', (key, file) => {
    const path = resolve(UI_FEATURES, file);
    expect(existsSync(path), `${file} missing`).toBe(true);
    expect(mentionsKey(readFileSync(path, 'utf8'), key), `${file} does not mention ${key}`).toBe(
      true
    );
  });

  it.each(
    KEYS.flatMap((key) => (GATE_COVERAGE[key].server ?? []).map((entry) => [key, entry] as const))
  )('server %s in %s', (key, entry) => {
    const path = serverFile(entry);
    expect(existsSync(path), `${entry} missing`).toBe(true);
    expect(
      callsServerGate(readFileSync(path, 'utf8'), key),
      `${entry} must call a plan gate for ${key}, not just mention it`
    ).toBe(true);
  });
});

describe('no undocumented gates', () => {
  it('every server handler calling require*Feature is listed for that key', () => {
    const missing: string[] = [];
    for (const dir of readdirSync(FUNCTIONS, { withFileTypes: true })) {
      if (!dir.isDirectory() || dir.name === 'tests' || dir.name === '_shared') continue;
      const file = resolve(FUNCTIONS, dir.name, 'index.ts');
      if (!existsSync(file)) continue;
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\brequire\w*Feature\(([^)]*)\)/g)) {
        const key = [...match[1].matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]).at(-1);
        if (!key || !KEYS.includes(key as PlanFeatureKey)) continue;
        if (!GATE_COVERAGE[key as PlanFeatureKey].server?.includes(dir.name)) {
          missing.push(`${dir.name} gates ${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('every UI gate call names a key that declares client coverage', () => {
    const files = walk(
      UI_FEATURES,
      (f) => /\.tsx?$/.test(f) && !/(\.test|Test)\.tsx?$/.test(f)
    ).filter((f) => !f.includes('/dashboard/plans/lib/') && !f.includes('/super-admin/'));
    const pattern =
      /(?:useFeatureGate|openUpgradeModal)\(\s*'([A-Za-z]+)'|\bfeature="([A-Za-z]+)"|feature=\{'([A-Za-z]+)'\}/g;
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(pattern)) {
        const key = (match[1] ?? match[2] ?? match[3]) as PlanFeatureKey;
        if (!KEYS.includes(key)) continue;
        if (!GATE_COVERAGE[key].client?.length)
          offenders.push(`${file.replace(ROOT, '')} gates ${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
