export const superAdminPaths = {
  root: '/admin',
  aiUsage: '/admin/ai-usage',
  audit: '/admin/audit',
  platformSettings: '/admin/platform-settings',
  rateLimits: '/admin/rate-limits',
  organizations: '/admin/orgs',
  organizationHub: (orgSlug: string) => `/admin/orgs/${orgSlug}`,
  /** Anchor into a section of the single-page organization hub (see `AdminSectionNavLayout`). */
  organizationHubSection: (orgSlug: string, section: string) =>
    `/admin/orgs/${orgSlug}#section-${section}`,
  pricingPlans: '/admin/pricing/plans',
  pricingPaymentSettings: '/admin/pricing/payment-settings',
  propertySubscriptions: '/admin/pricing/subscriptions',
  parkingPayouts: '/admin/parking/payouts',
  developments: '/admin/developments',
  developmentDetail: (slug: string) => `/admin/developments/${slug}`,
  approvals: '/admin/approvals',
  support: '/admin/support',
  supportFaqs: '/admin/support/faqs',
  playbookArticles: '/admin/playbook',
  announcements: '/admin/announcements',
  hosts: '/admin/hosts',
  settings: '/admin/settings',
  properties: '/admin/properties',
  hostDetail: (hostId: string) => `/admin/hosts/${hostId}`,
} as const;

export function superAdminDevelopmentSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/admin\/developments\/([^/]+)/);
  return match?.[1] ?? null;
}

export function superAdminHostIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/admin\/hosts\/([^/]+)/);
  return match?.[1] ?? null;
}
