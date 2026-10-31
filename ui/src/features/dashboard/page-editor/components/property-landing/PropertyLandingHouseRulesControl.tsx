import { useState } from 'react';

import { ChevronRight, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import { LimitedCountInput } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import {
  HOUSE_RULE_CATEGORIES,
  HOUSE_RULE_CUSTOM_MAX_LENGTH,
  MUTUALLY_EXCLUSIVE_HOUSE_RULES,
  type CustomHouseRule,
} from '@/features/dashboard/org/lib/propertyHouseRulesConstants';

import { Button } from '@/components/ui/button';
import { CheckboxDisplay } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type Props = {
  enabledHouseRules: string[];
  customHouseRules: CustomHouseRule[];
  onEnabledChange: (ids: string[]) => void;
  onCustomChange: (rules: CustomHouseRule[]) => void;
  disabled?: boolean;
};

export function PropertyLandingHouseRulesControl({
  enabledHouseRules,
  customHouseRules,
  onEnabledChange,
  onCustomChange,
  disabled = false,
}: Props) {
  const [newInputs, setNewInputs] = useState<Record<string, string>>({});

  const toggleHouseRule = (ruleId: string) => {
    const enabled = enabledHouseRules.includes(ruleId);
    let next = enabled
      ? enabledHouseRules.filter((id) => id !== ruleId)
      : [...enabledHouseRules, ruleId];

    const exclusiveId = MUTUALLY_EXCLUSIVE_HOUSE_RULES[ruleId];
    if (!enabled && exclusiveId) {
      next = next.filter((id) => id !== exclusiveId);
    }

    onEnabledChange(next);
  };

  const addCustomHouseRule = (categoryId: string) => {
    const name = newInputs[categoryId]?.trim();
    if (!name) return;
    if (name.length > HOUSE_RULE_CUSTOM_MAX_LENGTH) {
      toast.error(`Custom rules must be ${HOUSE_RULE_CUSTOM_MAX_LENGTH} characters or fewer`);
      return;
    }
    const rule: CustomHouseRule = {
      id: `custom_${categoryId}_${Date.now()}`,
      name,
      categoryId,
    };
    onCustomChange([...customHouseRules, rule]);
    onEnabledChange([...enabledHouseRules, rule.id]);
    setNewInputs((current) => ({ ...current, [categoryId]: '' }));
  };

  const removeCustomHouseRule = (ruleId: string) => {
    onCustomChange(customHouseRules.filter((entry) => entry.id !== ruleId));
    onEnabledChange(enabledHouseRules.filter((id) => id !== ruleId));
  };

  return (
    <div className="space-y-4 px-4 py-3">
      <p className="text-muted-foreground text-xs">
        {enabledHouseRules.length} selected
        {customHouseRules.length > 0 ? ` · ${customHouseRules.length} custom` : ''}
      </p>

      {HOUSE_RULE_CATEGORIES.map((category) => {
        const categoryCustom = customHouseRules.filter((entry) => entry.categoryId === category.id);
        const totalCount = category.rules.length + categoryCustom.length;
        const enabledCount =
          category.rules.filter((entry) => enabledHouseRules.includes(entry.id)).length +
          categoryCustom.filter((entry) => enabledHouseRules.includes(entry.id)).length;

        return (
          <Collapsible
            key={category.id}
            defaultOpen
            className="border-border bg-card overflow-hidden rounded-xl border shadow-sm"
          >
            <CollapsibleTrigger className="hover:bg-muted/40 data-[state=open]:border-border/60 data-[state=open]:bg-muted/20 group flex min-h-[44px] w-full items-center justify-between border-b border-transparent px-4 py-3 text-left transition-colors">
              <div className="flex min-w-0 items-center gap-3">
                <category.icon className="text-muted-foreground size-5 shrink-0" aria-hidden />
                <span className="truncate text-sm font-medium">{category.name}</span>
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
                <div className="grid gap-2">
                  {category.rules.map((rule) => {
                    const enabled = enabledHouseRules.includes(rule.id);
                    return (
                      <button
                        key={rule.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleHouseRule(rule.id)}
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
                          onClick={() => toggleHouseRule(rule.id)}
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
                          onClick={() => removeCustomHouseRule(rule.id)}
                          aria-label={`Remove ${rule.name}`}
                        >
                          <X className="size-4" aria-hidden />
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-2">
                  <LimitedCountInput
                    value={newInputs[category.id] ?? ''}
                    onChange={(event) =>
                      setNewInputs((current) => ({
                        ...current,
                        [category.id]: event.target.value,
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addCustomHouseRule(category.id);
                      }
                    }}
                    disabled={disabled}
                    placeholder="Add custom rule..."
                    maxLength={HOUSE_RULE_CUSTOM_MAX_LENGTH}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled || !newInputs[category.id]?.trim()}
                    onClick={() => addCustomHouseRule(category.id)}
                    className="min-h-[44px]"
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
  );
}
