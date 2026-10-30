import { useState } from 'react';

import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { InboxAiResponseDialog } from '@/features/dashboard/inbox/components/InboxAiResponseDialog';
import { PlatformLogo } from '@/features/dashboard/inbox/components/PlatformLogo';
import { platformLabel } from '@/features/dashboard/inbox/lib/inboxFormat';
import { INBOX_CHANNEL_ORDER } from '@/features/dashboard/inbox/lib/quickReplyGroups';
import type { InboxAutomationSettings } from '@/features/dashboard/inbox/types/inbox';
import { handleAiMutationError, isAiQuotaError } from '@/features/dashboard/org/lib/aiQuotaToast';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { FeatureUnavailableNotice } from '@/components/feature-availability/FeatureUnavailableNotice';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useFeatureAvailability } from '@/lib/featureAvailability/useFeatureAvailability';

type Props = {
  settings: InboxAutomationSettings | undefined;
  isLoading: boolean;
  saving: boolean;
  onSave: (patch: Partial<InboxAutomationSettings>) => Promise<void>;
};

export function InboxAutomationTab({ settings, isLoading, saving, onSave }: Props) {
  const [aiResponseOpen, setAiResponseOpen] = useState(false);
  const { canUse: canAutoReply, isLoading: entitlementsLoading } =
    useFeatureGate('aiChatAutoReply');
  const { open: openUpgradeModal } = useUpgradeModal();
  const metaAutoReplyAvailability = useFeatureAvailability('inbox.meta.auto_reply');

  if (isLoading || !settings) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const update = async (patch: Partial<InboxAutomationSettings>) => {
    try {
      await onSave(patch);
    } catch (e) {
      if (isAiQuotaError(e)) {
        handleAiMutationError(e as Error);
        return;
      }
      toast.error((e as Error).message);
    }
  };

  const autoSendEnabled = settings.autoReplyEnabled && settings.autoReplyMode === 'send';

  const setAutoSendEnabled = (checked: boolean) => {
    if (checked && !canAutoReply) {
      if (!entitlementsLoading) openUpgradeModal('aiChatAutoReply');
      return;
    }
    void update(
      checked
        ? { autoReplyEnabled: true, autoReplyMode: 'send' }
        : settings.autoReplyMode === 'send'
          ? { autoReplyEnabled: false }
          : {}
    );
  };

  const aiUnavailable = settings.aiAvailable === false && Boolean(settings.aiError?.trim());

  return (
    <div className="space-y-4">
      {aiUnavailable && autoSendEnabled && (
        <p className="text-destructive text-sm" role="alert">
          AI is unavailable: {settings.aiError}
        </p>
      )}

      <section className="border-border/70 bg-card overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Manage AI response</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Add extra context or tone guidance for guest replies.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 min-h-[44px] shrink-0 sm:min-h-9"
            onClick={() => setAiResponseOpen(true)}
          >
            Manage
          </Button>
        </div>
      </section>

      <section className="border-border/70 bg-card overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="auto-send-enabled" className="text-sm font-semibold">
                  Send automatically
                </Label>
                <TierBadge feature="aiChatAutoReply" />
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Sends AI replies without review. Off by default.
              </p>
            </div>
          </div>
          <Switch
            id="auto-send-enabled"
            checked={autoSendEnabled}
            disabled={saving}
            aria-label="Send AI replies automatically"
            onCheckedChange={setAutoSendEnabled}
          />
        </div>

        {autoSendEnabled && (
          <>
            {!metaAutoReplyAvailability.available && !metaAutoReplyAvailability.isLoading ? (
              <div className="border-border/60 border-t px-4 py-3">
                <FeatureUnavailableNotice
                  title={metaAutoReplyAvailability.label}
                  label={
                    metaAutoReplyAvailability.message ||
                    'Auto-replies on Facebook and Instagram are paused.'
                  }
                  expectedBackLabel={metaAutoReplyAvailability.expectedBackLabel}
                  tone={metaAutoReplyAvailability.tone}
                />
              </div>
            ) : null}
            <div className="border-border/60 border-t px-4 py-3">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Platforms
              </p>
            </div>
            <ul className="divide-border/60 divide-y">
              {INBOX_CHANNEL_ORDER.map((platform) => {
                const enabled = settings.platformToggles[platform] !== false;
                return (
                  <li key={platform}>
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <PlatformLogo platform={platform} size="sm" />
                        <span className="text-sm font-medium">{platformLabel(platform)}</span>
                      </div>
                      <Switch
                        checked={enabled}
                        disabled={saving}
                        aria-label={`Auto-send on ${platformLabel(platform)}`}
                        onCheckedChange={(checked) =>
                          void update({
                            platformToggles: {
                              ...settings.platformToggles,
                              [platform]: checked,
                            },
                          })
                        }
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <InboxAiResponseDialog
        open={aiResponseOpen}
        onOpenChange={setAiResponseOpen}
        aiSystemPrompt={settings.aiSystemPrompt}
        saving={saving}
        onSave={(value) => onSave({ aiSystemPrompt: value })}
      />
    </div>
  );
}
