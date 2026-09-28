import { useState } from 'react';

import { ArrowRight, RotateCcw } from 'lucide-react';

import { useAiAssistantSession } from '@/features/dashboard/ai-assistant/lib/aiAssistantSessionContext';
import { useAssistantNavigate } from '@/features/dashboard/ai-assistant/lib/assistantSurfaceContext';
import { useOrgSlugParam } from '@/features/dashboard/org/lib/adminApiScope';
import { AI_SETTINGS_SECTION_ID } from '@/features/dashboard/org/lib/aiSettingsLabels';
import { orgSettingsPath } from '@/features/dashboard/org/lib/tenantPaths';
import { useOrgPermissions } from '@/features/dashboard/team/hooks/useOrgPermissions';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Replaces the composer while the org or property AI switch is off, with the one step that turns
 * it back on. A platform (super admin) block never reaches here; it shows as a plain error.
 */
export function AssistantAiOffCard({ className }: { className?: string }) {
  const session = useAiAssistantSession();
  const orgSlug = useOrgSlugParam();
  const { data: orgAccess } = useOrgPermissions();
  const navigateFromChat = useAssistantNavigate();
  const [previewOn, setPreviewOn] = useState(false);

  if (!session.aiOffReason) return null;

  const canEditOrgAi = orgAccess?.canEditAiPlatform ?? false;
  const copy = canEditOrgAi
    ? { body: 'Turn it on in Settings to use the assistant.', cta: 'Open AI settings' }
    : { body: 'Ask the organization owner to turn it on in Settings.', cta: undefined };
  const href =
    canEditOrgAi && orgSlug
      ? `${orgSettingsPath(orgSlug)}#section-${AI_SETTINGS_SECTION_ID}`
      : null;

  return (
    <section
      role="status"
      aria-labelledby="assistant-ai-off-title"
      className={cn(
        'bg-card border-border/70 flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'ring-border mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full ring-1 ring-inset transition-colors duration-200 motion-reduce:transition-none',
            previewOn ? 'bg-primary ring-primary' : 'bg-muted'
          )}
        >
          <span
            className={cn(
              'bg-background block size-4 rounded-full shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none',
              previewOn ? 'translate-x-[18px]' : 'translate-x-0.5'
            )}
          />
        </span>
        <div className="min-w-0">
          <p id="assistant-ai-off-title" className="text-foreground text-sm font-semibold">
            {session.aiOffReason === 'property' ? 'AI is off for this property' : 'AI is off'}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs sm:text-[13px]">{copy.body}</p>
        </div>
      </div>

      {href || session.canRetry ? (
        <div className="flex shrink-0 items-center gap-1.5 max-sm:[&>*]:flex-1">
          {session.canRetry ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-[44px] gap-1.5 sm:min-h-9"
              onClick={() => void session.retryFailedTurn()}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Try again
            </Button>
          ) : null}
          {href && copy.cta ? (
            <Button
              type="button"
              size="sm"
              className="min-h-[44px] gap-1.5 sm:min-h-9"
              onMouseEnter={() => setPreviewOn(true)}
              onMouseLeave={() => setPreviewOn(false)}
              onFocus={() => setPreviewOn(true)}
              onBlur={() => setPreviewOn(false)}
              onClick={() => navigateFromChat(href)}
            >
              {copy.cta}
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
