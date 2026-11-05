import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

type Props = Extract<ChatBlock, { type: 'comparison' }>;

export function ComparisonBlock({ title, columns, rows }: Props) {
  const [beforeLabel, afterLabel] = columns ?? ['Current', 'Proposed'];
  const tableRows = rows ?? [];
  return (
    <div className="border-border/60 bg-card space-y-2 rounded-xl border p-3">
      {title ? <p className="text-foreground text-sm font-semibold">{title}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="pr-3 font-medium"> </th>
              <th className="pr-3 font-medium">{beforeLabel}</th>
              <th className="font-medium">{afterLabel}</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => (
              <tr
                key={row.label}
                className={row.changed ? 'text-foreground' : 'text-muted-foreground'}
              >
                <td className="py-1 pr-3">{row.label}</td>
                <td className="py-1 pr-3 tabular-nums">{row.before}</td>
                <td className="py-1 tabular-nums">{row.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
