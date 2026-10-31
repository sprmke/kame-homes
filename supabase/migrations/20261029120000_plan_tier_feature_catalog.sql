-- Refresh host plan catalog: swap Pro/Business display names, align entitlements.

UPDATE public.pricing_plans
SET name = 'Pro'
WHERE code = 'growth';

UPDATE public.pricing_plans
SET name = 'Business'
WHERE code = 'pro';

-- Starter — automated docs, public listing, templates, 3 seats
UPDATE public.pricing_plans
SET features = '{
  "automatedBookingFlow": true,
  "verifiedBadgeEligible": true,
  "recommendedBadgeEligible": false,
  "telegramNotifications": true,
  "teamManagement": { "enabled": true, "maxMembers": 3 },
  "searchVisibilityTier": "none",
  "marketingPublishLimitPerGroup": 0,
  "aiValidations": false,
  "aiMonthlyCreditAllowance": 0,
  "marketingStudio": true,
  "customPages": true,
  "aiDashboardAssistant": false,
  "aiReceptionist": false,
  "aiMarketingGeneration": false,
  "aiChatAutoReply": false,
  "fullyManagedByPlatform": false
}'::jsonb
WHERE code = 'starter';

-- Pro (internal code `growth`) — 5 seats, 30 publishes, top-30 search
UPDATE public.pricing_plans
SET features = '{
  "automatedBookingFlow": true,
  "verifiedBadgeEligible": true,
  "recommendedBadgeEligible": false,
  "telegramNotifications": true,
  "teamManagement": { "enabled": true, "maxMembers": 5 },
  "searchVisibilityTier": "top30",
  "marketingPublishLimitPerGroup": 30,
  "aiValidations": false,
  "aiMonthlyCreditAllowance": 0,
  "marketingStudio": true,
  "customPages": true,
  "aiDashboardAssistant": false,
  "aiReceptionist": false,
  "aiMarketingGeneration": false,
  "aiChatAutoReply": false,
  "fullyManagedByPlatform": false
}'::jsonb
WHERE code = 'growth';

-- Business (internal code `pro`) — 10 seats, unlimited publishing, top-15 search, AI suite
UPDATE public.pricing_plans
SET features = '{
  "automatedBookingFlow": true,
  "verifiedBadgeEligible": true,
  "recommendedBadgeEligible": true,
  "telegramNotifications": true,
  "teamManagement": { "enabled": true, "maxMembers": 10 },
  "searchVisibilityTier": "top15",
  "marketingPublishLimitPerGroup": null,
  "aiValidations": true,
  "aiMonthlyCreditAllowance": 10000,
  "marketingStudio": true,
  "customPages": true,
  "aiDashboardAssistant": true,
  "aiReceptionist": true,
  "aiMarketingGeneration": true,
  "aiChatAutoReply": true,
  "fullyManagedByPlatform": false
}'::jsonb
WHERE code = 'pro';

-- Managed — Business capabilities + 30k AI credits + fully managed
UPDATE public.pricing_plans
SET features = '{
  "automatedBookingFlow": true,
  "verifiedBadgeEligible": true,
  "recommendedBadgeEligible": true,
  "telegramNotifications": true,
  "teamManagement": { "enabled": true, "maxMembers": null },
  "searchVisibilityTier": "top15",
  "marketingPublishLimitPerGroup": null,
  "aiValidations": true,
  "aiMonthlyCreditAllowance": 30000,
  "marketingStudio": true,
  "customPages": true,
  "aiDashboardAssistant": true,
  "aiReceptionist": true,
  "aiMarketingGeneration": true,
  "aiChatAutoReply": true,
  "fullyManagedByPlatform": true
}'::jsonb
WHERE code = 'managed';

-- Legacy search tier values → new catalog
UPDATE public.pricing_plans
SET features = jsonb_set(features, '{searchVisibilityTier}', '"top30"'::jsonb, true)
WHERE features->>'searchVisibilityTier' = 'top20';

UPDATE public.pricing_plans
SET features = jsonb_set(features, '{searchVisibilityTier}', '"top15"'::jsonb, true)
WHERE features->>'searchVisibilityTier' = 'top10';
