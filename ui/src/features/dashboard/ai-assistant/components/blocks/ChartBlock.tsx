import { useMemo, useState } from 'react';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type Props = Extract<ChatBlock, { type: 'chart' }> & {
  onCopy?: (text: string) => void;
};

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export function ChartBlock({ title, kind, series, tableAlt }: Props) {
  const [mode, setMode] = useState<'chart' | 'table'>('chart');
  const lines = series ?? [];
  const points = lines[0]?.points ?? [];
  const table = tableAlt ?? {
    columns: [] as string[],
    rows: [] as Array<Record<string, string | number>>,
  };
  const rows = useMemo(() => {
    if (kind === 'pie' || kind === 'donut') {
      return points.map((point) => ({ name: point.x, value: point.y, label: point.label }));
    }
    const byX = new Map<string, Record<string, string | number>>();
    for (const line of lines) {
      for (const point of line.points ?? []) {
        const row = byX.get(point.x) ?? { name: point.x };
        row[line.name] = point.y;
        byX.set(point.x, row);
      }
    }
    return [...byX.values()];
  }, [kind, points, lines]);

  if (points.length === 0) {
    return (
      <div className="border-border/60 space-y-2 rounded-xl border p-3">
        {title ? <p className="text-foreground text-sm font-semibold">{title}</p> : null}
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  const copyTable = () => {
    const cols = table.columns.join('\t');
    const body = table.rows
      .map((row) => table.columns.map((col) => String(row[col] ?? '')).join('\t'))
      .join('\n');
    void navigator.clipboard.writeText(`${cols}\n${body}`);
  };

  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      className="border-border/60 bg-card space-y-2 rounded-xl border p-3"
      data-testid="assistant-chart-block"
    >
      <div className="flex flex-wrap items-center gap-2">
        {title ? (
          <p className="text-foreground min-w-0 flex-1 text-sm font-semibold">{title}</p>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 px-3"
          onClick={() => setMode(mode === 'chart' ? 'table' : 'chart')}
        >
          {mode === 'chart' ? 'Table' : 'Chart'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 px-3"
          onClick={copyTable}
        >
          Copy data
        </Button>
      </div>
      {mode === 'table' ? (
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead>
              <tr>
                {table.columns.map((col) => (
                  <th key={col} className="text-muted-foreground pr-3 font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i}>
                  {table.columns.map((col) => (
                    <td key={col} className="pr-3 tabular-nums">
                      {String(row[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-40 min-h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {kind === 'pie' || kind === 'donut' ? (
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={kind === 'donut' ? 36 : 0}
                  isAnimationActive={!reducedMotion}
                >
                  {rows.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            ) : kind === 'bar' ? (
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar
                  dataKey={lines[0]?.name ?? 'value'}
                  fill={COLORS[0]}
                  isAnimationActive={!reducedMotion}
                />
              </BarChart>
            ) : kind === 'area' ? (
              <AreaChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey={lines[0]?.name ?? 'value'}
                  fill={COLORS[0]}
                  stroke={COLORS[0]}
                  isAnimationActive={!reducedMotion}
                />
              </AreaChart>
            ) : (
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                {lines.map((line, i) => (
                  <Line
                    key={line.name}
                    type="monotone"
                    dataKey={line.name}
                    stroke={COLORS[i % COLORS.length]}
                    dot={false}
                    isAnimationActive={!reducedMotion}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
