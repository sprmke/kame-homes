import * as React from 'react';

import { Loader2, Volume2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  usePreviewVoiceReceptionistVoice,
  useVoiceReceptionistUsage,
  type VoiceReceptionistFormValues,
} from '@/features/dashboard/bookings/hooks/useVoiceReceptionistSettings';
import {
  AiSettingsToggleRow,
  AiSettingsUsageStat,
} from '@/features/dashboard/org/components/settings/AiSettingsChrome';
import { SettingsField } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import { AI_SETTINGS_VOICE_TOGGLE_LABEL } from '@/features/dashboard/org/lib/aiSettingsLabels';
import {
  geminiLiveVoiceLabel,
  playVoicePreviewAudio,
} from '@/features/dashboard/org/lib/voiceReceptionistVoicePreview';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

function VoiceReceptionistSectionSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="bg-muted h-11 animate-pulse rounded-lg" />
      <div className="bg-muted h-10 animate-pulse rounded-lg" />
      <div className="bg-muted h-24 animate-pulse rounded-lg" />
    </div>
  );
}

function formatDurationShort(seconds: number): string {
  if (seconds <= 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function VoiceReceptionistUsagePanel() {
  const { data, isLoading, isError } = useVoiceReceptionistUsage();

  if (isError) return null;
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-muted h-14 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs font-medium">Usage — last 30 days</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <AiSettingsUsageStat label="Today" value={String(data.sessionsToday)} />
        <AiSettingsUsageStat label="Last 30 days" value={String(data.sessionsLast30Days)} />
        <AiSettingsUsageStat
          label="Avg. length"
          value={formatDurationShort(data.avgDurationSeconds)}
        />
        <AiSettingsUsageStat
          label="Est. cost"
          value={`$${data.estimatedCostUsdLast30Days.toFixed(2)}`}
        />
        <AiSettingsUsageStat label="Failed" value={`${data.failureRate.toFixed(1)}%`} />
        <AiSettingsUsageStat label="Handoff" value={`${data.handoffRate.toFixed(1)}%`} />
      </div>
    </div>
  );
}

export type PropertyVoiceReceptionistFieldsProps = {
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

export function PropertyVoiceReceptionistFields({
  draft,
  propertyName,
  availableVoices,
  disabled = false,
  isLoading = false,
  isError = false,
  errorMessage = null,
  onChange,
}: PropertyVoiceReceptionistFieldsProps) {
  const previewVoice = usePreviewVoiceReceptionistVoice();
  const stopPreviewRef = React.useRef<(() => void) | null>(null);
  const previewBusy = previewVoice.isPending;

  React.useEffect(() => {
    return () => {
      stopPreviewRef.current?.();
      stopPreviewRef.current = null;
    };
  }, []);

  const handleTestVoice = () => {
    if (!draft?.voiceId) return;
    stopPreviewRef.current?.();
    stopPreviewRef.current = null;
    previewVoice.mutate(
      {
        voiceId: draft.voiceId,
        propertyName,
      },
      {
        onSuccess: (preview) => {
          stopPreviewRef.current = playVoicePreviewAudio(preview);
        },
        onError: (err: unknown) => toast.error(friendlyToastError(err, 'Could not preview voice')),
      }
    );
  };

  if (isError) {
    return (
      <p className="text-destructive text-sm">
        {errorMessage ?? 'Could not load voice receptionist settings'}
      </p>
    );
  }

  if (isLoading || !draft) {
    return <VoiceReceptionistSectionSkeleton />;
  }

  const voiceOn = draft.enabled;

  return (
    <div className="space-y-3">
      <AiSettingsToggleRow
        id="voice-receptionist-enabled"
        label={AI_SETTINGS_VOICE_TOGGLE_LABEL}
        checked={draft.enabled}
        disabled={disabled}
        onCheckedChange={(checked) => onChange('enabled', checked)}
      />

      {voiceOn ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <SettingsField id="voice-receptionist-voice" label="Voice">
                <Select
                  disabled={disabled || previewBusy}
                  value={draft.voiceId}
                  onValueChange={(value) => onChange('voiceId', value)}
                >
                  <SelectTrigger id="voice-receptionist-voice">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVoices.map((voice) => (
                      <SelectItem key={voice} value={voice}>
                        {geminiLiveVoiceLabel(voice)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsField>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="settings-action shrink-0 gap-2"
              disabled={disabled || previewBusy || !draft.voiceId}
              onClick={handleTestVoice}
              aria-label="Test selected voice"
            >
              {previewBusy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Volume2 className="size-4" aria-hidden />
              )}
              {previewBusy ? 'Testing…' : 'Test voice'}
            </Button>
          </div>

          <SettingsField id="voice-receptionist-persona" label="Persona prompt">
            <Textarea
              id="voice-receptionist-persona"
              rows={3}
              disabled={disabled}
              value={draft.personaPrompt}
              onChange={(event) => onChange('personaPrompt', event.target.value)}
              maxLength={300}
            />
          </SettingsField>

          <VoiceReceptionistUsagePanel />
        </>
      ) : null}
    </div>
  );
}
