import { ChevronRight, Plus, X } from 'lucide-react';

import { LimitedCountInput } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import {
  HOUSE_RULE_CATEGORIES,
  HOUSE_RULE_CUSTOM_MAX_LENGTH,
  type CustomHouseRule,
} from '@/features/dashboard/org/lib/propertyHouseRulesConstants';

import { Button } from '@/components/ui/button';
import { CheckboxDisplay } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

type PropertyHouseRulesManageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabledHouseRules: string[];
  customHouseRules: CustomHouseRule[];
  newCustomHouseRuleInputs: Record<string, string>;
  onNewCustomHouseRuleInputChange: (categoryId: string, value: string) => void;
  onToggleHouseRule: (ruleId: string) => void;
  onAddCustomHouseRule: (categoryId: string) => void;
  onRemoveCustomHouseRule: (ruleId: string) => void;
  disabled?: boolean;
  /** Render editor without a nested modal (Setup Guide). */
  inline?: boolean;
};

export function PropertyHouseRulesManageDialog({
  open,
  onOpenChange,
  enabledHouseRules,
  customHouseRules,
  newCustomHouseRuleInputs,
  onNewCustomHouseRuleInputChange,
  onToggleHouseRule,
  onAddCustomHouseRule,
  onRemoveCustomHouseRule,
  disabled = false,
  inline = false,
}: PropertyHouseRulesManageDialogProps) {
  const editor = (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5">
      <div className="space-y-3">
        {HOUSE_RULE_CATEGORIES.map((category) => {
          const categoryCustom = customHouseRules.filter(
            (entry) => entry.categoryId === category.id
          );
          const totalCount = category.rules.length + categoryCustom.length;
          const enabledCount =
            category.rules.filter((entry) => enabledHouseRules.includes(entry.id)).length +
            categoryCustom.filter((entry) => enabledHouseRules.includes(entry.id)).length;

          return (
            <Collapsible
              key={category.id}
              defaultOpen={enabledCount > 0}
              className="border-border bg-card overflow-hidden rounded-xl border shadow-sm"
            >
              <CollapsibleTrigger className="hover:bg-muted/40 data-[state=open]:border-border/60 data-[state=open]:bg-muted/20 group flex min-h-[44px] w-full items-center justify-between border-b border-transparent px-4 py-3 text-left transition-colors">
                <div className="flex min-w-0 items-center gap-3">
                  <category.icon className="text-muted-foreground size-5 shrink-0" aria-hidden />
                  <span className="truncate font-medium">{category.name}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {enabledCount}/{totalCount}
                  </span>
                </div>
                <ChevronRight
                  className="text-muted-foreground size-4 shrink-0 transition-transform group-data-[state=open]:rotate-90"
                  aria-hidden
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3 p-4">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {category.rules.map((rule) => {
                      const enabled = enabledHouseRules.includes(rule.id);
                      return (
                        <button
                          key={rule.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => onToggleHouseRule(rule.id)}
                          className={cn(
                            'flex min-h-[44px] items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                            enabled
                              ? 'border-border bg-background shadow-sm'
                              : 'border-border/60 hover:bg-muted/40'
                          )}
                        >
                          <CheckboxDisplay checked={enabled} />
                          <span className="min-w-0 flex-1">{rule.name}</span>
                        </button>
                      );
                    })}

                    {categoryCustom.map((rule) => {
                      const enabled = enabledHouseRules.includes(rule.id);
                      return (
                        <div
                          key={rule.id}
                          className={cn(
                            'flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2.5',
                            enabled ? 'border-border bg-background shadow-sm' : 'border-border/60'
                          )}
                        >
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => onToggleHouseRule(rule.id)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left text-sm"
                          >
                            <CheckboxDisplay checked={enabled} />
                            <span className="truncate">{rule.name}</span>
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="min-h-[44px] min-w-[44px] shrink-0"
                            disabled={disabled}
                            onClick={() => onRemoveCustomHouseRule(rule.id)}
                            aria-label={`Remove ${rule.name}`}
                          >
                            <X className="size-4" aria-hidden />
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <LimitedCountInput
                      value={newCustomHouseRuleInputs[category.id] ?? ''}
                      onChange={(event) =>
                        onNewCustomHouseRuleInputChange(category.id, event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          onAddCustomHouseRule(category.id);
                        }
                      }}
                      disabled={disabled}
                      placeholder="Add custom rule..."
                      maxLength={HOUSE_RULE_CUSTOM_MAX_LENGTH}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={disabled || !newCustomHouseRuleInputs[category.id]?.trim()}
                      onClick={() => onAddCustomHouseRule(category.id)}
                      className="min-h-[44px] shrink-0"
                    >
                      <Plus className="mr-1 size-4" aria-hidden />
                      Add
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );

  if (inline) {
    return <div className="space-y-3">{editor}</div>;
  }

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        className={cn(
          'flex max-h-[min(92dvh,52rem)] w-[min(calc(100vw-1.5rem),56rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(95vw,56rem)] sm:p-0'
        )}
      >
        <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-0 border-b px-4 py-3 sm:px-5 sm:py-4">
          <ResponsiveModalTitle className="pr-8 text-base sm:text-lg">
            House Rules
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>

        {editor}

        <ResponsiveModalFooter className="border-border/60 shrink-0 border-t px-4 py-3 sm:px-5">
          <Button
            type="button"
            className="min-h-[44px] w-full sm:ml-auto sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Save
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
