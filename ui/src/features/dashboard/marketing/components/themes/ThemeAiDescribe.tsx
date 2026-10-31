import { useId, useState } from 'react';

import { Loader2, Sparkles } from 'lucide-react';

import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import {
  useGenerateMarketingTheme,
  type GeneratedMarketingTheme,
} from '@/features/dashboard/marketing/hooks/useMarketingThemes';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MAX_PROMPT = 300;

/**
 * "Describe a look": AI drafts the colors, fonts, background and corners. The
 * result lands in the editor as an unsaved draft the host can tweak, so nothing
 * is stored until they press Save.
 */
export function ThemeAiDescribe({
  brandColor,
  onGenerated,
}: {
  brandColor: string;
  onGenerated: (theme: GeneratedMarketingTheme) => void;
}) {
  const id = useId();
  const [prompt, setPrompt] = useState('');
  const { canGenerate } = useMarketingPermissions();
  const { canUse, isLoading: gateLoading } = useFeatureGate('aiMarketingGeneration');
  const { open: openUpgradeModal } = useUpgradeModal();
  const generate = useGenerateMarketingTheme();

  if (!canGenerate) return null;

  const run = async () => {
    const text = prompt.trim();
    if (!text || generate.isPending) return;
    if (!gateLoading && !canUse) {
      openUpgradeModal('aiMarketingGeneration');
      return;
    }
    try {
      onGenerated(await generate.mutateAsync({ prompt: text, brandColor }));
    } catch {
      // Quota and errors are toasted by the mutation.
    }
  };

  return (
    <div className="border-border bg-muted/30 space-y-2 rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="text-sm font-medium">
          Describe a look
        </Label>
        <TierBadge feature="aiMarketingGeneration" />
      </div>
      <div className="flex gap-2">
        <Input
          id={id}
          value={prompt}
          maxLength={MAX_PROMPT}
          placeholder="Calm beach house, sandy and soft blue"
          disabled={generate.isPending}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void run();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="shrink-0 gap-1.5"
          disabled={!prompt.trim() || generate.isPending}
          onClick={() => void run()}
        >
          {generate.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
          Generate
        </Button>
      </div>
    </div>
  );
}
