import * as React from 'react';

import { Loader2, Mic, Volume2 } from 'lucide-react';
import { toast } from 'sonner';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import {
  usePreviewVoiceReceptionistVoice,
  useVoiceReceptionistUsage,
  type VoiceReceptionistFormValues,
} from '@/features/dashboard/bookings/hooks/useVoiceReceptionistSettings';
import { SettingsField } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import {
  geminiLiveVoiceLabel,
  playVoicePreviewAudio,
} from '@/features/dashboard/org/lib/voiceReceptionistVoicePreview';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

function VoiceReceptionistSectionSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="bg-muted h-10 animate-pulse rounded-lg" />
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

function UsageStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/40 bg-muted/15 rounded-lg border px-3 py-2.5">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{label}</p>
      <p className="mt-0.5 truncate text-base font-bold tabular-nums tracking-tight sm:text-2xl">
        {value}
      </p>
    </div>
  );
}

function VoiceReceptionistUsagePanel() {
  const { data, isLoading, isError } = useVoiceReceptionistUsage();

  if (isError) return null;
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-muted h-16 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
        Usage — last 30 days
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <UsageStat label="Today" value={String(data.sessionsToday)} />
        <UsageStat label="Last 30 days" value={String(data.sessionsLast30Days)} />
        <UsageStat label="Avg. length" value={formatDurationShort(data.avgDurationSeconds)} />
        <UsageStat label="Est. cost" value={`$${data.estimatedCostUsdLast30Days.toFixed(2)}`} />
        <UsageStat label="Failed" value={`${data.failureRate.toFixed(1)}%`} />
        <UsageStat label="Handoff" value={`${data.handoffRate.toFixed(1)}%`} />
      </div>
    </div>
  );
}

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

export function PropertyVoiceReceptionistSection({
  draft,
  propertyName,
  availableVoices,
  disabled = false,
  isLoading = false,
  isError = false,
  errorMessage = null,
  onChange,
}: Props) {
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

  return (
    <AdminSection
      id="voice-receptionist"
      title="Voice Receptionist"
      icon={Mic}
      description="AI assistant for check-in and stay questions."
    >
      {isError ? (
        <p className="text-destructive text-sm">
          {errorMessage ?? 'Could not load voice receptionist settings'}
        </p>
      ) : null}

      {isLoading || !draft ? (
        <VoiceReceptionistSectionSkeleton />
      ) : (
        <div className="space-y-4">
          <div className="border-border/40 bg-muted/15 flex min-h-[44px] items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
            <label htmlFor="voice-receptionist-enabled" className="text-sm font-medium">
              Enable voice receptionist
            </label>
            <Switch
              id="voice-receptionist-enabled"
              checked={draft.enabled}
              disabled={disabled}
              onCheckedChange={(checked) => onChange('enabled', checked)}
              aria-label="Enable voice receptionist"
            />
          </div>

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
              className="min-h-[44px] shrink-0 gap-2 sm:mb-0"
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SettingsField id="voice-receptionist-max-seconds" label="Max session (sec)">
              <Input
                id="voice-receptionist-max-seconds"
                type="number"
                min={60}
                max={3600}
                disabled={disabled}
                value={draft.maxSessionSeconds}
                onChange={(event) =>
                  onChange('maxSessionSeconds', Number(event.target.value) || 60)
                }
                className="h-10"
              />
            </SettingsField>
            <SettingsField id="voice-receptionist-max-daily" label="Max per guest / day">
              <Input
                id="voice-receptionist-max-daily"
                type="number"
                min={1}
                max={999}
                disabled={disabled}
                value={draft.maxSessionsPerGuestPerDay}
                onChange={(event) =>
                  onChange('maxSessionsPerGuestPerDay', Number(event.target.value) || 1)
                }
                className="h-10"
              />
            </SettingsField>
            <SettingsField id="voice-receptionist-max-concurrent" label="Max concurrent">
              <Input
                id="voice-receptionist-max-concurrent"
                type="number"
                min={1}
                max={50}
                disabled={disabled}
                value={draft.maxConcurrentSessions}
                onChange={(event) =>
                  onChange('maxConcurrentSessions', Number(event.target.value) || 1)
                }
                className="h-10"
              />
            </SettingsField>
          </div>

          <VoiceReceptionistUsagePanel />
        </div>
      )}
    </AdminSection>
  );
}
