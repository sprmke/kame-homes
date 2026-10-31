-- Restore Pro-tier entitlements removed in 20261029120000 (middle-tier catalog).

UPDATE public.pricing_plans
SET features = features
  || '{
    "aiValidations": true,
    "aiMonthlyCreditAllowance": 1000,
    "recommendedBadgeEligible": true
  }'::jsonb
WHERE code = 'growth';
