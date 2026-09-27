import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import {
  useAiDashboardAssistantGlobalSettings,
  useUpdateAiDashboardAssistantGlobalSettings,
} from '@/features/dashboard/ai-assistant/hooks/useAiDashboardAssistantSettings';

import { Switch } from '@/components/ui/switch';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

export function AiDashboardAssistantKillSwitchCard() {
  const { data, isLoading } = useAiDashboardAssistantGlobalSettings();
  const update = useUpdateAiDashboardAssistantGlobalSettings();

  const save = (patch: { enabled?: boolean; aiModeEnabled?: boolean }) => {
    update.mutate(
      patch,
      {
        onSuccess: () => toast.success('AI dashboard assistant settings updated'),
        onError: (err: unknown) => toast.error(friendlyToastError(err, 'Could not save setting')),
      }
    );
  };

  return (
    <div className="border-border bg-card flex h-full min-w-0 flex-col gap-5 rounded-xl border p-5">
      <div className="flex items-start gap-3">
        <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Sparkles className="text-muted-foreground size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="font-medium">AI dashboard assistant</p>
          <p className="text-muted-foreground text-xs">Chat assistant in the admin dashboard</p>
        </div>
      </div>
      <label className="flex min-h-[44px] items-center justify-between gap-3 text-sm">
        <span>Enabled</span>
        <Switch
          checked={Boolean(data?.enabled)}
          disabled={isLoading || update.isPending}
          onCheckedChange={(enabled) => save({ enabled })}
          aria-label="Enable AI dashboard assistant platform-wide"
        />
      </label>
      <label className="flex min-h-[44px] items-center justify-between gap-3 text-sm">
        <span className={data?.enabled ? undefined : 'text-muted-foreground'}>AI mode</span>
        <Switch
          checked={Boolean(data?.enabled && data?.aiModeEnabled)}
          disabled={isLoading || update.isPending || !data?.enabled}
          onCheckedChange={(aiModeEnabled) => save({ aiModeEnabled })}
          aria-label="Enable full-page AI mode platform-wide"
        />
      </label>
    </div>
  );
}
