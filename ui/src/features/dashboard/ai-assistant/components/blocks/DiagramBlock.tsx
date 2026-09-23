type Props = {
  title?: string;
  format: 'mermaid' | 'text';
  source: string;
};

export function DiagramBlock({ title, format, source }: Props) {
  const safeSource = source.trim();
  if (!safeSource) return null;

  return (
    <div className="border-border/60 bg-card space-y-2 rounded-xl border p-3">
      <p className="text-foreground text-sm font-semibold">
        {title?.trim() || (format === 'mermaid' ? 'Diagram' : 'Flow')}
      </p>
      <pre className="bg-background/60 overflow-x-auto rounded-lg p-2 text-xs leading-relaxed">
        <code>{safeSource}</code>
      </pre>
    </div>
  );
}
