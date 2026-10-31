type QuickAction = { label: string; prompt: string };

type Props = {
  actions: QuickAction[];
  disabled?: boolean;
  onRunAction?: (action: QuickAction) => void;
  showHeading?: boolean;
};

export function QuickActionsBlock({ actions, disabled, onRunAction, showHeading }: Props) {
  const visible = (actions ?? []).filter((action) => action.label?.trim() && action.prompt?.trim());
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {showHeading ? (
        <p className="text-muted-foreground text-xs font-medium">Suggestions</p>
      ) : null}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Suggested actions">
        {visible.map((action) => (
          <button
            key={`${action.label}-${action.prompt}`}
            type="button"
            disabled={disabled}
            onClick={() => onRunAction?.(action)}
            className="native-press border-border/60 bg-card text-foreground focus-visible:ring-ring min-h-[44px] rounded-full border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
