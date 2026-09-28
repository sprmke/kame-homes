import * as React from 'react';

import { Loader2, Mic, Volume2 } from 'lucide-react';
import { toast } from 'sonner';

import { SettingsField } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import {
  AiSettingsFeatureGroup,
  AiSettingsStatusNote,
  AiSettingsToggleRow,
  AiSettingsUsageStat,
} from '@/features/dashboard/org/components/settings/AiSettingsChrome';
import {
  buildVoiceReceptionistPatch,
  usePreviewVoiceReceptionistVoice,
  useUpdateVoiceReceptionistOrgSettings,
  useVoiceReceptionistOrgSettings,
  useVoiceReceptionistOrgUsage,
  voiceReceptionistFormIsDirty,
  voiceReceptionistToFormValues,
  type VoiceReceptionistFormValues,
} from '@/features/dashboard/org/hooks/useVoiceReceptionistOrgSettings';
import {
  AI_SETTINGS_VOICE_GROUP_TITLE,
  AI_SETTINGS_VOICE_TOGGLE_LABEL,
} from '@/features/dashboard/org/lib/aiSettingsLabels';
import {
  geminiLiveVoiceLabel,
  playVoicePreviewAudio,
} from '@/features/dashboard/org/lib/voiceReceptionistVoicePreview';
import { PlanGatedText } from '@/features/dashboard/plans/components/PlanUpgradeLink';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

