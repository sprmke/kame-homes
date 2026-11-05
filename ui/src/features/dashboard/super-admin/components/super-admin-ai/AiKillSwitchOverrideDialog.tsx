import * as React from 'react';

import { toast } from 'sonner';

import {
  useAiLimitsAction,
  type OrgKillSwitches,
} from '@/features/dashboard/super-admin/hooks/useSuperAdminAiLimits';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

type KillSwitchKey = 'agenticModeEnabled' | 'planApprovalEnabled' | 'guestActionsEnabled';
type OverrideMode = 'inherit' | 'on' | 'off';

const SWITCHES: Array<{ key: KillSwitchKey; label: string }> = [
  { key: 'agenticModeEnabled', label: 'Agentic mode (multi-round tool use)' },
  { key: 'planApprovalEnabled', label: 'Plan approval (batched proposals)' },
  { key: 'guestActionsEnabled', label: 'Guest self-service actions' },
];

type Draft = Record<KillSwitchKey, OverrideMode>;

function overrideToMode(value: boolean | null): OverrideMode {
  if (value === null) return 'inherit';
  return value ? 'on' : 'off';
}

function modeToOverride(mode: OverrideMode): boolean | null {
  if (mode === 'inherit') return null;
  return mode === 'on';
}

function draftFrom(killSwitches: OrgKillSwitches): Draft {
  return {
    agenticModeEnabled: overrideToMode(killSwitches.override.agenticModeEnabled),
    planApprovalEnabled: overrideToMode(killSwitches.override.planApprovalEnabled),
    guestActionsEnabled: overrideToMode(killSwitches.override.guestActionsEnabled),
  };
}

type AiKillSwitchOverrideDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  killSwitches: OrgKillSwitches;
};

/**
 * Per-org override for the Phase 6 guardrail kill switches. Each switch is tri-state —
 * Inherit (platform default) / Force on / Force off — matching the `boolean | null` shape
 * `ai_dashboard_assistant_org_settings` uses (`null` = inherit, see
 * `resolveDashboardAssistantKillSwitch`). Org-scoped only, no property-level override.
 */
export function AiKillSwitchOverrideDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  killSwitches,
}: AiKillSwitchOverrideDialogProps) {
  const action = useAiLimitsAction();
  const baseline = React.useMemo(() => draftFrom(killSwitches), [killSwitches]);
  const [draft, setDraft] = React.useState<Draft>(baseline);

  React.useEffect(() => {
    if (open) setDraft(baseline);
  }, [open, baseline]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  const handleSave = async (): Promise<boolean> => {
    try {
      await action.mutateAsync({
        action: 'set_kill_switch_overrides',
        organizationId,
        agenticModeEnabled: modeToOverride(draft.agenticModeEnabled),
        planApprovalEnabled: modeToOverride(draft.planApprovalEnabled),
        guestActionsEnabled: modeToOverride(draft.guestActionsEnabled),
      });
      toast.success('Guardrail overrides saved');
      onOpenChange(false);
      return true;
    } catch (err: unknown) {
      toast.error(friendlyToastError(err, 'Could not save guardrail overrides'));
      return false;
    }
  };

  const resetDraft = () => setDraft(baseline);
  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({ open, onOpenChange, isDirty, onSave: handleSave, onDiscard: resetDraft });

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={guardedOpenChange}>
        <ResponsiveModalContent className="max-w-lg sm:max-w-lg" sheetLayout="split">
          <ResponsiveModalHeader className="shrink-0 px-4 sm:px-0">
            <ResponsiveModalTitle>Guardrail overrides for {organizationName}</ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 sm:px-0">
            <p className="text-muted-foreground text-xs">
              Inherit follows the platform-wide default below. Force on/off always wins for this
              organization, regardless of the platform setting.
            </p>
            {SWITCHES.map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`ai-kill-switch-${key}`}>{label}</Label>
                <Select
                  value={draft[key]}
                  onValueChange={(value) =>
                    setDraft((current) => ({ ...current, [key]: value as OverrideMode }))
                  }
                >
                  <SelectTrigger
                    id={`ai-kill-switch-${key}`}
                    aria-label={`${label} override`}
                    className="min-h-[44px]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">
                      Inherit (platform default: {killSwitches.global[key] ? 'on' : 'off'})
                    </SelectItem>
                    <SelectItem value="on">Force on</SelectItem>
                    <SelectItem value="off">Force off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <ResponsiveModalFooter className="shrink-0 px-4 pb-4 sm:px-0 sm:pb-0">
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} loading={action.isPending}>
              Save
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
