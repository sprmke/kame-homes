import { Mic } from 'lucide-react';

import type { VoiceReceptionistFormValues } from '@/features/dashboard/bookings/hooks/useVoiceReceptionistSettings';
import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { PropertyVoiceReceptionistFields } from '@/features/dashboard/org/components/property-settings/PropertyVoiceReceptionistFields';

type Props = {
  draft: VoiceReceptionistFormValues | null;
  propertyName?: string;
  availableVoices: readonly string[];
  disabled?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string | null;
  onChange: <K extends keyof VoiceReceptionistFormValues>(
    key: K,
    value: VoiceReceptionistFormValues[K]
  ) => void;
};

/** Standalone voice section — prefer nesting via PropertyAiSettingsSection. */
export function PropertyVoiceReceptionistSection(props: Props) {
  return (
    <AdminSection
      id="voice-receptionist"
      title="Voice Receptionist"
      icon={Mic}
      description="AI assistant for check-in and stay questions."
    >
      <PropertyVoiceReceptionistFields {...props} />
    </AdminSection>
  );
}
