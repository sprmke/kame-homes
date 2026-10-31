import { HostWorkspaceSidePanel } from '@/features/guest/marketing/shared/components/HostWorkspaceSidePanel';

interface OnboardingFeatureShowcaseProps {
  className?: string;
}

export function OnboardingFeatureShowcase({ className }: OnboardingFeatureShowcaseProps) {
  return <HostWorkspaceSidePanel variant="onboarding" className={className} />;
}
