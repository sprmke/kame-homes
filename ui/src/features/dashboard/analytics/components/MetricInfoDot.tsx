import {
  ANALYTICS_METRIC_GLOSSARY,
  type AnalyticsMetricKey,
} from '@/features/dashboard/analytics/lib/metricGlossary';

import { InfoHint } from '@/components/help/InfoHint';

type Props = {
  metric: AnalyticsMetricKey;
  label: string;
  className?: string;
};

/**
 * Small `i` affordance next to a metric name. Same touch-safe behavior as every
 * other host hint: hover on mouse, tap on touch, Esc closes.
 */
export function MetricInfoDot({ metric, label, className }: Props) {
  return (
    <InfoHint
      label={label}
      text={ANALYTICS_METRIC_GLOSSARY[metric]}
      variant="metric"
      side="top"
      align="start"
      className={className}
    />
  );
}
