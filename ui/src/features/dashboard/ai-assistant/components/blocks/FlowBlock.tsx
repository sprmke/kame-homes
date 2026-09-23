type Props = {
  title?: string;
  steps: string[];
};

export function FlowBlock({ title, steps }: Props) {
  const safeSteps = (steps ?? []).map((step) => step.trim()).filter(Boolean);
  if (safeSteps.length === 0) return null;

  return (
    <div className="border-border/60 bg-card space-y-2 rounded-xl border p-3">
      {title?.trim() ? <p className="text-foreground text-sm font-semibold">{title}</p> : null}
      <ol className="space-y-1.5 pl-4 text-sm leading-relaxed">
        {safeSteps.map((step, index) => (
          <li key={`${step}-${index}`} className="list-decimal">
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}