function formatDurationShort(seconds: number): string {
  if (seconds <= 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function VoiceUsagePanel() {
  const { data, isLoading, isError } = useVoiceReceptionistOrgUsage(true);

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
      <p className="text-muted-foreground text-xs font-medium">Last 30 days</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <AiSettingsUsageStat label="Today" value={String(data.sessionsToday)} />
        <AiSettingsUsageStat label="Calls" value={String(data.sessionsLast30Days)} />
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

type Props = {
  properties: ReadonlyArray<{ id: string; name: string }>;
  readOnly: boolean;
};

/** Org-wide voice receptionist: one config for every property, with per-property opt-out. */
export function OrgVoiceReceptionistGroup({ properties, readOnly }: Props) {
  const { data: settings, isLoading, isError } = useVoiceReceptionistOrgSettings();
  const update = useUpdateVoiceReceptionistOrgSettings();
  const previewVoice = usePreviewVoiceReceptionistVoice();
  const stopPreviewRef = React.useRef<(() => void) | null>(null);

  const [draft, setDraft] = React.useState<VoiceReceptionistFormValues | null>(null);
  const [baseline, setBaseline] = React.useState<VoiceReceptionistFormValues | null>(null);

  React.useEffect(() => {
    if (!settings) return;
    const next = voiceReceptionistToFormValues(settings);
    setDraft((current) => current ?? next);
    setBaseline((current) => current ?? next);
  }, [settings]);

  React.useEffect(() => {
    return () => {
      stopPreviewRef.current?.();
      stopPreviewRef.current = null;
    };
  }, []);

  const dirty = draft && baseline ? voiceReceptionistFormIsDirty(draft, baseline) : false;

  const handleSave = async (): Promise<boolean> => {
    if (!draft) return false;
    try {
      const saved = await update.mutateAsync(buildVoiceReceptionistPatch(draft));
      const next = voiceReceptionistToFormValues(saved);
      setDraft(next);
      setBaseline(next);
      toast.success('Voice receptionist saved');
      return true;
    } catch (err: unknown) {
      toast.error(friendlyToastError(err, 'Could not save voice receptionist'));
      return false;
    }
  };

  useUnsavedChangesGuard({ isDirty: dirty && !readOnly, onSave: handleSave });

  const setField = <K extends keyof VoiceReceptionistFormValues>(
    key: K,
    value: VoiceReceptionistFormValues[K]
  ) => setDraft((current) => (current ? { ...current, [key]: value } : current));

  const handleTestVoice = () => {
    if (!draft?.voiceId) return;
    stopPreviewRef.current?.();
    stopPreviewRef.current = null;
    previewVoice.mutate(
      { voiceId: draft.voiceId },
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
      <AiSettingsFeatureGroup title={AI_SETTINGS_VOICE_GROUP_TITLE} icon={Mic}>
        <p className="text-destructive text-sm">Could not load voice receptionist</p>
      </AiSettingsFeatureGroup>
    );
  }

  if (isLoading || !settings || !draft) {
    return (
      <AiSettingsFeatureGroup title={AI_SETTINGS_VOICE_GROUP_TITLE} icon={Mic}>
        <div className="space-y-3" aria-hidden>
          <div className="bg-muted h-11 animate-pulse rounded-lg" />
          <div className="bg-muted h-10 animate-pulse rounded-lg" />
        </div>
      </AiSettingsFeatureGroup>
    );
  }

  const planLocked = !settings.planAllowed;
  const previewBusy = previewVoice.isPending;
  const fieldsDisabled = readOnly || planLocked;

  return (
    <AiSettingsFeatureGroup title={AI_SETTINGS_VOICE_GROUP_TITLE} icon={Mic}>
      {planLocked ? (
        <AiSettingsStatusNote>
          <PlanGatedText text="Not included in your plan. Upgrade" feature="aiReceptionist" />
        </AiSettingsStatusNote>
      ) : null}

      <AiSettingsToggleRow
        id="org-voice-receptionist-enabled"
        label={AI_SETTINGS_VOICE_TOGGLE_LABEL}
        checked={draft.enabled}
        disabled={readOnly || (planLocked && !draft.enabled)}
        onCheckedChange={(checked) => setField('enabled', checked)}
      />

      {draft.enabled && !planLocked ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <SettingsField id="org-voice-receptionist-voice" label="Voice">
                <Select
                  disabled={fieldsDisabled || previewBusy}
                  value={draft.voiceId}
                  onValueChange={(value) => setField('voiceId', value)}
                >
                  <SelectTrigger id="org-voice-receptionist-voice">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {settings.availableVoices.map((voice) => (
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
              className="settings-action min-h-[44px] shrink-0 gap-2"
              disabled={fieldsDisabled || previewBusy || !draft.voiceId}
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

          <SettingsField id="org-voice-receptionist-persona" label="Persona prompt">
            <Textarea
              id="org-voice-receptionist-persona"
              rows={3}
              disabled={fieldsDisabled}
              value={draft.personaPrompt}
              onChange={(event) => setField('personaPrompt', event.target.value)}
              maxLength={300}
            />
          </SettingsField>

          {properties.length > 0 ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                Disable on specific properties
              </p>
              <div
                className="border-border/60 max-h-72 space-y-0.5 overflow-y-auto overscroll-contain rounded-lg border p-1.5"
                role="group"
                aria-label="Properties without voice receptionist"
              >
                {properties.map((property) => (
                  <label
                    key={property.id}
                    className="flex min-h-[44px] items-center gap-2 rounded-md px-2 text-sm"
                  >
                    <Checkbox
                      checked={draft.disabledPropertyIds.includes(property.id)}
                      disabled={fieldsDisabled}
                      onCheckedChange={(checked) =>
                        setField(
                          'disabledPropertyIds',
                          checked
                            ? [...draft.disabledPropertyIds, property.id]
                            : draft.disabledPropertyIds.filter((id) => id !== property.id)
                        )
                      }
                      aria-label={`Disable voice receptionist on ${property.name}`}
                    />
                    {property.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <VoiceUsagePanel />
        </>
      ) : null}

      {dirty && !readOnly ? (
        <Button
          type="button"
          className="min-h-[44px]"
          disabled={update.isPending}
          onClick={() => void handleSave()}
        >
          {update.isPending ? 'Saving…' : 'Save voice settings'}
        </Button>
      ) : null}
    </AiSettingsFeatureGroup>
  );
}
