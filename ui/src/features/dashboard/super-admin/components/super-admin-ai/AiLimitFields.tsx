import {
  AI_LIMIT_FIELDS,
  AI_LIMIT_GROUPS,
  type AiLimitKey,
} from '@/features/dashboard/super-admin/lib/aiLimits';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type AiLimitFieldsProps = {
  idPrefix: string;
  keys: readonly AiLimitKey[];
  draft: Record<AiLimitKey, string>;
  onChange: (key: AiLimitKey, value: string) => void;
  disabled?: boolean;
  /** Per-key placeholder (e.g. the inherited value). Falls back to the field hint. */
  placeholders?: Partial<Record<AiLimitKey, string>>;
};

/** Grouped numeric inputs. Blank always means "inherit" — never zero. */
export function AiLimitFields({
  idPrefix,
  keys,
  draft,
  onChange,
  disabled,
  placeholders,
}: AiLimitFieldsProps) {
  return (
    <div className="space-y-4">
      {AI_LIMIT_GROUPS.map((group) => {
        const groupKeys = group.keys.filter((key) => keys.includes(key));
        if (groupKeys.length === 0) return null;
        return (
          <fieldset key={group.id} className="min-w-0 space-y-2">
            <legend className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              {group.label}
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {groupKeys.map((key) => {
                const meta = AI_LIMIT_FIELDS[key];
                const id = `${idPrefix}-${key}`;
                return (
                  <div key={key} className="min-w-0 space-y-1">
                    <Label htmlFor={id} className="text-sm">
                      {meta.label}
                      {meta.unit ? (
                        <span className="text-muted-foreground font-normal"> ({meta.unit})</span>
                      ) : null}
                    </Label>
                    <Input
                      id={id}
                      inputMode={meta.decimal ? 'decimal' : 'numeric'}
                      value={draft[key]}
                      disabled={disabled}
                      placeholder={placeholders?.[key] ?? meta.blankHint ?? 'Inherit'}
                      onChange={(event) => onChange(key, event.target.value)}
                      className="h-10"
                    />
                  </div>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
